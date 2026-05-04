from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]
BearerToken = Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))]


def get_current_user(db: DbSession, credentials: BearerToken = None) -> User:
    if credentials is not None:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub") if payload else None
        if user_id is not None:
            try:
                user = db.get(User, int(user_id))
            except ValueError:
                user = None
            if user is not None and user.is_active:
                return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Neplatný nebo expirovaný token.")

    # Development fallback until full JWT auth and password verification are wired into the frontend.
    user = db.query(User).filter(User.is_active.is_(True)).order_by(User.id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nejprve založ uživatele nebo spusť seed data.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
