"""Draft transactions. Callers own the commit, including run-origin operations."""
from copy import deepcopy
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import TestCase, TestCaseDraft, TestCaseEvent, TestCaseReview, TestCaseVersion, TestCaseVersionTag, TestSuite, User
from app.schemas.test_case_workflow import ProposalCreate
from app.services import test_case_snapshots as snapshots
from app.services.policies import LEAD_ROLES, require_run_execution


def event(db: Session, case_id: int, user: User, kind: str, **payload):
    db.add(TestCaseEvent(test_case_id=case_id, actor_id=user.id, event_type=kind, payload=payload))


def lock_case(db: Session, case_id: int) -> TestCase:
    case = db.query(TestCase).filter(TestCase.id == case_id).with_for_update().populate_existing().first()
    if not case:
        raise HTTPException(404, "Test case neexistuje.")
    return case


def require_active(case):
    if case.status == "deprecated":
        raise HTTPException(409, "Archivovaný test case nelze měnit ani nově provádět.")


def get_draft(db: Session, draft_id: int) -> TestCaseDraft:
    draft = db.get(TestCaseDraft, draft_id)
    if not draft:
        raise HTTPException(404, "Návrh neexistuje.")
    return draft


def lock_draft(db: Session, draft_id: int, user: User, revision: int | None = None, *, editable=True):
    draft = get_draft(db, draft_id)
    case = lock_case(db, draft.test_case_id)
    db.refresh(draft)
    require_active(case)
    if draft.editor_id != user.id:
        raise HTTPException(403, "Návrh může upravit nebo odeslat pouze jeho přidělený editor.")
    if revision is not None and draft.lock_version != revision:
        raise HTTPException(412, "Návrh byl změněn. Obnovte jej před dalším zápisem.")
    if editable and draft.status != "open":
        raise HTTPException(409, "Návrh je odeslaný nebo uzavřený. Nejprve stáhněte žádost.")
    return case, draft


def create_proposal(db: Session, payload: ProposalCreate, user: User, *, run=None, run_attempt=None):
    suite = db.get(TestSuite, payload.suite_id)
    if not suite or not suite.is_active:
        raise HTTPException(422, "Vyberte aktivní test suitu.")
    content = snapshots.validate_content(db, payload.content.model_dump(mode="json"))
    code = (payload.code or f"TC-{uuid4().hex[:12].upper()}").strip()
    if not code or db.query(TestCase.id).filter(TestCase.code == code).first():
        raise HTTPException(409, "Kód test case je prázdný nebo již existuje.")
    case = TestCase(suite_id=suite.id, code=code, title=content["title"], status="draft", created_by=user.id,
                    version=1, next_version_number=1, origin_run_id=run.id if run else None)
    db.add(case)
    db.flush()
    draft = TestCaseDraft(test_case_id=case.id, content=content, editor_id=user.id, created_by=user.id,
                          contributors=[user.id], origin_run_id=run.id if run else None,
                          origin_run_attempt_id=run_attempt.id if run_attempt else None)
    db.add(draft)
    db.flush()
    event(db, case.id, user, "draft_created", draft_id=draft.id, origin_run_id=draft.origin_run_id)
    return draft


def create_draft(db: Session, case_id: int, payload, user: User):
    from app.models import TestRunCaseAttempt
    origin = db.get(TestRunCaseAttempt, payload.origin_case_attempt_id) if payload.origin_case_attempt_id else None
    if payload.origin_case_attempt_id:
        if not origin or origin.test_run_case.test_case_id != case_id:
            raise HTTPException(422, "Zdrojový pokus nepatří k test case.")
        require_run_execution(db, origin.test_run_attempt.test_run, user)
    case = lock_case(db, case_id)
    require_active(case)
    existing = db.query(TestCaseDraft).filter(TestCaseDraft.test_case_id == case_id, TestCaseDraft.status.in_(["open", "submitted"])).first()
    if existing:
        raise HTTPException(409, f"Test case již má otevřený návrh #{existing.id} (editor #{existing.editor_id}).")
    version_id = payload.base_version_id or (origin.test_case_version_id if origin else case.current_approved_version_id)
    version = db.get(TestCaseVersion, version_id) if version_id else None
    if version_id and (not version or version.test_case_id != case.id):
        raise HTTPException(422, "Výchozí verze nepatří k test case.")
    source = origin.execution_snapshot if origin and not payload.base_version_id else (version.content_snapshot if version else None)
    content = snapshots.from_snapshot(source) if source else snapshots.from_live(case)
    draft = TestCaseDraft(test_case_id=case.id, base_version_id=version.id if version else None,
                          base_approved_version_id=case.current_approved_version_id, content=content,
                          editor_id=user.id, created_by=user.id, contributors=[user.id],
                          origin_run_id=origin.test_run_case.test_run_id if origin else None,
                          origin_run_attempt_id=origin.test_run_attempt_id if origin else None,
                          origin_case_attempt_id=origin.id if origin else None)
    db.add(draft)
    db.flush()
    event(db, case.id, user, "draft_created", draft_id=draft.id, base_version_id=version_id)
    return draft


