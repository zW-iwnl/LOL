from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    SuiteGroup,
    SuiteGroupMember,
    SuiteGroupRelation,
    SuiteGroupTestCaseMember,
    TestCase,
    TestCaseTag,
    TestCaseTagAssignment,
    TestSuite,
)
from app.schemas.suite_group import (
    SuiteGroupCreate,
    SuiteGroupMemberCreate,
    SuiteGroupMemberUpdate,
    SuiteGroupTagRead,
    SuiteGroupUpdate,
)
from app.services.common import not_found


def group_descendants_cte():
    descendants = select(
        SuiteGroup.id.label("ancestor_id"),
        SuiteGroup.id.label("descendant_id"),
    ).cte("group_descendants", recursive=True)
    return descendants.union(
        select(
            descendants.c.ancestor_id,
            SuiteGroupRelation.child_group_id,
        ).select_from(
            descendants.join(
                SuiteGroupRelation,
                SuiteGroupRelation.parent_group_id == descendants.c.descendant_id,
            )
        )
    )


def group_test_cases_cte():
    """Return distinct test cases visible through each group in the DAG."""
    descendants = group_descendants_cte()
    explicit_cases = select(
        descendants.c.ancestor_id.label("group_id"),
        SuiteGroupTestCaseMember.test_case_id.label("test_case_id"),
    ).select_from(
        descendants.join(
            SuiteGroupTestCaseMember,
            SuiteGroupTestCaseMember.group_id == descendants.c.descendant_id,
        )
    )
    suite_cases = select(
        descendants.c.ancestor_id.label("group_id"),
        TestCase.id.label("test_case_id"),
    ).select_from(
        descendants.join(
            SuiteGroupMember,
            SuiteGroupMember.group_id == descendants.c.descendant_id,
        ).join(TestCase, TestCase.suite_id == SuiteGroupMember.suite_id)
    )
    return explicit_cases.union(suite_cases).cte("group_test_cases")


def group_tags_by_id(
    db: Session,
    group_ids: list[int],
) -> dict[int, list[SuiteGroupTagRead]]:
    tags_by_group = {group_id: [] for group_id in group_ids}
    if not group_ids:
        return tags_by_group

    visible_cases = group_test_cases_cte()
    rows = (
        db.query(
            visible_cases.c.group_id,
            TestCaseTag.id,
            TestCaseTag.category,
            TestCaseTag.name,
            func.count(func.distinct(visible_cases.c.test_case_id)).label("test_case_count"),
        )
        .join(
            TestCaseTagAssignment,
            TestCaseTagAssignment.test_case_id == visible_cases.c.test_case_id,
        )
        .join(TestCaseTag, TestCaseTag.id == TestCaseTagAssignment.tag_id)
        .filter(visible_cases.c.group_id.in_(group_ids))
        .group_by(
            visible_cases.c.group_id,
            TestCaseTag.id,
            TestCaseTag.category,
            TestCaseTag.name,
        )
        .order_by(
            visible_cases.c.group_id,
            TestCaseTag.category,
            TestCaseTag.name,
            TestCaseTag.id,
        )
        .all()
    )
    for row in rows:
        tags_by_group[row.group_id].append(
            SuiteGroupTagRead(
                id=row.id,
                category=row.category,
                name=row.name,
                test_case_count=int(row.test_case_count),
            )
        )
    return tags_by_group


def _load_options():
    return (
        selectinload(SuiteGroup.memberships),
        selectinload(SuiteGroup.test_case_memberships),
        selectinload(SuiteGroup.incoming_relations),
        selectinload(SuiteGroup.outgoing_relations),
    )


def _attach_group_tags(db: Session, groups: list[SuiteGroup]) -> list[SuiteGroup]:
    tags_by_group = group_tags_by_id(db, [group.id for group in groups])
    for group in groups:
        group.tags = tags_by_group[group.id]
    return groups


