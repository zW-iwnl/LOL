from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Project, User
from app.schemas.project import ProjectCreate, ProjectStatus, ProjectUpdate
from app.services.common import apply_updates, get_project_or_404


def normalize_code(code: str) -> str:
    return code.strip().upper()


def list_projects(
    db: Session,
    *,
    q: str | None = None,
    status_filter: ProjectStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Project]:
    query = db.query(Project)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(or_(Project.name.ilike(pattern), Project.code.ilike(pattern)))
    if status_filter:
        query = query.filter(Project.status == status_filter)
    return query.order_by(Project.name.asc()).offset(offset).limit(limit).all()


def get_project(db: Session, project_id: int) -> Project:
    return get_project_or_404(db, project_id)


def create_project(db: Session, payload: ProjectCreate, current_user: User) -> Project:
    data = payload.model_dump()
    data["code"] = normalize_code(data["code"])
    if db.query(Project).filter(func.lower(Project.code) == data["code"].lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód projektu už existuje.")
    project = Project(**data, created_by=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project_id: int, payload: ProjectUpdate) -> Project:
    project = get_project_or_404(db, project_id)
    data = payload.model_copy()
    if data.code is not None:
        data.code = normalize_code(data.code)
    if data.code and data.code != project.code:
        existing = (
            db.query(Project)
            .filter(func.lower(Project.code) == data.code.lower(), Project.id != project_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kód projektu už existuje.")
    apply_updates(project, data)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> None:
    project = get_project_or_404(db, project_id)
    project.status = "archived"
    db.commit()
