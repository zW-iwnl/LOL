from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import TestRunStatus
from app.schemas.test_run import (
    TestRunAddCasesRequest,
    TestRunCaseRead,
    TestRunCreate,
    TestRunExecutionRead,
    TestRunListItem,
    TestRunRead,
    TestRunUpdate,
    UpdateResultRequest,
)
from app.services import test_runs as test_run_service

router = APIRouter(tags=["Test Runs", "Execution"])


@router.get("/projects/{project_id}/test-runs", response_model=list[TestRunListItem])
def list_test_runs(
    project_id: int,
    db: DbSession,
    q: str | None = Query(default=None, min_length=1),
    status_filter: TestRunStatus | None = Query(default=None, alias="status"),
    environment: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return test_run_service.list_test_runs(
        db,
        project_id,
        q=q,
        status_filter=status_filter,
        environment=environment,
        limit=limit,
        offset=offset,
    )


@router.post("/projects/{project_id}/test-runs", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
def create_test_run(project_id: int, payload: TestRunCreate, db: DbSession, current_user: CurrentUser):
    return test_run_service.create_test_run(db, project_id, payload, current_user)


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
def add_test_cases(test_run_id: int, payload: TestRunAddCasesRequest, db: DbSession):
    return test_run_service.add_test_cases(db, test_run_id, payload)


@router.get("/test-runs/{test_run_id}/execution", response_model=TestRunExecutionRead)
def get_execution(test_run_id: int, db: DbSession):
    return test_run_service.get_execution(db, test_run_id)


@router.put("/test-run-cases/{test_run_case_id}/result", response_model=TestRunCaseRead)
def update_result(test_run_case_id: int, payload: UpdateResultRequest, db: DbSession, current_user: CurrentUser):
    return test_run_service.update_result(db, test_run_case_id, payload, current_user)
