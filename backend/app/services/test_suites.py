from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestSuite, User
from app.schemas.test_suite import TestSuiteCreate, TestSuiteUpdate
from app.services.common import not_found
from app.services import suite_groups as group_service


def list_suites(db: Session) -> list[TestSuite]:
    suites = (
        db.query(TestSuite)
        .options(selectinload(TestSuite.group_memberships))
        .order_by(TestSuite.path, TestSuite.sort_order, TestSuite.name)
        .all()
    )
    direct_counts = dict(
        db.query(TestCase.suite_id, func.count(TestCase.id))
        .filter(TestCase.suite_id.isnot(None))
        .group_by(TestCase.suite_id)
        .all()
    )
    total_counts = {suite.id: direct_counts.get(suite.id, 0) for suite in suites}
    for suite in sorted(suites, key=lambda item: item.level, reverse=True):
        if suite.parent_suite_id in total_counts:
            total_counts[suite.parent_suite_id] += total_counts[suite.id]
    for suite in suites:
        suite.direct_test_case_count = direct_counts.get(suite.id, 0)
        suite.total_test_case_count = total_counts[suite.id]
    return suites


def get_suite(db: Session, suite_id: int) -> TestSuite:
    suite = (
        db.query(TestSuite)
        .options(selectinload(TestSuite.group_memberships))
        .filter(TestSuite.id == suite_id)
        .first()
    )
    if suite is None:
        raise not_found("Test suite")
    return suite


def _validate_parent(db: Session, parent_suite_id: int | None) -> TestSuite | None:
    if parent_suite_id is None:
        return None
    return get_suite(db, parent_suite_id)


def _path_for(payload: TestSuiteCreate | TestSuiteUpdate, parent: TestSuite | None, current: TestSuite | None = None) -> str:
    name = payload.name if payload.name is not None else current.name if current else ""
    if payload.path:
        return payload.path
    prefix = parent.path if parent else ""
    return f"{prefix}/{name}".replace("//", "/")


def _is_descendant(db: Session, suite: TestSuite, parent_id: int) -> bool:
    current = db.get(TestSuite, parent_id)
    while current is not None:
        if current.id == suite.id:
            return True
        current = db.get(TestSuite, current.parent_suite_id) if current.parent_suite_id else None
    return False


def _update_descendant_paths(db: Session, suite: TestSuite) -> None:
    children = (
        db.query(TestSuite)
        .filter(TestSuite.parent_suite_id == suite.id)
        .order_by(TestSuite.sort_order, TestSuite.name)
        .all()
    )
    for child in children:
        child.path = f"{suite.path}/{child.name}".replace("//", "/")
        child.level = suite.level + 1
        _update_descendant_paths(db, child)


def create_suite(db: Session, payload: TestSuiteCreate, current_user: User) -> TestSuite:
    parent = _validate_parent(db, payload.parent_suite_id)
    data = payload.model_dump(exclude={"group_ids"})
    data["path"] = _path_for(payload, parent)
    data["level"] = parent.level + 1 if parent else data["level"]
    suite = TestSuite(**data, created_by=current_user.id)
    db.add(suite)
    db.flush()
    if payload.group_ids:
        return group_service.set_suite_groups(db, suite.id, payload.group_ids)
    db.commit()
    return get_suite(db, suite.id)


def update_suite(db: Session, suite_id: int, payload: TestSuiteUpdate) -> TestSuite:
    suite = get_suite(db, suite_id)
    parent_id = (
        payload.parent_suite_id
        if "parent_suite_id" in payload.model_fields_set
        else suite.parent_suite_id
    )
    if parent_id == suite.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suite nemůže být vlastním rodičem.")
    if parent_id is not None and _is_descendant(db, suite, parent_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suite nelze přesunout pod vlastní podstrom.")
    parent = _validate_parent(db, parent_id)
    for field, value in payload.model_dump(exclude_unset=True, exclude={"group_ids"}).items():
        setattr(suite, field, value)
    suite.path = _path_for(payload, parent, suite)
    if "parent_suite_id" in payload.model_fields_set:
        suite.level = parent.level + 1 if parent else 0
    _update_descendant_paths(db, suite)
    if "group_ids" in payload.model_fields_set:
        return group_service.set_suite_groups(db, suite.id, payload.group_ids or [])
    db.commit()
    return get_suite(db, suite.id)


def delete_suite(db: Session, suite_id: int) -> None:
    suite = get_suite(db, suite_id)
    child_count = db.query(TestSuite).filter(TestSuite.parent_suite_id == suite.id).count()
    if child_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nelze smazat suitu, která obsahuje podsuity.")
    if suite.test_cases:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nelze smazat suitu, která obsahuje test cases.")
    db.delete(suite)
    db.commit()


def search_suites(db: Session, query: str) -> list[TestSuite]:
    normalized_query = query.strip().casefold()
    if len(normalized_query) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vyhledávání vyžaduje alespoň 2 znaky.")
    return [
        suite
        for suite in list_suites(db)
        if normalized_query in suite.name.casefold() or normalized_query in suite.path.casefold()
    ]


def get_children(db: Session, suite_id: int) -> list[TestSuite]:
    suite = get_suite(db, suite_id)
    return (
        db.query(TestSuite)
        .filter(TestSuite.parent_suite_id == suite.id)
        .order_by(TestSuite.sort_order, TestSuite.name)
        .all()
    )


def get_suite_tree(db: Session) -> list[dict]:
    suites = list_suites(db)
    nodes = {suite.id: {"suite": suite, "children": []} for suite in suites}
    roots: list[dict] = []
    for suite in suites:
        node = nodes[suite.id]
        if suite.parent_suite_id and suite.parent_suite_id in nodes:
            nodes[suite.parent_suite_id]["children"].append(node)
        else:
            roots.append(node)

    def serialize(node: dict) -> dict:
        suite = node["suite"]
        data = {
            "id": suite.id,
            "parent_suite_id": suite.parent_suite_id,
            "name": suite.name,
            "description": suite.description,
            "path": suite.path,
            "level": suite.level,
            "sort_order": suite.sort_order,
            "is_active": suite.is_active,
            "created_by": suite.created_by,
            "created_at": suite.created_at,
            "updated_at": suite.updated_at,
            "direct_test_case_count": suite.direct_test_case_count,
            "total_test_case_count": suite.total_test_case_count,
            "group_ids": suite.group_ids,
            "children": [serialize(child) for child in node["children"]],
        }
        return data

    return [serialize(root) for root in roots]


def get_suite_test_cases(db: Session, suite_id: int):
    suite = (
        db.query(TestSuite)
        .options(selectinload(TestSuite.test_cases))
        .filter(TestSuite.id == suite_id)
        .first()
    )
    if suite is None:
        raise not_found("Test suite")
    return suite.test_cases
