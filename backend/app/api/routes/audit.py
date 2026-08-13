from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.audit import AuditEventRead
from app.services import audit as audit_service

router = APIRouter(tags=["Audit"])


@router.get("/audit-events", response_model=list[AuditEventRead])
def list_audit_events(
    db: DbSession,
    entity_type: str | None = Query(default=None, min_length=1, max_length=80),
    entity_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return audit_service.list_events(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )
