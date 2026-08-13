from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import Defect, Requirement, TestCase, TestRunCase, User
from app.schemas.common import DefectStatus
from app.schemas.requirement import (
    RequirementCreate,
    RequirementLinkTestCasesRequest,
    RequirementUpdate,
    TraceabilityRow,
    TraceabilityTestCase,
)
from app.services.common import apply_updates, get_project_or_404, not_found

OPEN_DEFECT_STATUSES: set[DefectStatus] = {"open", "in_progress", "fixed", "retest"}


def list_requirements(db: Session, project_id: int) -> list[Requirement]:
    get_project_or_404(db, project_id)
    return (
        db.query(Requirement)
        .options(selectinload(Requirement.test_cases).selectinload(TestCase.steps))
        .filter(Requirement.project_id == project_id)
        .order_by(Requirement.code)
        .all()
    )


def get_requirement(db: Session, requirement_id: int) -> Requirement:
    requirement = (
        db.query(Requirement)
        .options(selectinload(Requirement.test_cases).selectinload(TestCase.steps))
        .filter(Requirement.id == requirement_id)
        .first()
    )
    if requirement is None:
        raise not_found("Requirement")
    return requirement


def create_requirement(db: Session, project_id: int, payload: RequirementCreate, current_user: User) -> Requirement:
    get_project_or_404(db, project_id)
    if db.query(Requirement).filter(Requirement.project_id == project_id, Requirement.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód requirementu už v projektu existuje.")

    data = payload.model_dump(exclude={"test_case_ids"})
    requirement = Requirement(**data, project_id=project_id, created_by=current_user.id)
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
                Requirement.project_id == requirement.project_id,
                Requirement.code == payload.code,
                Requirement.id != requirement_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód requirementu už v projektu existuje.")
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


def get_traceability_matrix(db: Session, project_id: int) -> list[TraceabilityRow]:
    requirements = list_requirements(db, project_id)
    rows: list[TraceabilityRow] = []
    for requirement in requirements:
        test_case_ids = [test_case.id for test_case in requirement.test_cases]
        latest_run_cases = _latest_run_cases_by_test_case(db, test_case_ids)
        latest_run_case = _latest_run_case(latest_run_cases)
        open_defects = _open_defects(db, project_id, test_case_ids)
        tested_case_count = len(latest_run_cases)
        failed_case_count = sum(1 for run_case in latest_run_cases.values() if run_case.result == "failed")
        blocked_case_count = sum(1 for run_case in latest_run_cases.values() if run_case.result == "blocked")
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
                        priority=test_case.priority,
                    )
                    for test_case in requirement.test_cases
                ],
                coverage_status="covered" if test_case_ids else "missing_tests",
                risk_status=_traceability_risk_status(
                    total_case_count=len(test_case_ids),
                    tested_case_count=tested_case_count,
                    failed_case_count=failed_case_count,
                    blocked_case_count=blocked_case_count,
                    open_defect_count=len(open_defects),
                ),
                tested_case_count=tested_case_count,
                failed_case_count=failed_case_count,
                blocked_case_count=blocked_case_count,
                open_defect_count=len(open_defects),
                latest_result=latest_run_case.result if latest_run_case else None,
                latest_executed_at=latest_run_case.executed_at if latest_run_case else None,
                open_defects=open_defects,
            )
        )
    return rows


def _link_test_cases(db: Session, requirement: Requirement, test_case_ids: list[int]) -> None:
    test_cases = (
        db.query(TestCase)
        .filter(TestCase.project_id == requirement.project_id, TestCase.id.in_(test_case_ids))
        .all()
    )
    found_ids = {test_case.id for test_case in test_cases}
    missing_ids = sorted(set(test_case_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test cases neexistují v projektu: {missing_ids}",
        )

    existing_ids = {test_case.id for test_case in requirement.test_cases}
    for test_case in test_cases:
        if test_case.id not in existing_ids:
            requirement.test_cases.append(test_case)


def _latest_run_cases_by_test_case(db: Session, test_case_ids: list[int]) -> dict[int, TestRunCase]:
    if not test_case_ids:
        return {}
    run_cases = (
        db.query(TestRunCase)
        .filter(TestRunCase.test_case_id.in_(test_case_ids), TestRunCase.result != "not_run")
        .order_by(TestRunCase.test_case_id, TestRunCase.executed_at.desc().nullslast(), TestRunCase.updated_at.desc())
        .all()
    )
    latest_by_test_case: dict[int, TestRunCase] = {}
    for run_case in run_cases:
        if run_case.test_case_id not in latest_by_test_case:
            latest_by_test_case[run_case.test_case_id] = run_case
    return latest_by_test_case


def _latest_run_case(run_cases_by_test_case: dict[int, TestRunCase]) -> TestRunCase | None:
    if not run_cases_by_test_case:
        return None
    return max(
        run_cases_by_test_case.values(),
        key=lambda run_case: (run_case.executed_at or run_case.updated_at, run_case.updated_at),
    )


def _traceability_risk_status(
    *,
    total_case_count: int,
    tested_case_count: int,
    failed_case_count: int,
    blocked_case_count: int,
    open_defect_count: int,
) -> str:
    if total_case_count == 0:
        return "missing_tests"
    if open_defect_count > 0:
        return "defect_risk"
    if failed_case_count > 0 or blocked_case_count > 0:
        return "failing"
    if tested_case_count < total_case_count:
        return "partial"
    return "verified"


def _open_defects(db: Session, project_id: int, test_case_ids: list[int]) -> list[Defect]:
    if not test_case_ids:
        return []
    return (
        db.query(Defect)
        .join(TestRunCase, Defect.test_run_case_id == TestRunCase.id)
        .filter(
            Defect.project_id == project_id,
            TestRunCase.test_case_id.in_(test_case_ids),
            Defect.status.in_(OPEN_DEFECT_STATUSES),
        )
        .order_by(Defect.created_at.desc())
        .all()
    )
