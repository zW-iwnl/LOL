from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.defect import DefectCreate, DefectRead, DefectUpdate
from app.services import defects as defect_service

router = APIRouter(tags=["Defects"])


@router.get("/projects/{project_id}/defects", response_model=list[DefectRead])
def list_defects(project_id: int, db: DbSession):
    return defect_service.list_defects(db, project_id)


@router.post("/projects/{project_id}/defects", response_model=DefectRead, status_code=status.HTTP_201_CREATED)
def create_defect(project_id: int, payload: DefectCreate, db: DbSession, current_user: CurrentUser):
    return defect_service.create_defect(db, project_id, payload, current_user)


@router.get("/defects/{defect_id}", response_model=DefectRead)
def get_defect(defect_id: int, db: DbSession):
    return defect_service.get_defect(db, defect_id)


@router.put("/defects/{defect_id}", response_model=DefectRead)
def update_defect(defect_id: int, payload: DefectUpdate, db: DbSession):
    return defect_service.update_defect(db, defect_id, payload)


@router.delete("/defects/{defect_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_defect(defect_id: int, db: DbSession) -> Response:
    defect_service.delete_defect(db, defect_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
