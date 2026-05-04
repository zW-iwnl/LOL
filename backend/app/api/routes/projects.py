from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.project import ProjectCreate, ProjectListItem, ProjectRead, ProjectStatus, ProjectUpdate
from app.services import projects as project_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectListItem])
def list_projects(
    db: DbSession,
    q: str | None = Query(default=None, min_length=1),
    status_filter: ProjectStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return project_service.list_projects(db, q=q, status_filter=status_filter, limit=limit, offset=offset)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession, current_user: CurrentUser):
    return project_service.create_project(db, payload, current_user)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: DbSession):
    return project_service.get_project(db, project_id)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, db: DbSession):
    return project_service.update_project(db, project_id, payload)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: DbSession) -> Response:
    project_service.delete_project(db, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
