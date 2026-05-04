from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Project


def not_found(entity: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} nenalezen.")


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise not_found("Projekt")
    return project


def apply_updates(model, data) -> None:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(model, field, value)
