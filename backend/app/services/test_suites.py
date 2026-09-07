from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestSuite, User
from app.schemas.test_suite import TestSuiteCreate, TestSuiteUpdate
from app.services import suite_groups as group_service
from app.services.common import not_found


def _load_options():
    return (selectinload(TestSuite.group_memberships),)


def _attach_counts(db: Session, suites: list[TestSuite]) -> list[TestSuite]:
    suite_ids = [suite.id for suite in suites]
    counts = (
        dict(
            db.query(TestCase.suite_id, func.count(TestCase.id))
            .filter(TestCase.suite_id.in_(suite_ids))
            .group_by(TestCase.suite_id)
            .all()
        )
        if suite_ids
        else {}
    )
    for suite in suites:
        suite.test_case_count = int(counts.get(suite.id, 0))
    return suites


def list_suites(db: Session) -> list[TestSuite]:
    suites = (
        db.query(TestSuite)
        .options(*_load_options())
        .order_by(TestSuite.sort_order, TestSuite.name, TestSuite.id)
        .all()
    )
    return _attach_counts(db, suites)


def get_suite(db: Session, suite_id: int) -> TestSuite:
    suite = (
        db.query(TestSuite)
        .options(*_load_options())
        .filter(TestSuite.id == suite_id)
        .first()
    )
    if suite is None:
        raise not_found("Test suite")
    return _attach_counts(db, [suite])[0]


def create_suite(db: Session, payload: TestSuiteCreate, current_user: User) -> TestSuite:
    data = payload.model_dump(exclude={"group_ids"})
    data["name"] = data["name"].strip()
    suite = TestSuite(**data, created_by=current_user.id)
    db.add(suite)
    db.flush()
    if payload.group_ids:
        return group_service.set_suite_groups(db, suite.id, payload.group_ids)
    db.commit()
    return get_suite(db, suite.id)


def update_suite(db: Session, suite_id: int, payload: TestSuiteUpdate) -> TestSuite:
    suite = get_suite(db, suite_id)
    for field, value in payload.model_dump(exclude_unset=True, exclude={"group_ids"}).items():
        setattr(suite, field, value.strip() if field == "name" else value)
    if "group_ids" in payload.model_fields_set:
        return group_service.set_suite_groups(db, suite.id, payload.group_ids or [])
    db.commit()
    return get_suite(db, suite.id)


def delete_suite(db: Session, suite_id: int) -> None:
    suite = get_suite(db, suite_id)
    if suite.test_case_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nelze smazat suitu, která obsahuje test cases.",
        )
    db.delete(suite)
    db.commit()


def search_suites(db: Session, query: str) -> list[TestSuite]:
    normalized_query = query.strip().casefold()
    if len(normalized_query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vyhledávání vyžaduje alespoň 2 znaky.",
        )
    return [
        suite
        for suite in list_suites(db)
        if normalized_query in suite.name.casefold()
        or normalized_query in (suite.description or "").casefold()
    ]


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
