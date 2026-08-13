from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestStep, User
from app.schemas.test_case import TestCaseCreate, TestCaseUpdate, TestStepCreate, TestStepUpdate
from app.services.audit import record_event
from app.services.common import apply_updates, get_project_or_404, not_found
from app.services.test_suites import get_suite

VERSIONED_TEST_CASE_FIELDS = {
    "code",
    "title",
    "description",
    "preconditions",
    "expected_summary",
    "priority",
    "type",
    "status",
    "automated",
}


def list_test_cases(db: Session, project_id: int | None = None, suite_id: int | None = None) -> list[TestCase]:
    query = db.query(TestCase).options(selectinload(TestCase.steps))
    if project_id is not None:
        get_project_or_404(db, project_id)
        query = query.filter(TestCase.project_id == project_id)
    if suite_id is not None:
        query = query.filter(TestCase.suite_id == suite_id)
    return query.order_by(TestCase.project_id, TestCase.code).all()


def get_test_case(db: Session, test_case_id: int) -> TestCase:
    test_case = (
        db.query(TestCase)
        .options(selectinload(TestCase.steps))
        .filter(TestCase.id == test_case_id)
        .first()
    )
    if test_case is None:
        raise not_found("Test case")
    return test_case


def _validate_suite(db: Session, project_id: int, suite_id: int | None) -> None:
    if suite_id is None:
        return
    suite = get_suite(db, suite_id)
    if suite.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test suite patří do jiného projektu.")


def create_test_case(db: Session, project_id: int, payload: TestCaseCreate, current_user: User) -> TestCase:
    get_project_or_404(db, project_id)
    _validate_suite(db, project_id, payload.suite_id)
    if db.query(TestCase).filter(TestCase.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód test case už existuje.")
    data = payload.model_dump(exclude={"steps"})
    test_case = TestCase(**data, project_id=project_id, created_by=current_user.id)
    db.add(test_case)
    db.flush()
    for step in payload.steps:
        db.add(TestStep(**step.model_dump(), test_case_id=test_case.id))
    record_event(
        db,
        entity_type="TestCase",
        entity_id=test_case.id,
        action="created",
        actor=current_user,
        changes=payload.model_dump(),
    )
    db.commit()
    return get_test_case(db, test_case.id)


def update_test_case(db: Session, test_case_id: int, payload: TestCaseUpdate, current_user: User | None = None) -> TestCase:
    test_case = get_test_case(db, test_case_id)
    if payload.suite_id is not None:
        _validate_suite(db, test_case.project_id, payload.suite_id)
    if payload.code and payload.code != test_case.code:
        existing = db.query(TestCase).filter(TestCase.code == payload.code, TestCase.id != test_case_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód test case už existuje.")
    changes = {}
    for field, new_value in payload.model_dump(exclude_unset=True).items():
        old_value = getattr(test_case, field)
        if old_value != new_value:
            changes[field] = {"from": old_value, "to": new_value}
    if set(changes).intersection(VERSIONED_TEST_CASE_FIELDS):
        test_case.version += 1
    apply_updates(test_case, payload)
    if changes:
        record_event(
            db,
            entity_type="TestCase",
            entity_id=test_case.id,
            action="updated",
            actor=current_user,
            changes=changes,
        )
    db.commit()
    return get_test_case(db, test_case.id)


def delete_test_case(db: Session, test_case_id: int) -> None:
    test_case = get_test_case(db, test_case_id)
    db.delete(test_case)
    db.commit()


def create_step(db: Session, test_case_id: int, payload: TestStepCreate, current_user: User | None = None) -> TestStep:
    test_case = get_test_case(db, test_case_id)
    test_case.version += 1
    step = TestStep(**payload.model_dump(), test_case_id=test_case_id)
    db.add(step)
    db.flush()
    record_event(
        db,
        entity_type="TestCase",
        entity_id=test_case.id,
        action="step_created",
        actor=current_user,
        changes=payload.model_dump(),
    )
    db.commit()
    db.refresh(step)
    return step


def update_step(db: Session, step_id: int, payload: TestStepUpdate, current_user: User | None = None) -> TestStep:
    step = db.get(TestStep, step_id)
    if step is None:
        raise not_found("Test step")
    test_case = get_test_case(db, step.test_case_id)
    changes = {}
    for field, new_value in payload.model_dump(exclude_unset=True).items():
        old_value = getattr(step, field)
        if old_value != new_value:
            changes[field] = {"from": old_value, "to": new_value}
    if changes:
        test_case.version += 1
        record_event(
            db,
            entity_type="TestCase",
            entity_id=test_case.id,
            action="step_updated",
            actor=current_user,
            changes={"step_id": step.id, "changes": changes},
        )
    apply_updates(step, payload)
    db.commit()
    db.refresh(step)
    return step


def delete_step(db: Session, step_id: int, current_user: User | None = None) -> None:
    step = db.get(TestStep, step_id)
    if step is None:
        raise not_found("Test step")
    test_case = get_test_case(db, step.test_case_id)
    test_case.version += 1
    record_event(
        db,
        entity_type="TestCase",
        entity_id=test_case.id,
        action="step_deleted",
        actor=current_user,
        changes={"step_id": step.id},
    )
    db.delete(step)
    db.commit()
