from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestCaseTagAssignment, TestRunCase, TestStep, User
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
    from app.schemas.test_case_workflow import ProposalCreate, DraftContent
    from app.services.test_case_versions import create_proposal
    if payload.status != "draft":
        raise HTTPException(422, "Nový test case vzniká jako návrh. Stav ready získá až schválením.")
    content = payload.model_dump(exclude={"suite_id", "code", "status"})
    content["tag_ids"] = _requested_tag_ids(db, payload) or []
    draft = create_proposal(db, ProposalCreate(suite_id=payload.suite_id, code=payload.code,
                                               content=DraftContent.model_validate(content)), current_user)
    db.commit()
    return get_test_case(db, draft.test_case_id)



def update_test_case(
    db: Session,
    test_case_id: int,
    payload: TestCaseUpdate,
    current_user: User | None = None,
) -> TestCase:
    if payload.model_fields_set == {"suite_id"}:
        from app.services.test_case_versions import lock_case, event
        case = lock_case(db, test_case_id)
        _validate_suite(db, payload.suite_id)
        case.suite_id = payload.suite_id
        if current_user:
            event(db, case.id, current_user, "suite_moved", suite_id=payload.suite_id)
        db.commit()
        return get_test_case(db, case.id)
    raise HTTPException(409, "Obsah se upravuje v návrhu nové verze, nikoli přímo. Otevřete detail test case a návrh.")



def delete_test_case(db: Session, test_case_id: int) -> None:
    from app.services.test_case_versions import lock_case
    test_case = lock_case(db, test_case_id)
    test_case.status = "deprecated"
    db.commit()



def create_step(db: Session, test_case_id: int, payload: TestStepCreate, current_user: User | None = None) -> TestStep:
    raise HTTPException(409, "Kroky upravujte atomicky v návrhu nové verze.")



def update_step(db: Session, step_id: int, payload: TestStepUpdate, current_user: User | None = None) -> TestStep:
    raise HTTPException(409, "Kroky upravujte atomicky v návrhu nové verze.")



def delete_step(db: Session, step_id: int, current_user: User | None = None) -> None:
    raise HTTPException(409, "Kroky upravujte atomicky v návrhu nové verze.")
