from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.core.security import hash_password

from app.models import User


def list_active_users(db: Session) -> list[User]:
    return db.query(User).filter(User.is_active.is_(True)).order_by(User.name.asc()).all()


def create_user(db: Session, payload, actor: User):
    if actor.role != "admin":
        raise HTTPException(403, "Uživatele může vytvořit pouze admin.")
    email = str(payload.email).lower()
    if db.query(User.id).filter(func.lower(User.email) == email).first():
        raise HTTPException(409, "Uživatel s tímto e-mailem již existuje.")
    user = User(name=payload.name, email=email, role=payload.role, is_active=True,
                password_hash=hash_password(payload.password.get_secret_value()))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Uživatel s tímto e-mailem již existuje.") from exc
    return user


def update_role(db: Session, user_id: int, role: str, actor: User):
    if actor.role != "admin":
        raise HTTPException(403, "Role může spravovat pouze admin.")
    if actor.id == user_id:
        raise HTTPException(409, "Vlastní roli zde nelze měnit.")
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user or not user.is_active:
        raise HTTPException(404, "Aktivní uživatel neexistuje.")
    user.role = role
    db.commit()
    return user
