from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import LoginRequest
from app.core.security import create_access_token, verify_password


def login(db: Session, payload: LoginRequest) -> str:
    user = db.query(User).filter(User.email == payload.email, User.is_active.is_(True)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Neplatné přihlášení.")
    return create_access_token(str(user.id))
