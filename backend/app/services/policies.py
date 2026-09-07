from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import TestRunCase, User

REVIEW_ROLES = {"reviewer", "test_lead", "admin"}
LEAD_ROLES = {"test_lead", "admin"}


def require_reviewer(user: User):
    if not user.is_active or user.role not in REVIEW_ROLES:
        raise HTTPException(403, "Nemáte oprávnění schvalovat test cases.")


def require_run_execution(db: Session, run, user: User):
    if user.role in LEAD_ROLES or run.created_by == user.id:
        return
    if db.query(TestRunCase.id).filter(TestRunCase.test_run_id == run.id, TestRunCase.assigned_to == user.id).first():
        return
    raise HTTPException(403, "Nejste autor ani přiřazený tester tohoto runu.")
