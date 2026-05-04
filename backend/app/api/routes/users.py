from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.auth import UserRead
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserRead])
def list_users(db: DbSession):
    return user_service.list_active_users(db)
