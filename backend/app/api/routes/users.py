from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.user_management import UserCreate, UserRoleUpdate
from app.schemas.auth import UserRead
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserRead])
def list_users(db: DbSession):
    return user_service.list_active_users(db)


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, db: DbSession, current_user: CurrentUser):
    return user_service.create_user(db, payload, current_user)


@router.patch("/{user_id}/role", response_model=UserRead)
def update_role(user_id: int, payload: UserRoleUpdate, db: DbSession, current_user: CurrentUser):
    return user_service.update_role(db, user_id, payload.role, current_user)
