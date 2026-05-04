from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    token = auth_service.login(db, payload)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserRead)
def me(current_user: CurrentUser) -> CurrentUser:
    return current_user
