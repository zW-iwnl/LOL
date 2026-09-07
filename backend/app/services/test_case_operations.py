from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.models import TestCaseOperation, User
from app.services.test_case_snapshots import content_hash


def mutate(db, user, key, operation, payload, action):
    """Retry-safe transaction including the domain mutation and its response."""
    if not key or len(key) > 100:
        raise HTTPException(422, "Chybí platný Idempotency-Key.")
    # Hash client-supplied fields, not default-generated step UUIDs. Otherwise
    # retrying the same JSON without step_key incorrectly conflicts with itself.
    supplied = payload.model_dump(mode="json", exclude_unset=True) if isinstance(payload, BaseModel) else jsonable_encoder(payload)
    request_hash = content_hash({"operation": operation, "payload": supplied})
    # Serializes retries from this actor before taking run/identity locks.
    db.query(User.id).filter(User.id == user.id).with_for_update().first()
    previous = db.query(TestCaseOperation).filter_by(actor_id=user.id, key=key).first()
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "Klíč požadavku byl použit s jiným obsahem.")
        return previous.response
    try:
        result = jsonable_encoder(action())
        db.add(TestCaseOperation(actor_id=user.id, key=key, request_hash=request_hash, response=result))
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Konflikt souběžné změny nebo použitý kód. Obnovte data.") from exc
    except Exception:
        db.rollback()
        raise
