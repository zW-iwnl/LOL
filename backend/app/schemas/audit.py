from app.schemas.common import TimestampFields


class AuditEventRead(TimestampFields):
    id: int
    entity_type: str
    entity_id: int
    action: str
    actor_id: int | None
    changes: dict | None