def list_groups(db: Session) -> list[SuiteGroup]:
    groups = (
        db.query(SuiteGroup)
        .options(*_load_options())
        .order_by(SuiteGroup.sort_order, SuiteGroup.name, SuiteGroup.id)
        .all()
    )
    return _attach_group_tags(db, groups)


def get_group(db: Session, group_id: int) -> SuiteGroup:
    group = (
        db.query(SuiteGroup)
        .options(*_load_options())
        .filter(SuiteGroup.id == group_id)
        .first()
    )
    if group is None:
        raise not_found("Skupina suit")
    return _attach_group_tags(db, [group])[0]


def _normalize_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Název skupiny je povinný.",
        )
    return normalized


def create_group(db: Session, payload: SuiteGroupCreate) -> SuiteGroup:
    group = SuiteGroup(
        name=_normalize_name(payload.name),
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(group)
    db.commit()
    return get_group(db, group.id)


def update_group(db: Session, group_id: int, payload: SuiteGroupUpdate) -> SuiteGroup:
    group = get_group(db, group_id)
    if payload.name is not None:
        group.name = _normalize_name(payload.name)
    if "description" in payload.model_fields_set:
        group.description = payload.description
    if payload.sort_order is not None:
        group.sort_order = payload.sort_order
    db.commit()
    return get_group(db, group.id)


def delete_group(db: Session, group_id: int) -> None:
    group = get_group(db, group_id)
    db.delete(group)
    db.commit()


def _lock_graph(db: Session) -> None:
    db.query(SuiteGroup.id).order_by(SuiteGroup.id).with_for_update().all()


def _validate_group_ids(db: Session, group_ids: list[int]) -> None:
    existing_ids = (
        {
            group_id
            for (group_id,) in db.query(SuiteGroup.id)
            .filter(SuiteGroup.id.in_(group_ids))
            .all()
        }
        if group_ids
        else set()
    )
    missing_ids = sorted(set(group_ids) - existing_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skupiny nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )


def _would_create_cycle(
    db: Session,
    parent_group_id: int,
    child_group_id: int,
) -> bool:
    if parent_group_id == child_group_id:
        return True
    adjacency: dict[int, set[int]] = {}
    for parent_id, child_id in db.query(
        SuiteGroupRelation.parent_group_id,
        SuiteGroupRelation.child_group_id,
    ).all():
        adjacency.setdefault(parent_id, set()).add(child_id)
    pending = [child_group_id]
    visited: set[int] = set()
    while pending:
        current = pending.pop()
        if current == parent_group_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        pending.extend(adjacency.get(current, ()))
    return False


def add_child(
    db: Session,
    parent_group_id: int,
    child_group_id: int,
    sort_order: int = 0,
) -> SuiteGroup:
    _lock_graph(db)
    _validate_group_ids(db, [parent_group_id, child_group_id])
    if db.get(SuiteGroupRelation, (parent_group_id, child_group_id)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Skupina už je pod tímto rodičem vložená.",
        )
    if _would_create_cycle(db, parent_group_id, child_group_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vazba by vytvořila cyklus mezi skupinami.",
        )
    db.add(
        SuiteGroupRelation(
            parent_group_id=parent_group_id,
            child_group_id=child_group_id,
            sort_order=sort_order,
        )
    )
    db.commit()
    return get_group(db, parent_group_id)


def remove_child(db: Session, parent_group_id: int, child_group_id: int) -> None:
    relation = db.get(SuiteGroupRelation, (parent_group_id, child_group_id))
    if relation is None:
        raise not_found("Vazba skupin")
    db.delete(relation)
    db.commit()


def set_group_parents(
    db: Session,
    group_id: int,
    parent_group_ids: list[int],
) -> SuiteGroup:
    normalized_ids = list(dict.fromkeys(parent_group_ids))
    if len(normalized_ids) != len(parent_group_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seznam rodičů obsahuje duplicitní ID.",
        )
    _lock_graph(db)
    _validate_group_ids(db, [group_id, *normalized_ids])

    current = {
        relation.parent_group_id: relation
        for relation in db.query(SuiteGroupRelation)
        .filter(SuiteGroupRelation.child_group_id == group_id)
        .all()
    }
    for relation in current.values():
        db.delete(relation)
    db.flush()

    for sort_order, parent_group_id in enumerate(normalized_ids):
        if _would_create_cycle(db, parent_group_id, group_id):
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vazba by vytvořila cyklus mezi skupinami.",
            )
        db.add(
            SuiteGroupRelation(
                parent_group_id=parent_group_id,
                child_group_id=group_id,
                sort_order=sort_order,
            )
        )
        db.flush()
    db.commit()
    return get_group(db, group_id)


