from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Defect, TestCase, TestRun, TestRunCase, User
from app.schemas.common import TestRunStatus
from app.schemas.test_run import TestRunAddCasesRequest, TestRunCaseUpdate, TestRunCreate, TestRunUpdate, UpdateResultRequest
from app.services.audit import record_event
from app.services.common import apply_updates, get_project_or_404, not_found


def list_test_runs(
    db: Session,
    project_id: int,
    *,
    q: str | None = None,
    status_filter: TestRunStatus | None = None,
    environment: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[TestRun]:
    get_project_or_404(db, project_id)
    query = db.query(TestRun).options(selectinload(TestRun.test_run_cases)).filter(TestRun.project_id == project_id)
    if q:
        query = query.filter(TestRun.name.ilike(f"%{q.strip()}%"))
    if status_filter:
        query = query.filter(TestRun.status == status_filter)
    if environment:
        query = query.filter(func.lower(TestRun.environment) == environment.strip().lower())
    return query.order_by(TestRun.created_at.desc()).offset(offset).limit(limit).all()


def get_test_run(db: Session, test_run_id: int) -> TestRun:
    test_run = (
        db.query(TestRun)
        .options(selectinload(TestRun.test_run_cases))
        .filter(TestRun.id == test_run_id)
        .first()
    )
    if test_run is None:
        raise not_found("Test run")
    return test_run


def get_execution(db: Session, test_run_id: int) -> TestRun:
    test_run = (
        db.query(TestRun)
        .options(
            selectinload(TestRun.test_run_cases)
            .selectinload(TestRunCase.test_case)
            .selectinload(TestCase.steps),
            selectinload(TestRun.test_run_cases)
            .selectinload(TestRunCase.test_case)
            .selectinload(TestCase.suite),
        )
        .filter(TestRun.id == test_run_id)
        .first()
    )
    if test_run is None:
        raise not_found("Test run")
    return test_run


def create_test_run(db: Session, project_id: int, payload: TestRunCreate, current_user: User) -> TestRun:
    get_project_or_404(db, project_id)
    data = payload.model_dump(exclude={"test_case_ids"})
    test_run = TestRun(**data, project_id=project_id, created_by=current_user.id)
    db.add(test_run)
    db.flush()
    record_event(
        db,
        entity_type="TestRun",
        entity_id=test_run.id,
        action="created",
        actor=current_user,
        changes=data,
    )
    if payload.test_case_ids:
        add_test_cases(db, test_run.id, TestRunAddCasesRequest(test_case_ids=payload.test_case_ids), current_user=current_user)
    db.commit()
    return get_test_run(db, test_run.id)


def update_test_run(db: Session, test_run_id: int, payload: TestRunUpdate) -> TestRun:
    test_run = get_test_run(db, test_run_id)
    apply_updates(test_run, payload)
    db.commit()
    return get_test_run(db, test_run.id)


def delete_test_run(db: Session, test_run_id: int) -> None:
    test_run = get_test_run(db, test_run_id)
    test_run.status = "archived"
    db.commit()


def _snapshot_test_case(test_case: TestCase) -> dict:
    return {
        "id": test_case.id,
        "code": test_case.code,
        "title": test_case.title,
        "description": test_case.description,
        "preconditions": test_case.preconditions,
        "expected_summary": test_case.expected_summary,
        "priority": test_case.priority,
        "type": test_case.type,
        "status": test_case.status,
        "automated": test_case.automated,
        "suite_id": test_case.suite_id,
        "steps": [
            {
                "id": step.id,
                "step_order": step.step_order,
                "action": step.action,
                "expected_result": step.expected_result,
                "test_data": step.test_data,
            }
            for step in test_case.steps
        ],
    }


def add_test_cases(db: Session, test_run_id: int, payload: TestRunAddCasesRequest, current_user: User | None = None) -> TestRun:
    test_run = get_test_run(db, test_run_id)
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze upravovat.")
    if payload.assigned_to is not None:
        assignee = db.get(User, payload.assigned_to)
        if assignee is None or not assignee.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Přiřazený tester neexistuje.")

    test_cases = (
        db.query(TestCase)
        .options(selectinload(TestCase.steps))
        .filter(TestCase.project_id == test_run.project_id, TestCase.id.in_(payload.test_case_ids))
        .all()
    )
    found_ids = {test_case.id for test_case in test_cases}
    missing = set(payload.test_case_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test cases neexistují v projektu: {sorted(missing)}",
        )

    existing_ids = {
        row.test_case_id
        for row in db.query(TestRunCase).filter(TestRunCase.test_run_id == test_run_id).all()
    }
    duplicate_ids = sorted(set(payload.test_case_ids).intersection(existing_ids))
    if duplicate_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Test cases už jsou v test runu: {duplicate_ids}",
        )

    for test_case in test_cases:
        run_case = TestRunCase(
            test_run_id=test_run_id,
            test_case_id=test_case.id,
            assigned_to=payload.assigned_to,
            result="not_run",
            defect_count=0,
            test_case_version=test_case.version,
            test_case_snapshot=_snapshot_test_case(test_case),
        )
        db.add(run_case)
    record_event(
        db,
        entity_type="TestRun",
        entity_id=test_run.id,
        action="cases_added",
        actor=current_user,
        changes={"test_case_ids": payload.test_case_ids, "assigned_to": payload.assigned_to},
    )
    db.commit()
    return get_test_run(db, test_run_id)


def update_run_case(db: Session, test_run_case_id: int, payload: TestRunCaseUpdate) -> TestRunCase:
    run_case = db.get(TestRunCase, test_run_case_id)
    if run_case is None:
        raise not_found("Test run case")

    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze upravovat.")

    if payload.assigned_to is not None:
        assignee = db.get(User, payload.assigned_to)
        if assignee is None or not assignee.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Přiřazený tester neexistuje.")

    run_case.assigned_to = payload.assigned_to
    db.commit()
    db.refresh(run_case)
    return run_case


def remove_run_case(db: Session, test_run_case_id: int) -> None:
    run_case = db.get(TestRunCase, test_run_case_id)
    if run_case is None:
        raise not_found("Test run case")

    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze upravovat.")
    if run_case.result != "not_run":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provedený test run case nelze odebrat z runu.",
        )

    for defect in db.query(Defect).filter(Defect.test_run_case_id == run_case.id).all():
        defect.test_run_case_id = None
    db.delete(run_case)
    db.commit()


def update_result(
    db: Session,
    test_run_case_id: int,
    payload: UpdateResultRequest,
    current_user: User,
) -> TestRunCase:
    run_case = db.get(TestRunCase, test_run_case_id)
    if run_case is None:
        raise not_found("Test run case")

    run_case.result = payload.result
    run_case.comment = payload.comment
    run_case.executed_by = current_user.id
    run_case.executed_at = datetime.now(timezone.utc)

    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze exekuovat.")

    if payload.result == "failed" and payload.defect is not None:
        defect = Defect(
            **payload.defect.model_dump(exclude={"test_run_case_id"}),
            project_id=test_run.project_id,
            test_run_case_id=run_case.id,
            reported_by=current_user.id,
        )
        db.add(defect)
        run_case.defect_count += 1

    if test_run.status == "open":
        test_run.status = "in_progress"
        test_run.started_at = test_run.started_at or datetime.now(timezone.utc)

    remaining = (
        db.query(TestRunCase)
        .filter(TestRunCase.test_run_id == run_case.test_run_id, TestRunCase.result == "not_run")
        .count()
    )
    if remaining == 0:
        test_run.status = "completed"
        test_run.finished_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(run_case)
    return run_case
