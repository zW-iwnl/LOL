from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import TestRun, TestRunAttempt, TestRunCase, TestRunCaseAttempt, TestRunStepResult, TestStep, User
from app.schemas.test_run import UpdateStepResultRequest
from app.services.common import not_found


def _find_snapshot_step(db: Session, case_attempt: TestRunCaseAttempt, test_step_id: int) -> dict:
    snapshot = case_attempt.execution_snapshot or {}
    snapshot_steps = snapshot.get("steps")
    if isinstance(snapshot_steps, list):
        step = next(
            (
                item
                for item in snapshot_steps
                if isinstance(item, dict) and item.get("id") == test_step_id
            ),
            None,
        )
        if step is None:
            raise not_found("Krok test case")
        return step

    raise HTTPException(409, "Historický snapshot chybí. Vyberte konkrétní verzi pro nový pokus.")


def update_latest_step_result(
    db: Session,
    test_run_case_id: int,
    test_step_id: int,
    payload: UpdateStepResultRequest,
    current_user: User,
) -> TestRunStepResult:
    case_attempt = (
        db.query(TestRunCaseAttempt)
        .join(TestRunAttempt, TestRunAttempt.id == TestRunCaseAttempt.test_run_attempt_id)
        .filter(TestRunCaseAttempt.test_run_case_id == test_run_case_id)
        .order_by(TestRunAttempt.attempt_number.desc(), TestRunCaseAttempt.attempt_number.desc())
        .first()
    )
    if case_attempt is None:
        raise not_found("Test run case pokus")
    return update_step_result(db, case_attempt.id, test_step_id, payload, current_user)


def update_step_result(
    db: Session,
    case_attempt_id: int,
    test_step_id: int,
    payload: UpdateStepResultRequest,
    current_user: User,
) -> TestRunStepResult:
    from app.services.run_case_creation import lock_run
    original = db.get(TestRunCaseAttempt, case_attempt_id)
    if original is None:
        raise not_found("Test run case pokus")
    lock_run(db, original.test_run_case.test_run_id, current_user)
    case_attempt = (
        db.query(TestRunCaseAttempt)
        .filter(TestRunCaseAttempt.id == case_attempt_id)
        .with_for_update()
        .first()
    )
    if case_attempt is None:
        raise not_found("Test run case pokus")

    latest_case_attempt = (
        db.query(TestRunCaseAttempt.id)
        .filter(
            TestRunCaseAttempt.test_run_attempt_id == case_attempt.test_run_attempt_id,
            TestRunCaseAttempt.test_run_case_id == case_attempt.test_run_case_id,
        )
        .order_by(TestRunCaseAttempt.attempt_number.desc())
        .first()
    )
    if latest_case_attempt is None or latest_case_attempt[0] != case_attempt.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Historický pokus test case nelze upravovat.",
        )

    run_case = case_attempt.test_run_case
    attempt = case_attempt.test_run_attempt
    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run is None:
        raise not_found("Test run")
    if test_run.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivovaný test run nelze exekuovat.",
        )
    latest_attempt = (
        db.query(TestRunAttempt)
        .filter(TestRunAttempt.test_run_id == test_run.id)
        .order_by(TestRunAttempt.attempt_number.desc())
        .first()
    )
    if latest_attempt is None or attempt.id != latest_attempt.id or attempt.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Historický nebo dokončený pokus nelze upravovat.",
        )

    step = _find_snapshot_step(db, case_attempt, test_step_id)
    if step.get("step_type", "test") != "test":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Netestovací krok nelze vyhodnotit.",
        )
    step_result = (
        db.query(TestRunStepResult)
        .filter(
            TestRunStepResult.test_run_case_attempt_id == case_attempt.id,
            TestRunStepResult.test_step_id == test_step_id,
        )
        .first()
    )
    old_result = step_result.result if step_result else "not_run"
    if step_result is None:
        step_result = TestRunStepResult(
            test_run_case_id=run_case.id,
            test_run_case_attempt_id=case_attempt.id,
            test_step_id=test_step_id,
            step_order=int(step.get("step_order", 0)),
        )
        db.add(step_result)

    now = datetime.now(timezone.utc)
    from app.services.run_case_creation import mark_started
    mark_started(db, case_attempt, current_user)
    step_result.result = payload.result
    if payload.result == "not_run":
        step_result.executed_by = None
        step_result.executed_at = None
    else:
        step_result.executed_by = current_user.id
        step_result.executed_at = now

    attempt.last_test_run_case_id = run_case.id
    attempt.last_step_id = test_step_id
    if attempt.status == "open":
        attempt.status = "in_progress"
        attempt.started_at = attempt.started_at or now
        test_run.status = "in_progress"
        test_run.started_at = test_run.started_at or now

    db.commit()
    db.refresh(step_result)
    return step_result
