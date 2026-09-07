from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    TestCase,
    TestCaseVersion,
    TestCaseTagAssignment,
    TestRun,
    TestRunAttempt,
    TestRunCase,
    TestRunCaseAttempt,
    TestRunStepResult,
    User,
)
from app.schemas.common import TestRunStatus
from app.schemas.test_run import (
    TestRunAddCasesRequest,
    TestRunCaseUpdate,
    TestRunCreate,
    TestRunUpdate,
    UpdateResultRequest,
)
from app.services.common import apply_updates, not_found
from app.services.run_case_creation import bind_version, copy_binding, steps_for, mark_started, lock_run
from app.services.test_case_versions import version_state, lock_draft, freeze


def list_test_runs(
    db: Session,
    *,
    q: str | None = None,
    status_filter: TestRunStatus | None = None,
    environment: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[TestRun]:
    query = db.query(TestRun).options(selectinload(TestRun.test_run_cases))
    if q:
        query = query.filter(TestRun.name.ilike(f"%{q.strip()}%"))
    if status_filter:
        query = query.filter(TestRun.status == status_filter)
    if environment:
        query = query.filter(func.lower(TestRun.environment) == environment.strip().lower())
    return query.order_by(TestRun.created_at.desc(), TestRun.id.desc()).offset(offset).limit(limit).all()


def get_test_run(db: Session, test_run_id: int) -> TestRun:
    test_run = (
        db.query(TestRun)
        .options(
            selectinload(TestRun.test_run_cases).selectinload(TestRunCase.case_attempts).selectinload(TestRunCaseAttempt.step_results)
        )
        .filter(TestRun.id == test_run_id)
        .first()
    )
    if test_run is None:
        raise not_found("Test run")
    return test_run


def get_execution(db: Session, test_run_id: int, *, attempt_id: int | None = None) -> dict:
    test_run = (
        db.query(TestRun)
        .options(
            selectinload(TestRun.attempts)
            .selectinload(TestRunAttempt.case_attempts)
            .selectinload(TestRunCaseAttempt.step_results),
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
    if not test_run.attempts:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Test run nemá žádný execution pokus.")

    selected_attempt = (
        next((attempt for attempt in test_run.attempts if attempt.id == attempt_id), None)
        if attempt_id is not None
        else test_run.attempts[-1]
    )
    if selected_attempt is None:
        raise not_found("Execution pokus")

    attempts_by_case: dict[int, TestRunCaseAttempt] = {}
    for item in selected_attempt.case_attempts:
        current = attempts_by_case.get(item.test_run_case_id)
        if current is None or item.attempt_number > current.attempt_number:
            attempts_by_case[item.test_run_case_id] = item
    history_by_case: dict[int, list[dict]] = {}
    for run_attempt in test_run.attempts:
        for item in run_attempt.case_attempts:
            history_by_case.setdefault(item.test_run_case_id, []).append(
                {
                    "id": item.id,
                    "test_run_attempt_id": run_attempt.id,
                    "test_run_attempt_number": run_attempt.attempt_number,
                    "test_run_case_id": item.test_run_case_id,
                    "attempt_number": item.attempt_number,
                    "result": item.result,
                    "comment": item.comment,
                    "executed_by": item.executed_by,
                    "executed_at": item.executed_at,
                    "step_results": item.step_results,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                    "execution_snapshot": item.execution_snapshot,
                    "test_case_version_id": item.test_case_version_id,
                    "version_number": item.version_number,
                    "approval_state": version_state(db, item.test_case_version_id),
                    "approval_state_at_start": item.approval_state_at_start,
                    "approval_state_at_binding": item.approval_state_at_binding,
                    "closure_reason": item.closure_reason,
                }
            )

    execution_cases = []
    for run_case in test_run.test_run_cases:
        case_attempt = attempts_by_case.get(run_case.id)
        if case_attempt is None:
            continue
        case_history = history_by_case.get(run_case.id, [])
        case_history.sort(key=lambda item: (item["test_run_attempt_number"], item["attempt_number"]))
        execution_cases.append(
            {
                "id": run_case.id,
                "case_attempt_id": case_attempt.id,
                "case_attempts": case_history,
                "test_run_id": run_case.test_run_id,
                "test_case_id": run_case.test_case_id,
                "assigned_to": run_case.assigned_to,
                "result": case_attempt.result,
                "comment": case_attempt.comment,
                "executed_by": case_attempt.executed_by,
                "executed_at": case_attempt.executed_at,
                "test_case_version": case_attempt.version_number or run_case.test_case_version,
                "test_case_snapshot": case_attempt.execution_snapshot,
                "step_results": case_attempt.step_results,
                "created_at": run_case.created_at,
                "updated_at": case_attempt.updated_at,
                "code": (case_attempt.execution_snapshot or {}).get("code", run_case.code),
                "title": (case_attempt.execution_snapshot or {}).get("title", "Historický snapshot chybí"),
                "suite_name": (case_attempt.execution_snapshot or {}).get("suite_name"),
                "test_case": run_case.test_case,
            }
        )
    definition_counts = {"approved": 0, "unapproved": 0, "rejected": 0, "unknown": 0}
    for attempt in attempts_by_case.values():
        state = version_state(db, attempt.test_case_version_id)
        bucket = "approved" if state in ("approved", "legacy_import") else "rejected" if state == "rejected" else "unknown" if state == "unknown" else "unapproved"
        definition_counts[bucket] += 1
    return {
        **{column.name: getattr(test_run, column.name) for column in TestRun.__table__.columns},
        "definition_counts": definition_counts,
        "attempts": test_run.attempts,
        "selected_attempt_id": selected_attempt.id,
        "test_run_cases": execution_cases,
    }


def list_attempts(db: Session, test_run_id: int) -> list[TestRunAttempt]:
    if db.get(TestRun, test_run_id) is None:
        raise not_found("Test run")
    return (
        db.query(TestRunAttempt)
        .filter(TestRunAttempt.test_run_id == test_run_id)
        .order_by(TestRunAttempt.attempt_number)
        .all()
    )


def create_test_run(db: Session, payload: TestRunCreate, current_user: User) -> TestRun:
    data = payload.model_dump(exclude={"test_case_ids"})
    test_run = TestRun(**data, created_by=current_user.id)
    db.add(test_run)
    db.flush()
    db.add(
        TestRunAttempt(
            test_run_id=test_run.id,
            attempt_number=1,
            status=data.get("status", "open"),
            started_at=data.get("started_at"),
            finished_at=data.get("finished_at"),
            created_by=current_user.id,
        )
    )
    db.flush()
    if payload.test_case_ids:
        add_test_cases(db, test_run.id, TestRunAddCasesRequest(test_case_ids=payload.test_case_ids), current_user=current_user)
    db.commit()
    return get_test_run(db, test_run.id)


def update_test_run(db: Session, test_run_id: int, payload: TestRunUpdate) -> TestRun:
    db.query(TestRun.id).filter(TestRun.id == test_run_id).with_for_update().first()
    test_run = get_test_run(db, test_run_id)
    if test_run.status == "completed" and payload.status in ("open", "in_progress"):
        raise HTTPException(409, "Dokončený pokus nelze znovu otevřít přepsáním stavu. Založte rerun.")
    apply_updates(test_run, payload)
    if (
        test_run.planned_start is not None
        and test_run.planned_end is not None
        and test_run.planned_end < test_run.planned_start
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Plánovaný konec nesmí být před plánovaným začátkem.",
        )
    if payload.status is not None and payload.status != "archived":
        attempt = _latest_attempt(db, test_run_id)
        attempt.status = payload.status
        attempt.started_at = test_run.started_at
        attempt.finished_at = test_run.finished_at
    db.commit()
    return get_test_run(db, test_run.id)


def delete_test_run(db: Session, test_run_id: int) -> None:
    test_run = get_test_run(db, test_run_id)
    test_run.status = "archived"
    db.commit()


def _snapshot_test_case(test_case: TestCase) -> dict:
    tags_by_category = {
        category: [
            {"id": tag.id, "name": tag.name}
            for tag in test_case.tags
            if tag.category == category
        ]
        for category in ("business_area", "application_domain", "object_type")
    }
    return {
        "id": test_case.id,
        "code": test_case.code,
        "title": test_case.title,
        "description": test_case.description,
        "preconditions": test_case.preconditions,
        "expected_summary": test_case.expected_summary,
        "business_areas": tags_by_category["business_area"],
        "application_domains": tags_by_category["application_domain"],
        "object_types": tags_by_category["object_type"],
        "business_area": tags_by_category["business_area"][0] if tags_by_category["business_area"] else None,
        "application_domain": tags_by_category["application_domain"][0] if tags_by_category["application_domain"] else None,
        "object_type": tags_by_category["object_type"][0] if tags_by_category["object_type"] else None,
        "status": test_case.status,
        "automated": test_case.automated,
        "suite_id": test_case.suite_id,
        "steps": [
            {
                "id": step.id,
                "step_order": step.step_order,
                "action": step.action,
                "step_type": step.step_type,
                "note": step.note,
                "expected_result": step.expected_result,
                "test_data": step.test_data,
            }
            for step in test_case.steps
        ],
    }


def _latest_attempt(db: Session, test_run_id: int) -> TestRunAttempt:
    attempt = (
        db.query(TestRunAttempt)
        .filter(TestRunAttempt.test_run_id == test_run_id)
        .order_by(TestRunAttempt.attempt_number.desc())
        .first()
    )
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Test run nemá žádný execution pokus.")
    return attempt


def add_test_cases(db: Session, test_run_id: int, payload: TestRunAddCasesRequest, current_user: User | None = None) -> TestRun:
    test_run = (
        db.query(TestRun)
        .filter(TestRun.id == test_run_id)
        .with_for_update()
        .first()
    )
    if test_run is None:
        raise not_found("Test run")
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze upravovat.")
    active_attempt = _latest_attempt(db, test_run_id)
    if active_attempt.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Do dokončeného pokusu nelze přidávat test cases. Nejdřív spusť rerun.")
    if payload.assigned_to is not None:
        assignee = db.get(User, payload.assigned_to)
        if assignee is None or not assignee.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Přiřazený tester neexistuje.")

    test_cases = (
        db.query(TestCase)
        .options(
            selectinload(TestCase.steps),
            selectinload(TestCase.tag_assignments).selectinload(TestCaseTagAssignment.tag),
        )
        .filter(TestCase.id.in_(payload.test_case_ids))
        .all()
    )
    found_ids = {test_case.id for test_case in test_cases}
    from app.services.policies import require_run_execution
    if current_user:
        require_run_execution(db, test_run, current_user)
    for test_case in sorted(test_cases, key=lambda item: item.id):
        from app.services.test_case_versions import lock_case
        lock_case(db, test_case.id)
        if test_case.status != "ready" or not test_case.current_approved_version_id:
            raise HTTPException(409, f"{test_case.code}: do běžného runu lze přidat pouze schválenou verzi.")
    missing = set(payload.test_case_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test cases neexistují: {sorted(missing)}",
        )

    existing_ids = {
        test_case_id
        for (test_case_id,) in db.query(TestRunCase.test_case_id)
        .filter(TestRunCase.test_run_id == test_run_id)
        .all()
    }
    duplicate_ids = sorted(set(payload.test_case_ids).intersection(existing_ids))
    if duplicate_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Test cases už jsou v test runu: {duplicate_ids}",
        )

    run_cases = [
        TestRunCase(
            test_run_id=test_run_id,
            test_case_id=test_case.id,
            assigned_to=payload.assigned_to,
            result="not_run",
            test_case_version=test_case.version,
            test_case_snapshot=db.get(TestCaseVersion, test_case.current_approved_version_id).content_snapshot,
        )
        for test_case in test_cases
    ]
    try:
        db.add_all(run_cases)
        db.flush()
        case_attempts = [
            TestRunCaseAttempt(
                test_run_attempt_id=active_attempt.id,
                test_run_case_id=run_case.id,
                attempt_number=1,
                result="not_run",
            )
            for run_case in run_cases
        ]
        db.add_all(case_attempts)
        for test_case, case_attempt in zip(test_cases, case_attempts, strict=True):
            bind_version(db, case_attempt, db.get(TestCaseVersion, test_case.current_approved_version_id), test_run_id)
        db.flush()
        step_results = []
        for test_case, run_case, case_attempt in zip(
            test_cases,
            run_cases,
            case_attempts,
            strict=True,
        ):
            step_results.extend(
                TestRunStepResult(
                    test_run_case_id=run_case.id,
                    test_run_case_attempt_id=case_attempt.id,
                    test_step_id=step["id"],
                    step_order=step["step_order"],
                    result="not_run",
                )
                for step in steps_for(case_attempt)
            )
        db.add_all(step_results)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Některý test case už je v test runu.",
        ) from exc
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
    has_executed_step = (
        db.query(TestRunStepResult.id)
        .filter(
            TestRunStepResult.test_run_case_id == run_case.id,
            TestRunStepResult.result != "not_run",
        )
        .first()
        is not None
    )
    has_executed_case = (
        db.query(TestRunCaseAttempt.id)
        .filter(
            TestRunCaseAttempt.test_run_case_id == run_case.id,
            TestRunCaseAttempt.result != "not_run",
        )
        .first()
        is not None
    )
    if has_executed_case or has_executed_step:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provedený test run case nelze odebrat z runu.",
        )

    db.delete(run_case)
    db.commit()


