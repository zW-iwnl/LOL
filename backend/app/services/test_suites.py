from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import TestSuite, User
from app.schemas.test_suite import TestSuiteCreate, TestSuiteUpdate
from app.services.common import apply_updates, get_project_or_404, not_found


def list_suites(db: Session, project_id: int) -> list[TestSuite]:
    get_project_or_404(db, project_id)
    return (
        db.query(TestSuite)
        .filter(TestSuite.project_id == project_id)
        .order_by(TestSuite.path, TestSuite.sort_order, TestSuite.name)
        .all()
    )


def get_suite(db: Session, suite_id: int) -> TestSuite:
    suite = db.get(TestSuite, suite_id)
    if suite is None:
        raise not_found("Test suite")
    return suite


def _validate_parent(db: Session, project_id: int, parent_suite_id: int | None) -> TestSuite | None:
    if parent_suite_id is None:
        return None
    parent = get_suite(db, parent_suite_id)
    if parent.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent suite patří do jiného projektu.")
    return parent


def _path_for(payload: TestSuiteCreate | TestSuiteUpdate, parent: TestSuite | None, current: TestSuite | None = None) -> str:
    name = payload.name if payload.name is not None else current.name if current else ""
    if payload.path:
        return payload.path
    prefix = parent.path if parent else ""
    return f"{prefix}/{name}".replace("//", "/")


def create_suite(db: Session, project_id: int, payload: TestSuiteCreate, current_user: User) -> TestSuite:
    get_project_or_404(db, project_id)
    parent = _validate_parent(db, project_id, payload.parent_suite_id)
    data = payload.model_dump()
    data["path"] = _path_for(payload, parent)
    data["level"] = parent.level + 1 if parent else data["level"]
    suite = TestSuite(**data, project_id=project_id, created_by=current_user.id)
    db.add(suite)
    db.commit()
    db.refresh(suite)
    return suite


def update_suite(db: Session, suite_id: int, payload: TestSuiteUpdate) -> TestSuite:
    suite = get_suite(db, suite_id)
    parent_id = payload.parent_suite_id if payload.parent_suite_id is not None else suite.parent_suite_id
    if parent_id == suite.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suite nemůže být vlastním rodičem.")
    parent = _validate_parent(db, suite.project_id, parent_id)
    apply_updates(suite, payload)
    suite.path = _path_for(payload, parent, suite)
    if payload.parent_suite_id is not None:
        suite.level = parent.level + 1 if parent else 0
    db.commit()
    db.refresh(suite)
    return suite


def delete_suite(db: Session, suite_id: int) -> None:
    suite = get_suite(db, suite_id)
    db.delete(suite)
    db.commit()


def search_suites(db: Session, project_id: int, query: str) -> list[TestSuite]:
    get_project_or_404(db, project_id)
    if len(query.strip()) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vyhledávání vyžaduje alespoň 2 znaky.")
    return (
        db.query(TestSuite)
        .filter(TestSuite.project_id == project_id, TestSuite.name.ilike(f"%{query.strip()}%"))
        .order_by(TestSuite.path)
        .all()
    )


def get_children(db: Session, suite_id: int) -> list[TestSuite]:
    suite = get_suite(db, suite_id)
    return (
        db.query(TestSuite)
        .filter(TestSuite.parent_suite_id == suite.id)
        .order_by(TestSuite.sort_order, TestSuite.name)
        .all()
    )


def get_suite_tree(db: Session, project_id: int) -> list[dict]:
    suites = list_suites(db, project_id)
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
            "project_id": suite.project_id,
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