def save_draft(db: Session, draft_id: int, payload, user: User):
    case, draft = lock_draft(db, draft_id, user, payload.lock_version)
    draft.content = snapshots.validate_content(db, payload.content.model_dump(mode="json"))
    draft.change_summary = payload.change_summary.strip()
    draft.lock_version += 1
    draft.contributors = sorted(set(draft.contributors + [user.id]))
    event(db, case.id, user, "draft_saved", draft_id=draft.id, revision=draft.lock_version)
    return draft


def freeze(db: Session, case: TestCase, draft: TestCaseDraft, user: User) -> TestCaseVersion:
    content = snapshots.validate_content(db, draft.content, executable=True)
    previous = db.get(TestCaseVersion, draft.last_frozen_version_id) if draft.last_frozen_version_id else None
    if previous and snapshots.from_snapshot(previous.content_snapshot) == content and version_state(db, previous.id) not in ("changes_requested", "rejected"):
        return previous
    frozen = snapshots.snapshot(db, case, content)
    version = TestCaseVersion(test_case_id=case.id, version_number=case.next_version_number,
                              source_draft_id=draft.id, base_version_id=draft.base_version_id,
                              content_snapshot=frozen, content_hash=snapshots.content_hash(frozen),
                              created_by=user.id, change_summary=draft.change_summary,
                              origin_run_id=draft.origin_run_id)
    case.next_version_number += 1
    db.add(version)
    db.flush()
    draft.last_frozen_version_id = version.id
    db.add_all([TestCaseVersionTag(version_id=version.id, tag_id=t["id"], category=t["category"], name_snapshot=t["name"]) for t in frozen["tags"]])
    event(db, case.id, user, "version_frozen", version_id=version.id, version_number=version.version_number)
    return version


def version_state(db: Session, version_id: int | None) -> str:
    version = db.get(TestCaseVersion, version_id) if version_id else None
    if not version:
        return "unknown"
    if version.approval_basis:
        return "legacy_import" if version.approval_basis == "legacy_import" else "approved"
    review = db.query(TestCaseReview).filter(TestCaseReview.test_case_version_id == version.id).order_by(TestCaseReview.id.desc()).first()
    return review.status if review else "unsubmitted"


def version_read(db: Session, version):
    draft = db.get(TestCaseDraft, version.source_draft_id) if version.source_draft_id else None
    return {**row_read(version), "approval_state": version_state(db, version.id),
            "contributors": draft.contributors if draft else [version.created_by]}


def row_read(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def draft_read(db: Session, draft):
    case = db.get(TestCase, draft.test_case_id)
    return {**row_read(draft), "code": case.code, "suite_id": case.suite_id,
            "published_version_id": case.current_approved_version_id}


def takeover(db: Session, draft_id: int, revision: int, user: User):
    if user.role not in LEAD_ROLES:
        raise HTTPException(403, "Návrh může převzít pouze vedoucí nebo admin.")
    draft = get_draft(db, draft_id)
    case = lock_case(db, draft.test_case_id)
    db.refresh(draft)
    require_active(case)
    if draft.lock_version != revision:
        raise HTTPException(412, "Návrh byl změněn.")
    if draft.status != "open":
        raise HTTPException(409, "Lze převzít pouze otevřený návrh.")
    event(db, case.id, user, "draft_taken_over", draft_id=draft.id, previous_editor_id=draft.editor_id)
    draft.editor_id = user.id
    draft.contributors = sorted(set(draft.contributors + [user.id]))
    draft.lock_version += 1
    return draft