def _snapshot_test_steps(run_case: TestRunCase) -> list[dict]:
    snapshot = run_case.test_case_snapshot or {}
    steps = snapshot.get("steps")
    if isinstance(steps, list):
        return [
            step
            for step in steps
            if isinstance(step, dict) and step.get("step_type", "test") == "test"
        ]
    return [
        {"id": step.id, "step_order": step.step_order}
        for step in run_case.test_case.steps
        if step.step_type == "test"
    ]


def _latest_case_attempts(db: Session, test_run_attempt_id: int) -> dict[int, TestRunCaseAttempt]:
    latest_numbers = (
        db.query(
            TestRunCaseAttempt.test_run_case_id.label("test_run_case_id"),
            func.max(TestRunCaseAttempt.attempt_number).label("attempt_number"),
        )
        .filter(TestRunCaseAttempt.test_run_attempt_id == test_run_attempt_id)
        .group_by(TestRunCaseAttempt.test_run_case_id)
        .subquery()
    )
    rows = (
        db.query(TestRunCaseAttempt)
        .join(
            latest_numbers,
            and_(
                latest_numbers.c.test_run_case_id == TestRunCaseAttempt.test_run_case_id,
                latest_numbers.c.attempt_number == TestRunCaseAttempt.attempt_number,
            ),
        )
        .filter(TestRunCaseAttempt.test_run_attempt_id == test_run_attempt_id)
        .all()
    )
    return {item.test_run_case_id: item for item in rows}


