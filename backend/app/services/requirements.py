from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Requirement, TestCase, TestCaseTagAssignment, TestRunCase, TestRunCaseAttempt, User
from app.schemas.requirement import (
    RequirementCreate,
    RequirementLinkTestCasesRequest,
    RequirementUpdate,
    TraceabilityRow,
    TraceabilityTestCase,
)
from app.services.common import apply_updates, not_found


def list_requirements(db: Session) -> list[Requirement]:
    return (
        db.query(Requirement)
        .options(
            selectinload(Requirement.test_cases).selectinload(TestCase.steps),
            selectinload(Requirement.test_cases)
            .selectinload(TestCase.tag_assignments)
            .selectinload(TestCaseTagAssignment.tag),
        )
        .order_by(Requirement.code)
        .all()
    )


def get_requirement(db: Session, requirement_id: int) -> Requirement:
    requirement = (
        db.query(Requirement)
        .options(
            selectinload(Requirement.test_cases).selectinload(TestCase.steps),
            selectinload(Requirement.test_cases)
            .selectinload(TestCase.tag_assignments)
            .selectinload(TestCaseTagAssignment.tag),
        )
        .filter(Requirement.id == requirement_id)
        .first()
    )
    if requirement is None:
        raise not_found("Requirement")
    return requirement


def create_requirement(db: Session, payload: RequirementCreate, current_user: User) -> Requirement:
    if db.query(Requirement).filter(Requirement.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód requirementu už existuje.")

    data = payload.model_dump(exclude={"test_case_ids"})
    requirement = Requirement(**data, created_by=current_user.id)
    db.add(requirement)
    db.flush()
    if payload.test_case_ids:
        _link_test_cases(db, requirement, payload.test_case_ids)
    db.commit()
    return get_requirement(db, requirement.id)


def update_requirement(db: Session, requirement_id: int, payload: RequirementUpdate) -> Requirement:
    requirement = get_requirement(db, requirement_id)
    if payload.code and payload.code != requirement.code:
        existing = (
            db.query(Requirement)
            .filter(
                Requirement.code == payload.code,
                Requirement.id != requirement_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód requirementu už existuje.")
    apply_updates(requirement, payload)
    db.commit()
    return get_requirement(db, requirement.id)


def delete_requirement(db: Session, requirement_id: int) -> None:
    requirement = get_requirement(db, requirement_id)
    db.delete(requirement)
    db.commit()


def link_test_cases(db: Session, requirement_id: int, payload: RequirementLinkTestCasesRequest) -> Requirement:
    requirement = get_requirement(db, requirement_id)
    _link_test_cases(db, requirement, payload.test_case_ids)
    db.commit()
    return get_requirement(db, requirement.id)


def unlink_test_case(db: Session, requirement_id: int, test_case_id: int) -> None:
    requirement = get_requirement(db, requirement_id)
    test_case = next((item for item in requirement.test_cases if item.id == test_case_id), None)
    if test_case is None:
        raise not_found("Test case u requirementu")
    requirement.test_cases.remove(test_case)
    db.commit()


def get_traceability_matrix(db: Session) -> list[TraceabilityRow]:
    requirements = (
        db.query(Requirement)
        .options(selectinload(Requirement.test_cases))
        .order_by(Requirement.code)
        .all()
    )
    all_test_case_ids = {
        test_case.id
        for requirement in requirements
        for test_case in requirement.test_cases
    }
    latest_results = _latest_results_by_test_case(db, all_test_case_ids)

    rows: list[TraceabilityRow] = []
    for requirement in requirements:
        test_case_ids = [test_case.id for test_case in requirement.test_cases]
        requirement_results = {
            test_case_id: latest_results[test_case_id]
            for test_case_id in test_case_ids
            if test_case_id in latest_results
        }
        latest_result = _latest_result(requirement_results)
        tested_case_count = len(requirement_results)
        failed_case_count = sum(1 for result in requirement_results.values() if result.result == "failed")
        blocked_case_count = sum(1 for result in requirement_results.values() if result.result == "blocked")
        rows.append(
            TraceabilityRow(
                requirement_id=requirement.id,
                requirement_code=requirement.code,
                requirement_title=requirement.title,
                requirement_priority=requirement.priority,
                requirement_status=requirement.status,
                test_cases=[
                    TraceabilityTestCase(
                        id=test_case.id,
                        code=test_case.code,
                        title=test_case.title,
                        status=test_case.status,
                    )
                    for test_case in requirement.test_cases
                ],
                coverage_status="covered" if test_case_ids else "missing_tests",
                risk_status=_traceability_risk_status(
                    total_case_count=len(test_case_ids),
                    tested_case_count=tested_case_count,
                    failed_case_count=failed_case_count,
                    blocked_case_count=blocked_case_count,
                ),
                tested_case_count=tested_case_count,
                failed_case_count=failed_case_count,
                blocked_case_count=blocked_case_count,
                latest_result=latest_result.result if latest_result else None,
                latest_executed_at=latest_result.executed_at if latest_result else None,
            )
        )
    return rows


def _link_test_cases(db: Session, requirement: Requirement, test_case_ids: list[int]) -> None:
    test_cases = (
        db.query(TestCase)
        .filter(TestCase.id.in_(test_case_ids))
        .all()
    )
    found_ids = {test_case.id for test_case in test_cases}
    missing_ids = sorted(set(test_case_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test cases neexistují: {missing_ids}",
        )

    existing_ids = {test_case.id for test_case in requirement.test_cases}
    for test_case in test_cases:
        if test_case.id not in existing_ids:
            requirement.test_cases.append(test_case)


def _latest_results_by_test_case(db: Session, test_case_ids: set[int]) -> dict[int, object]:
    if not test_case_ids:
        return {}

    ranked = (
        db.query(
            TestRunCase.test_case_id.label("test_case_id"),
            TestRunCaseAttempt.result.label("result"),
            TestRunCaseAttempt.executed_at.label("executed_at"),
            TestRunCaseAttempt.updated_at.label("updated_at"),
            func.row_number()
            .over(
                partition_by=TestRunCase.test_case_id,
                order_by=(
                    TestRunCaseAttempt.executed_at.desc().nullslast(),
                    TestRunCaseAttempt.updated_at.desc(),
                    TestRunCaseAttempt.id.desc(),
                ),
            )
            .label("row_number"),
        )
        .join(
            TestRunCaseAttempt,
            TestRunCaseAttempt.test_run_case_id == TestRunCase.id,
        )
        .filter(
            TestRunCase.test_case_id.in_(test_case_ids),
            TestRunCaseAttempt.result != "not_run",
        )
        .subquery()
    )
    rows = db.query(ranked).filter(ranked.c.row_number == 1).all()
    return {row.test_case_id: row for row in rows}


def _latest_result(results_by_test_case: dict[int, object]):
    if not results_by_test_case:
        return None
    return max(
        results_by_test_case.values(),
        key=lambda result: (
            result.executed_at or result.updated_at,
            result.updated_at,
        ),
    )


def _traceability_risk_status(
    *,
    total_case_count: int,
    tested_case_count: int,
    failed_case_count: int,
    blocked_case_count: int,
) -> str:
    if total_case_count == 0:
        return "missing_tests"
    if failed_case_count > 0 or blocked_case_count > 0:
        return "failing"
    if tested_case_count < total_case_count:
        return "partial"
    return "verified"