def add_member(
    db: Session,
    group_id: int,
    payload: SuiteGroupMemberCreate,
) -> SuiteGroupMember:
    get_group(db, group_id)
    if db.get(TestSuite, payload.suite_id) is None:
        raise not_found("Test suite")
    existing = db.get(SuiteGroupMember, (group_id, payload.suite_id))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Test suite už je v této skupině.",
        )
    member = SuiteGroupMember(
        group_id=group_id,
        suite_id=payload.suite_id,
        sort_order=payload.sort_order,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_member(
    db: Session,
    group_id: int,
    suite_id: int,
    payload: SuiteGroupMemberUpdate,
) -> SuiteGroupMember:
    member = db.get(SuiteGroupMember, (group_id, suite_id))
    if member is None:
        raise not_found("Členství suity ve skupině")
    member.sort_order = payload.sort_order
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, group_id: int, suite_id: int) -> None:
    member = db.get(SuiteGroupMember, (group_id, suite_id))
    if member is None:
        raise not_found("Členství suity ve skupině")
    db.delete(member)
    db.commit()


def set_suite_groups(db: Session, suite_id: int, group_ids: list[int]) -> TestSuite:
    suite = db.get(TestSuite, suite_id)
    if suite is None:
        raise not_found("Test suite")
    normalized_ids = list(dict.fromkeys(group_ids))
    if len(normalized_ids) != len(group_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seznam skupin obsahuje duplicitní ID.",
        )
    _validate_group_ids(db, normalized_ids)

    current = {member.group_id: member for member in suite.group_memberships}
    for group_id, member in current.items():
        if group_id not in normalized_ids:
            db.delete(member)
    for sort_order, group_id in enumerate(normalized_ids):
        member = current.get(group_id)
        if member is None:
            db.add(
                SuiteGroupMember(
                    group_id=group_id,
                    suite_id=suite.id,
                    sort_order=sort_order,
                )
            )
        else:
            member.sort_order = sort_order
    db.commit()
    db.refresh(suite)
    suite.test_case_count = (
        db.query(func.count(TestCase.id))
        .filter(TestCase.suite_id == suite.id)
        .scalar()
        or 0
    )
    return suite


def set_group_test_cases(
    db: Session,
    group_id: int,
    test_case_ids: list[int],
) -> SuiteGroup:
    group = get_group(db, group_id)
    normalized_ids = list(dict.fromkeys(test_case_ids))
    if len(normalized_ids) != len(test_case_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seznam test cases obsahuje duplicitní ID.",
        )
    existing_ids = (
        {
            test_case_id
            for (test_case_id,) in db.query(TestCase.id)
            .filter(TestCase.id.in_(normalized_ids))
            .all()
        }
        if normalized_ids
        else set()
    )
    missing_ids = sorted(set(normalized_ids) - existing_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test cases nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )

    current = {
        member.test_case_id: member for member in group.test_case_memberships
    }
    group.test_case_memberships[:] = [
        current[test_case_id]
        if test_case_id in current
        else SuiteGroupTestCaseMember(test_case_id=test_case_id)
        for test_case_id in normalized_ids
    ]
    for sort_order, member in enumerate(group.test_case_memberships):
        member.sort_order = sort_order
    db.commit()
    return get_group(db, group.id)