def create_case_rerun(
    db: Session,
    case_attempt_id: int,
    current_user: User,
    selection=None,
    *,
    commit=True,
) -> dict:
    original = db.get(TestRunCaseAttempt, case_attempt_id)
    if original is None:
        raise not_found("Test run case pokus")
    lock_run(db, original.test_run_case.test_run_id, current_user, open_required=False)
    previous_case_attempt = (
        db.query(TestRunCaseAttempt)
        .filter(TestRunCaseAttempt.id == case_attempt_id)
        .with_for_update()
        .first()
    )
    if previous_case_attempt is None:
        raise not_found("Test run case pokus")

    run_case = previous_case_attempt.test_run_case
    run_attempt = previous_case_attempt.test_run_attempt
    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run is None:
        raise not_found("Test run")
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze resetovat.")

    latest_run_attempt = _latest_attempt(db, test_run.id)
    if run_attempt.id != latest_run_attempt.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Test case lze resetovat pouze v aktuálním rerunu.",
        )
    latest_case_attempt = (
        db.query(TestRunCaseAttempt)
        .filter(
            TestRunCaseAttempt.test_run_attempt_id == run_attempt.id,
            TestRunCaseAttempt.test_run_case_id == run_case.id,
        )
        .order_by(TestRunCaseAttempt.attempt_number.desc())
        .first()
    )
    if latest_case_attempt is None or latest_case_attempt.id != previous_case_attempt.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Historický pokus test case nelze resetovat.",
        )

    case_attempt = TestRunCaseAttempt(
        test_run_attempt_id=run_attempt.id,
        test_run_case_id=run_case.id,
        attempt_number=previous_case_attempt.attempt_number + 1,
        result="not_run",
    )
    if selection and selection.draft_id:
        case, draft = lock_draft(db, selection.draft_id, current_user, selection.lock_version, editable=False)
        if case.id != run_case.test_case_id or draft.origin_run_id != test_run.id or draft.status == "closed":
            raise HTTPException(409, "Návrh nepatří k tomuto scénáři a runu.")
        bind_version(db, case_attempt, freeze(db, case, draft, current_user), test_run.id)
    elif selection and selection.version_id:
        version = db.get(TestCaseVersion, selection.version_id)
        if not version or version.test_case_id != run_case.test_case_id:
            raise HTTPException(422, "Verze nepatří k test case.")
        bind_version(db, case_attempt, version, test_run.id)
    else:
        copy_binding(db, case_attempt, previous_case_attempt, test_run.id)
    previous_case_attempt.closed_at = datetime.now(timezone.utc)
    previous_case_attempt.closure_reason = "definition_changed" if case_attempt.test_case_version_id != previous_case_attempt.test_case_version_id else "rerun"
    db.add(case_attempt)
    db.flush()
    for step in steps_for(case_attempt):
        db.add(
            TestRunStepResult(
                test_run_case_id=run_case.id,
                test_run_case_attempt_id=case_attempt.id,
                test_step_id=int(step["id"]),
                step_order=int(step.get("step_order", 0)),
                result="not_run",
            )
        )

    run_case.result = "not_run"
    run_case.comment = None
    run_case.executed_by = None
    run_case.executed_at = None
    now = datetime.now(timezone.utc)
    run_attempt.status = "in_progress"
    run_attempt.started_at = run_attempt.started_at or now
    run_attempt.finished_at = None
    run_attempt.last_test_run_case_id = run_case.id
    run_attempt.last_step_id = None
    test_run.status = "in_progress"
    test_run.started_at = test_run.started_at or now
    test_run.finished_at = None
    if commit:
        db.commit()
    else:
        db.flush()
    db.expire_all()
    return get_execution(db, test_run.id, attempt_id=run_attempt.id)


