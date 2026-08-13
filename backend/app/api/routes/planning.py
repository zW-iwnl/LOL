from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.planning import (
    MilestoneCreate,
    MilestoneRead,
    ReleaseCreate,
    ReleaseRead,
    TestPlanAddRunsRequest,
    TestPlanCreate,
    TestPlanCreateRunRequest,
    TestPlanRead,
)
from app.services import planning as planning_service

router = APIRouter(tags=["Planning"])


@router.get("/projects/{project_id}/releases", response_model=list[ReleaseRead])
def list_releases(project_id: int, db: DbSession):
    return planning_service.list_releases(db, project_id)


@router.post("/projects/{project_id}/releases", response_model=ReleaseRead, status_code=status.HTTP_201_CREATED)
def create_release(project_id: int, payload: ReleaseCreate, db: DbSession, current_user: CurrentUser):
    return planning_service.create_release(db, project_id, payload, current_user)


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneRead])
def list_milestones(project_id: int, db: DbSession):
    return planning_service.list_milestones(db, project_id)


@router.post("/projects/{project_id}/milestones", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
def create_milestone(project_id: int, payload: MilestoneCreate, db: DbSession, current_user: CurrentUser):
    return planning_service.create_milestone(db, project_id, payload, current_user)


@router.get("/projects/{project_id}/test-plans", response_model=list[TestPlanRead])
def list_test_plans(project_id: int, db: DbSession):
    return planning_service.list_test_plans(db, project_id)


@router.post("/projects/{project_id}/test-plans", response_model=TestPlanRead, status_code=status.HTTP_201_CREATED)
def create_test_plan(project_id: int, payload: TestPlanCreate, db: DbSession, current_user: CurrentUser):
    return planning_service.create_test_plan(db, project_id, payload, current_user)


@router.get("/test-plans/{test_plan_id}", response_model=TestPlanRead)
def get_test_plan(test_plan_id: int, db: DbSession):
    return planning_service.get_test_plan(db, test_plan_id)


@router.post("/test-plans/{test_plan_id}/runs", response_model=TestPlanRead, status_code=status.HTTP_201_CREATED)
def add_runs_to_test_plan(test_plan_id: int, payload: TestPlanAddRunsRequest, db: DbSession):
    return planning_service.add_runs_to_test_plan(db, test_plan_id, payload)


@router.post("/test-plans/{test_plan_id}/create-run", response_model=TestPlanRead, status_code=status.HTTP_201_CREATED)
def create_run_from_test_plan(test_plan_id: int, payload: TestPlanCreateRunRequest, db: DbSession, current_user: CurrentUser):
    return planning_service.create_run_from_test_plan(db, test_plan_id, payload, current_user)


@router.delete("/test-plans/{test_plan_id}/runs/{test_run_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_run_from_test_plan(test_plan_id: int, test_run_id: int, db: DbSession) -> Response:
    planning_service.remove_run_from_test_plan(db, test_plan_id, test_run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
