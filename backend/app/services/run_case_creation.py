"""Atomic run-local proposals and immutable execution bindings."""
from copy import deepcopy
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models import TestCaseVersion, TestRun, TestRunCase, TestRunCaseAttempt, TestRunStepResult
from app.services import test_case_versions as versions
from app.services.policies import require_run_execution


def lock_run(db, run_id, user, *, open_required=True):
    from app.services.test_runs import _latest_attempt
    run = db.query(TestRun).filter(TestRun.id == run_id).with_for_update().populate_existing().first()
    if not run:
        raise HTTPException(404, "Test run neexistuje.")
    require_run_execution(db, run, user)
    if run.status == "archived":
        raise HTTPException(400, "Archivovaný test run nelze exekuovat.")
    attempt = _latest_attempt(db, run_id)
    if open_required and (attempt.status == "completed" or run.status == "completed"):
        raise HTTPException(409, "Nejprve založte nový pokus runu.")
    return run, attempt


def ensure_version_allowed(db, version, run_id):
    case = versions.lock_case(db, version.test_case_id)
    versions.require_active(case)
    state = versions.version_state(db, version.id)
    if state in ("rejected", "changes_requested", "withdrawn"):
        raise HTTPException(409, "Vrácenou, staženou nebo zamítnutou verzi nelze nově provádět. Použijte opravený návrh.")
    if state not in ("approved", "legacy_import") and version.origin_run_id != run_id:
        raise HTTPException(409, "Neschválený scénář lze provést jen ve zdrojovém runu.")
    return state


def bind_version(db, attempt, version, run_id):
    state = ensure_version_allowed(db, version, run_id)
    attempt.test_case_version_id = version.id
    attempt.version_number = version.version_number
    attempt.execution_snapshot = deepcopy(version.content_snapshot)
    attempt.approval_state_at_binding = state


def copy_binding(db, attempt, previous, run_id):
    if not previous or not previous.execution_snapshot:
        raise HTTPException(409, "Historický snapshot chybí. Pro nový pokus vyberte konkrétní dostupnou verzi.")
    if previous.test_case_version_id:
        version = db.get(TestCaseVersion, previous.test_case_version_id)
        bind_version(db, attempt, version, run_id)
    else:
        # Preserve legacy evidence; never rebuild it from a mutable definition.
        attempt.execution_snapshot = deepcopy(previous.execution_snapshot)
        attempt.version_number = previous.version_number
        attempt.approval_state_at_binding = "unknown"


def steps_for(attempt):
    return [s for s in (attempt.execution_snapshot or {}).get("steps", []) if s.get("step_type", "test") == "test"]


def add_steps(db, attempt):
    db.flush()
    db.add_all([TestRunStepResult(test_run_case_id=attempt.test_run_case_id,
                                 test_run_case_attempt_id=attempt.id, test_step_id=s["id"],
                                 step_order=s["step_order"], result="not_run") for s in steps_for(attempt)])


def execute_draft(db, run_id, payload, user):
    run, run_attempt = lock_run(db, run_id, user)
    case, draft = versions.lock_draft(db, payload.draft_id, user, payload.lock_version, editable=False)
    if draft.status == "closed" or draft.origin_run_id != run.id:
        raise HTTPException(409, "Návrh není otevřeným návrhem tohoto runu.")
    if db.query(TestRunCase.id).filter(TestRunCase.test_run_id == run.id, TestRunCase.test_case_id == case.id).first():
        raise HTTPException(409, "Test case už je v runu. Použijte nový pokus s upravenou verzí.")
    version = versions.freeze(db, case, draft, user)
    run_case = TestRunCase(test_run_id=run.id, test_case_id=case.id, assigned_to=user.id,
                           test_case_version=version.version_number, test_case_snapshot=deepcopy(version.content_snapshot), result="not_run")
    db.add(run_case)
    db.flush()
    attempt = TestRunCaseAttempt(test_run_attempt_id=run_attempt.id, test_run_case_id=run_case.id, attempt_number=1, result="not_run")
    bind_version(db, attempt, version, run.id)
    db.add(attempt)
    add_steps(db, attempt)
    versions.event(db, case.id, user, "draft_executed", run_id=run.id, case_attempt_id=attempt.id, version_id=version.id)
    return {"test_run_case_id": run_case.id, "case_attempt_id": attempt.id, "version_id": version.id}


def mark_started(db, attempt, user):
    require_run_execution(db, attempt.test_run_attempt.test_run, user)
    if attempt.closed_at:
        raise HTTPException(409, "Uzavřený pokus nelze měnit.")
    if not attempt.started_at:
        if attempt.test_case_version_id:
            version = db.get(TestCaseVersion, attempt.test_case_version_id)
            ensure_version_allowed(db, version, attempt.test_run_case.test_run_id)
        attempt.started_at = datetime.now(timezone.utc)
        attempt.approval_state_at_start = versions.version_state(db, attempt.test_case_version_id)