def create_rerun(db: Session, test_run_id: int, current_user: User) -> dict:
    lock_run(db, test_run_id, current_user, open_required=False)
    test_run = (
        db.query(TestRun)
        .options(
            selectinload(TestRun.test_run_cases)
            .selectinload(TestRunCase.test_case)
            .selectinload(TestCase.steps)
        )
        .filter(TestRun.id == test_run_id)
        .with_for_update()
        .first()
    )
    if test_run is None:
        raise not_found("Test run")
    if test_run.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze znovu spustit.")
    if not test_run.test_run_cases:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prázdný test run nelze znovu spustit.")

    previous_attempt = _latest_attempt(db, test_run_id)
    if previous_attempt.status != "completed":
        has_case_result = (
            db.query(TestRunCaseAttempt.id)
            .filter(
                TestRunCaseAttempt.test_run_attempt_id == previous_attempt.id,
                TestRunCaseAttempt.result != "not_run",
            )
            .first()
            is not None
        )
        has_step_result = (
            db.query(TestRunStepResult.id)
            .join(
                TestRunCaseAttempt,
                TestRunCaseAttempt.id == TestRunStepResult.test_run_case_attempt_id,
            )
            .filter(
                TestRunCaseAttempt.test_run_attempt_id == previous_attempt.id,
                TestRunStepResult.result != "not_run",
            )
            .first()
            is not None
        )
        if not has_case_result and not has_step_result:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Rerun lze vytvořit až po zahájení aktuálního pokusu.",
            )
        previous_attempt.status = "completed"
        previous_attempt.finished_at = datetime.now(timezone.utc)

    attempt = TestRunAttempt(
        test_run_id=test_run.id,
        attempt_number=previous_attempt.attempt_number + 1,
        status="open",
        created_by=current_user.id,
    )
    db.add(attempt)
    db.flush()

    previous_cases = _latest_case_attempts(db, previous_attempt.id)
    for run_case in test_run.test_run_cases:
        case_attempt = TestRunCaseAttempt(
            test_run_attempt_id=attempt.id,
            test_run_case_id=run_case.id,
            attempt_number=1,
            result="not_run",
        )
        copy_binding(db, case_attempt, previous_cases.get(run_case.id), test_run.id)
        db.add(case_attempt)
        db.flush()
        for step in steps_for(case_attempt):
            db.add(
                TestRunStepResult(
                    test_run_case_id=run_case.id,
                    test_run_case_attempt_id=case_attempt.id,
                    test_step_id=int(step["id"]),
                    step_order=int(step.get("step_order", 0)),
                    result="not_run",
                )
            )

        run_case.result = "not_run"
        run_case.comment = None
        run_case.executed_by = None
        run_case.executed_at = None

    test_run.status = "open"
    test_run.started_at = None
    test_run.finished_at = None
    db.commit()
    return get_execution(db, test_run.id, attempt_id=attempt.id)


