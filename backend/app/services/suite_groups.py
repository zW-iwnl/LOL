from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import (
    SuiteGroup,
    SuiteGroupMember,
    SuiteGroupTestCaseMember,
    TestCase,
    TestSuite,
)
from app.schemas.suite_group import (
    SuiteGroupCreate,
    SuiteGroupMemberCreate,
    SuiteGroupMemberUpdate,
    SuiteGroupUpdate,
)
from app.services.common import not_found


def list_groups(db: Session) -> list[SuiteGroup]:
    return (
        db.query(SuiteGroup)
        .options(
            selectinload(SuiteGroup.memberships),
            selectinload(SuiteGroup.test_case_memberships),
        )
        .order_by(SuiteGroup.sort_order, SuiteGroup.name, SuiteGroup.id)
        .all()
    )


def get_group(db: Session, group_id: int) -> SuiteGroup:
    group = (
        db.query(SuiteGroup)
        .options(
            selectinload(SuiteGroup.memberships),
            selectinload(SuiteGroup.test_case_memberships),
        )
        .filter(SuiteGroup.id == group_id)
        .first()
    )
    if group is None:
        raise not_found("Skupina suit")
    return group


def _normalize_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Název skupiny je povinný.",
        )
    return normalized


def _validate_parent(db: Session, parent_group_id: int | None) -> SuiteGroup | None:
    if parent_group_id is None:
        return None
    return get_group(db, parent_group_id)


def _ensure_unique_name(
    db: Session,
    parent_group_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> None:
    query = db.query(SuiteGroup).filter(func.lower(SuiteGroup.name) == name.casefold())
    if parent_group_id is None:
        query = query.filter(SuiteGroup.parent_group_id.is_(None))
    else:
        query = query.filter(SuiteGroup.parent_group_id == parent_group_id)
    if exclude_id is not None:
        query = query.filter(SuiteGroup.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Skupina se stejným názvem už na této úrovni existuje.",
        )


def _is_descendant(db: Session, group: SuiteGroup, candidate_parent_id: int) -> bool:
    current = db.get(SuiteGroup, candidate_parent_id)
    visited: set[int] = set()
    while current is not None and current.id not in visited:
        if current.id == group.id:
            return True
        visited.add(current.id)
        current = db.get(SuiteGroup, current.parent_group_id) if current.parent_group_id else None
    return False


def create_group(db: Session, payload: SuiteGroupCreate) -> SuiteGroup:
    name = _normalize_name(payload.name)
    _validate_parent(db, payload.parent_group_id)
    _ensure_unique_name(db, payload.parent_group_id, name)
    group = SuiteGroup(
        parent_group_id=payload.parent_group_id,
        name=name,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(group)
    db.commit()
    return get_group(db, group.id)


def update_group(db: Session, group_id: int, payload: SuiteGroupUpdate) -> SuiteGroup:
    group = get_group(db, group_id)
    parent_group_id = (
        payload.parent_group_id
        if "parent_group_id" in payload.model_fields_set
        else group.parent_group_id
    )
    if parent_group_id == group.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skupina nemůže být vlastním rodičem.",
        )
    if parent_group_id is not None and _is_descendant(db, group, parent_group_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skupinu nelze přesunout pod vlastní podskupinu.",
        )
    _validate_parent(db, parent_group_id)

    name = _normalize_name(payload.name) if payload.name is not None else group.name
    _ensure_unique_name(db, parent_group_id, name, exclude_id=group.id)
    group.parent_group_id = parent_group_id
    group.name = name
    if "description" in payload.model_fields_set:
        group.description = payload.description
    if payload.sort_order is not None:
        group.sort_order = payload.sort_order
    db.commit()
    return get_group(db, group.id)


def delete_group(db: Session, group_id: int) -> None:
    group = get_group(db, group_id)
    if db.query(SuiteGroup.id).filter(SuiteGroup.parent_group_id == group.id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Skupinu s podskupinami nelze smazat.",
        )
    db.delete(group)
    db.commit()


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
    existing_group_ids = {
        group_id
        for (group_id,) in db.query(SuiteGroup.id).filter(SuiteGroup.id.in_(normalized_ids)).all()
    } if normalized_ids else set()
    missing_ids = sorted(set(normalized_ids) - existing_group_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skupiny nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )

    current = {member.group_id: member for member in suite.group_memberships}
    for group_id, member in current.items():
        if group_id not in existing_group_ids:
            db.delete(member)
    for sort_order, group_id in enumerate(normalized_ids):
        member = current.get(group_id)
        if member is None:
            db.add(SuiteGroupMember(group_id=group_id, suite_id=suite.id, sort_order=sort_order))
        else:
            member.sort_order = sort_order
    db.commit()
    db.refresh(suite)
    return suite


def get_group_tree(db: Session) -> list[dict]:
    groups = list_groups(db)
    nodes = {group.id: {"group": group, "children": []} for group in groups}
    roots: list[dict] = []
    for group in groups:
        node = nodes[group.id]
        if group.parent_group_id in nodes:
            nodes[group.parent_group_id]["children"].append(node)
        else:
            roots.append(node)

    def serialize(node: dict) -> dict:
        group = node["group"]
        return {
            "id": group.id,
            "parent_group_id": group.parent_group_id,
            "name": group.name,
            "description": group.description,
            "sort_order": group.sort_order,
            "created_at": group.created_at,
            "updated_at": group.updated_at,
            "members": group.memberships,
            "test_case_members": group.test_case_memberships,
            "children": [serialize(child) for child in node["children"]],
        }

    return [serialize(root) for root in roots]


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
    existing_ids = {
        test_case_id
        for (test_case_id,) in db.query(TestCase.id).filter(
            TestCase.id.in_(normalized_ids)
        ).all()
    } if normalized_ids else set()
    missing_ids = sorted(set(normalized_ids) - existing_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test cases nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )

    current = {
        member.test_case_id: member
        for member in group.test_case_memberships
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
