from sqlalchemy.orm import Session

from app.models import Defect, User
from app.schemas.defect import DefectCreate, DefectUpdate
from app.services.common import apply_updates, get_project_or_404, not_found


def list_defects(db: Session, project_id: int) -> list[Defect]:
    get_project_or_404(db, project_id)
    return (
        db.query(Defect)
        .filter(Defect.project_id == project_id)
        .order_by(Defect.created_at.desc())
        .all()
    )


def get_defect(db: Session, defect_id: int) -> Defect:
    defect = db.get(Defect, defect_id)
    if defect is None:
        raise not_found("Defect")
    return defect


def create_defect(db: Session, project_id: int, payload: DefectCreate, current_user: User) -> Defect:
    get_project_or_404(db, project_id)
    defect = Defect(**payload.model_dump(), project_id=project_id, reported_by=current_user.id)
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return defect


def update_defect(db: Session, defect_id: int, payload: DefectUpdate) -> Defect:
    defect = get_defect(db, defect_id)
    apply_updates(defect, payload)
    db.commit()
    db.refresh(defect)
    return defect


def delete_defect(db: Session, defect_id: int) -> None:
    defect = get_defect(db, defect_id)
    db.delete(defect)
    db.commit()