def update_latest_result(
    db: Session,
    test_run_case_id: int,
    payload: UpdateResultRequest,
    current_user: User,
) -> TestRunCase:
    case_attempt = (
        db.query(TestRunCaseAttempt)
        .join(TestRunAttempt, TestRunAttempt.id == TestRunCaseAttempt.test_run_attempt_id)
        .filter(TestRunCaseAttempt.test_run_case_id == test_run_case_id)
        .order_by(TestRunAttempt.attempt_number.desc(), TestRunCaseAttempt.attempt_number.desc())
        .first()
    )
    if case_attempt is None:
        raise not_found("Test run case pokus")
    return update_result(db, case_attempt.id, payload, current_user)


def update_result(
    db: Session,
    case_attempt_id: int,
    payload: UpdateResultRequest,
    current_user: User,
) -> TestRunCase:
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test run nelze exekuovat.")
    latest_attempt = _latest_attempt(db, test_run.id)
    if attempt.id != latest_attempt.id or attempt.status == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Historický nebo dokončený pokus nelze upravovat.")

    now = datetime.now(timezone.utc)
    mark_started(db, case_attempt, current_user)
    case_attempt.result = payload.result
    case_attempt.comment = payload.comment
    case_attempt.executed_by = current_user.id
    case_attempt.executed_at = now
    run_case.result = payload.result
    run_case.comment = payload.comment
    run_case.executed_by = current_user.id
    run_case.executed_at = now
    attempt.last_test_run_case_id = run_case.id

    if attempt.status == "open":
        attempt.status = "in_progress"
        attempt.started_at = attempt.started_at or now
        test_run.status = "in_progress"
        test_run.started_at = test_run.started_at or now

    db.flush()
    remaining = sum(
        1
        for item in _latest_case_attempts(db, attempt.id).values()
        if item.result == "not_run"
    )
    if remaining == 0:
        attempt.status = "completed"
        attempt.finished_at = now
        test_run.status = "completed"
        test_run.finished_at = now

    db.commit()
    refreshed_run = get_test_run(db, test_run.id)
    return next(item for item in refreshed_run.test_run_cases if item.id == run_case.id)
