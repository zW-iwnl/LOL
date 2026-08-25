from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.dashboard import DashboardRead
from app.services import dashboard as dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardRead)
def get_dashboard(db: DbSession):
    return dashboard_service.get_dashboard(db)
