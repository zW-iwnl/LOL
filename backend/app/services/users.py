from sqlalchemy.orm import Session

from app.models import User


def list_active_users(db: Session) -> list[User]:
    return db.query(User).filter(User.is_active.is_(True)).order_by(User.name.asc()).all()
