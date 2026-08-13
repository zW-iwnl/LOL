from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.models import AuditEvent, User


def record_event(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    action: str,
    actor: User | None = None,
    changes: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor.id if actor else None,
        changes=jsonable_encoder(changes) if changes is not None else None,
    )
    db.add(event)
    return event


def list_events(
    db: Session,
    *,
    entity_type: str | None = None,
    entity_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditEvent]:
    query = db.query(AuditEvent)
    if entity_type is not None:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditEvent.entity_id == entity_id)
    return query.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit).all()
