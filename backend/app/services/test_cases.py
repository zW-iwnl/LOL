from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestCaseTagAssignment, TestStep, User
from app.schemas.test_case import TestCaseCreate, TestCaseUpdate, TestStepCreate, TestStepUpdate
from app.services.common import apply_updates, not_found
from app.services.test_suites import get_suite
from app.services.test_case_tags import validate_tag, validate_tag_ids, validate_tags

VERSIONED_TEST_CASE_FIELDS = {
    "code",
    "title",
    "description",
    "preconditions",
    "expected_summary",
    "status",
    "automated",
    "tag_ids",
}


def _load_options():
    return (
        selectinload(TestCase.steps),
        selectinload(TestCase.tag_assignments).selectinload(TestCaseTagAssignment.tag),
    )


def list_test_cases(
    db: Session,
    suite_id: int | None = None,
    business_area_ids: list[int] | None = None,
    application_domain_ids: list[int] | None = None,
    object_type_ids: list[int] | None = None,
) -> list[TestCase]:
    filters = (
        (business_area_ids or [], "business_area"),
        (application_domain_ids or [], "application_domain"),
        (object_type_ids or [], "object_type"),
    )
    query = db.query(TestCase).options(*_load_options())
    for tag_ids, category in filters:
        if not tag_ids:
            continue
        validate_tags(db, tag_ids, category)
        query = query.filter(
            TestCase.tag_assignments.any(TestCaseTagAssignment.tag_id.in_(tag_ids))
        )
    if suite_id is not None:
        query = query.filter(TestCase.suite_id == suite_id)
    return query.order_by(TestCase.code).all()


def get_test_case(db: Session, test_case_id: int) -> TestCase:
    test_case = (
        db.query(TestCase)
        .options(*_load_options())
        .filter(TestCase.id == test_case_id)
        .first()
    )
    if test_case is None:
        raise not_found("Test case")
    return test_case


def _validate_suite(db: Session, suite_id: int | None) -> None:
    if suite_id is None:
        return
    get_suite(db, suite_id)


TAG_INPUT_FIELDS = {
    "tag_ids",
    "business_area_id",
    "application_domain_id",
    "object_type_id",
}


def _requested_tag_ids(db: Session, payload: TestCaseCreate | TestCaseUpdate) -> list[int] | None:
    if "tag_ids" in payload.model_fields_set:
        tag_ids = payload.tag_ids or []
        validate_tag_ids(db, tag_ids)
        return tag_ids

    legacy_fields = (
        ("business_area_id", "business_area"),
        ("application_domain_id", "application_domain"),
        ("object_type_id", "object_type"),
    )
    tag_ids: list[int] = []
    legacy_was_set = False
    for field, category in legacy_fields:
        if field not in payload.model_fields_set:
            continue
        legacy_was_set = True
        tag_id = getattr(payload, field)
        validate_tag(db, tag_id, category)
        if tag_id is not None:
            tag_ids.append(tag_id)
    return tag_ids if legacy_was_set else None


def _set_tag_assignments(test_case: TestCase, tag_ids: list[int]) -> None:
    current = {assignment.tag_id: assignment for assignment in test_case.tag_assignments}
    requested = set(tag_ids)
    test_case.tag_assignments[:] = [
        current[tag_id] if tag_id in current else TestCaseTagAssignment(tag_id=tag_id)
        for tag_id in tag_ids
    ]
    for assignment in current.values():
        if assignment.tag_id not in requested and assignment in test_case.tag_assignments:
            test_case.tag_assignments.remove(assignment)


def create_test_case(db: Session, payload: TestCaseCreate, current_user: User) -> TestCase:
    _validate_suite(db, payload.suite_id)
    tag_ids = _requested_tag_ids(db, payload) or []
    if db.query(TestCase).filter(TestCase.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód test case už existuje.")
    data = payload.model_dump(exclude={"steps", *TAG_INPUT_FIELDS})
    test_case = TestCase(**data, created_by=current_user.id)
    _set_tag_assignments(test_case, tag_ids)
    db.add(test_case)
    db.flush()
    for step in payload.steps:
        db.add(TestStep(**step.model_dump(), test_case_id=test_case.id))
    db.commit()
    return get_test_case(db, test_case.id)


def update_test_case(
    db: Session,
    test_case_id: int,
    payload: TestCaseUpdate,
    current_user: User | None = None,
) -> TestCase:
    test_case = get_test_case(db, test_case_id)
    requested_tag_ids = _requested_tag_ids(db, payload)
    if "suite_id" in payload.model_fields_set and payload.suite_id is not None:
        _validate_suite(db, payload.suite_id)
    if payload.code and payload.code != test_case.code:
        existing = db.query(TestCase).filter(
            TestCase.code == payload.code,
            TestCase.id != test_case_id,
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód test case už existuje.")

    updates = payload.model_dump(exclude_unset=True, exclude=TAG_INPUT_FIELDS)
    changed = any(getattr(test_case, field) != value for field, value in updates.items())
    tags_changed = (
        requested_tag_ids is not None
        and set(requested_tag_ids) != set(test_case.tag_ids)
    )
    if changed or tags_changed:
        test_case.version += 1
    for field, value in updates.items():
        setattr(test_case, field, value)
    if requested_tag_ids is not None:
        _set_tag_assignments(test_case, requested_tag_ids)
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
    apply_updates(step, payload)
    if payload.step_type == "information":
        step.expected_result = None
        step.test_data = None
    db.commit()
    db.refresh(step)
    return step


def delete_step(db: Session, step_id: int, current_user: User | None = None) -> None:
    step = db.get(TestStep, step_id)
    if step is None:
        raise not_found("Test step")
    test_case = get_test_case(db, step.test_case_id)
    test_case.version += 1
    db.delete(step)
    db.commit()
