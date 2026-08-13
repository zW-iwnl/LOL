from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Defect, TestRun, TestRunCase, User
from app.schemas.defect import DefectCreate, DefectUpdate
from app.schemas.common import DefectStatus
from app.services.audit import record_event
from app.services.common import apply_updates, get_project_or_404, not_found

ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "open": {"open", "in_progress", "rejected"},
    "in_progress": {"in_progress", "fixed", "rejected"},
    "fixed": {"fixed", "retest", "closed"},
    "retest": {"retest", "in_progress", "closed"},
    "closed": {"closed", "open"},
    "rejected": {"rejected", "open"},
}


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


def _validate_assignee(db: Session, assigned_to: int | None) -> None:
    if assigned_to is None:
        return
    user = db.get(User, assigned_to)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Přiřazený uživatel neexistuje.")


def _validate_test_run_case(db: Session, project_id: int, test_run_case_id: int | None) -> None:
    if test_run_case_id is None:
        return
    run_case = db.get(TestRunCase, test_run_case_id)
    if run_case is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test run case neexistuje.")
    test_run = db.get(TestRun, run_case.test_run_id)
    if test_run is None or test_run.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test run case patří do jiného projektu.")


def _validate_status_transition(current_status: str, next_status: DefectStatus | None) -> None:
    if next_status is None:
        return
    if next_status not in ALLOWED_STATUS_TRANSITIONS[current_status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Neplatný přechod defectu ze stavu {current_status} do {next_status}.",
        )


def _changed_values(defect: Defect, payload: DefectUpdate) -> dict[str, dict[str, object | None]]:
    changes: dict[str, dict[str, object | None]] = {}
    data = payload.model_dump(exclude_unset=True)
    for field, new_value in data.items():
        old_value = getattr(defect, field)
        if old_value != new_value:
            changes[field] = {"from": old_value, "to": new_value}
    return changes


def create_defect(db: Session, project_id: int, payload: DefectCreate, current_user: User) -> Defect:
    get_project_or_404(db, project_id)
    _validate_assignee(db, payload.assigned_to)
    _validate_test_run_case(db, project_id, payload.test_run_case_id)
    defect = Defect(**payload.model_dump(), project_id=project_id, reported_by=current_user.id)
    db.add(defect)
    db.flush()
    record_event(
        db,
        entity_type="Defect",
        entity_id=defect.id,
        action="created",
        actor=current_user,
        changes=payload.model_dump(),
    )
    db.commit()
    db.refresh(defect)
    return defect


def update_defect(db: Session, defect_id: int, payload: DefectUpdate, current_user: User) -> Defect:
    defect = get_defect(db, defect_id)
    _validate_assignee(db, payload.assigned_to)
    _validate_test_run_case(db, defect.project_id, payload.test_run_case_id)
    _validate_status_transition(defect.status, payload.status)
    changes = _changed_values(defect, payload)
    apply_updates(defect, payload)
    if changes:
        record_event(
            db,
            entity_type="Defect",
            entity_id=defect.id,
            action="updated",
            actor=current_user,
            changes=changes,
        )
    db.commit()
    db.refresh(defect)
    return defect


def delete_defect(db: Session, defect_id: int) -> None:
    defect = get_defect(db, defect_id)
    db.delete(defect)
    db.commit()
