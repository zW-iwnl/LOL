from fastapi import APIRouter, Header, Query, Response, status
from app.schemas.test_case_workflow import VersionRerun
from app.services.test_case_operations import mutate

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import TestRunStatus
from app.schemas.test_run import (
    TestRunAddCasesRequest,
    TestRunAttemptRead,
    TestRunCaseRead,
    TestRunCaseUpdate,
    TestRunCreate,
    TestRunExecutionRead,
    TestRunListItem,
    TestRunRead,
    TestRunUpdate,
    TestRunStepResultRead,
    UpdateResultRequest,
    UpdateStepResultRequest,
)
from app.services import test_run_steps as step_result_service
from app.services import test_runs as test_run_service
from app.schemas.test_run_selection import RunSelection, SelectionCatalog, SelectionPreview
from app.services.test_run_selection import selection_catalog, preview_selection

router = APIRouter(tags=["Test Runs", "Execution"])


@router.get("/test-runs/selection-catalog", response_model=SelectionCatalog)
def get_selection_catalog(db: DbSession, current_user: CurrentUser):
    return selection_catalog(db)


@router.post("/test-runs/selection-preview", response_model=SelectionPreview)
def get_selection_preview(payload: RunSelection, db: DbSession, current_user: CurrentUser):
    return preview_selection(db, payload)


@router.get("/test-runs", response_model=list[TestRunListItem])
def list_test_runs(
    db: DbSession,
    q: str | None = Query(default=None, min_length=1),
    status_filter: TestRunStatus | None = Query(default=None, alias="status"),
    environment: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return test_run_service.list_test_runs(
        db,
        q=q,
        status_filter=status_filter,
        environment=environment,
        limit=limit,
        offset=offset,
    )


@router.post("/test-runs", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
def create_test_run(payload: TestRunCreate, db: DbSession, current_user: CurrentUser):
    return test_run_service.create_test_run(db, payload, current_user)


@router.get("/test-runs/{test_run_id}", response_model=TestRunRead)
def get_test_run(test_run_id: int, db: DbSession):
    return test_run_service.get_test_run(db, test_run_id)


@router.put("/test-runs/{test_run_id}", response_model=TestRunRead)
def update_test_run(test_run_id: int, payload: TestRunUpdate, db: DbSession):
    return test_run_service.update_test_run(db, test_run_id, payload)


@router.delete("/test-runs/{test_run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_run(test_run_id: int, db: DbSession) -> Response:
    test_run_service.delete_test_run(db, test_run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test-runs/{test_run_id}/cases", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
def add_test_cases(test_run_id: int, payload: TestRunAddCasesRequest, db: DbSession, current_user: CurrentUser):
    return test_run_service.add_test_cases(db, test_run_id, payload, current_user=current_user)


@router.put("/test-run-cases/{test_run_case_id}", response_model=TestRunCaseRead)
def update_run_case(test_run_case_id: int, payload: TestRunCaseUpdate, db: DbSession):
    return test_run_service.update_run_case(db, test_run_case_id, payload)


@router.delete("/test-run-cases/{test_run_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_run_case(test_run_case_id: int, db: DbSession) -> Response:
    test_run_service.remove_run_case(db, test_run_case_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/test-runs/{test_run_id}/execution", response_model=TestRunExecutionRead)
def get_execution(test_run_id: int, db: DbSession, attempt_id: int | None = Query(default=None)):
    return test_run_service.get_execution(db, test_run_id, attempt_id=attempt_id)


@router.get("/test-runs/{test_run_id}/attempts", response_model=list[TestRunAttemptRead])
def list_attempts(test_run_id: int, db: DbSession):
    return test_run_service.list_attempts(db, test_run_id)


@router.post("/test-runs/{test_run_id}/reruns", response_model=TestRunExecutionRead, status_code=status.HTTP_201_CREATED)
def create_rerun(test_run_id: int, db: DbSession, current_user: CurrentUser):
    return test_run_service.create_rerun(db, test_run_id, current_user)


@router.post(
    "/test-run-case-attempts/{case_attempt_id}/reruns",
    response_model=TestRunExecutionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_case_rerun(case_attempt_id: int, db: DbSession, current_user: CurrentUser,
                      payload: VersionRerun | None = None, idempotency_key: str | None = Header(default=None)):
    if payload or idempotency_key:
        return mutate(db, current_user, idempotency_key, f"attempt/{case_attempt_id}/rerun", payload,
                      lambda: test_run_service.create_case_rerun(db, case_attempt_id, current_user, payload, commit=False))
    return test_run_service.create_case_rerun(db, case_attempt_id, current_user)


@router.put("/test-run-cases/{test_run_case_id}/result", response_model=TestRunCaseRead)
def update_latest_result(
    test_run_case_id: int,
    payload: UpdateResultRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    return test_run_service.update_latest_result(db, test_run_case_id, payload, current_user)


@router.put("/test-run-case-attempts/{case_attempt_id}/result", response_model=TestRunCaseRead)
def update_result(case_attempt_id: int, payload: UpdateResultRequest, db: DbSession, current_user: CurrentUser):
    return test_run_service.update_result(db, case_attempt_id, payload, current_user)


@router.put(
    "/test-run-cases/{test_run_case_id}/steps/{test_step_id}/result",
    response_model=TestRunStepResultRead,
)
def update_latest_step_result(
    test_run_case_id: int,
    test_step_id: int,
    payload: UpdateStepResultRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    return step_result_service.update_latest_step_result(
        db,
        test_run_case_id,
        test_step_id,
        payload,
        current_user,
    )


@router.put(
    "/test-run-case-attempts/{case_attempt_id}/steps/{test_step_id}/result",
    response_model=TestRunStepResultRead,
)
def update_step_result(
    case_attempt_id: int,
    test_step_id: int,
    payload: UpdateStepResultRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    return step_result_service.update_step_result(
        db,
        case_attempt_id,
        test_step_id,
        payload,
        current_user,
    )
