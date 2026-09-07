from fastapi import APIRouter, Header, HTTPException, Query

from app.api.deps import CurrentUser, DbSession
from app.models import TestCaseDraft, TestCaseEvent, TestCaseVersion
from app.schemas.test_case_workflow import Assignment, DraftCreate, DraftExecution, DraftSave, ProposalCreate, ReviewCommentCreate, ReviewDecision, RevisionRequest, Submission
from app.services import test_case_reviews as reviews, test_case_versions as versions
from app.services.run_case_creation import execute_draft, lock_run
from app.services.test_case_operations import mutate
from app.services.test_case_snapshots import diff

router = APIRouter(tags=["Schvalování a verze"])


@router.post("/case-proposals", status_code=201)
def create_proposal(payload: ProposalCreate, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, "proposal", payload, lambda: versions.draft_read(db, versions.create_proposal(db, payload, user)))


@router.post("/test-cases/{case_id}/drafts", status_code=201)
def create_draft(case_id: int, payload: DraftCreate, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"case/{case_id}/draft", payload, lambda: versions.draft_read(db, versions.create_draft(db, case_id, payload, user)))


@router.get("/test-case-drafts")
def drafts(db: DbSession, user: CurrentUser, case_id: int | None = None, origin_run_id: int | None = None, mine: bool = False,
           limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    query = db.query(TestCaseDraft).filter(TestCaseDraft.status.in_(["open", "submitted"]))
    if case_id:
        query = query.filter(TestCaseDraft.test_case_id == case_id)
    if origin_run_id:
        query = query.filter(TestCaseDraft.origin_run_id == origin_run_id)
    if mine:
        query = query.filter(TestCaseDraft.editor_id == user.id)
    return {"total": query.count(), "items": [versions.draft_read(db, d) for d in query.order_by(TestCaseDraft.updated_at.desc(), TestCaseDraft.id.desc()).offset(offset).limit(limit)]}


@router.get("/test-case-drafts/{draft_id}")
def draft(draft_id: int, db: DbSession):
    return versions.draft_read(db, versions.get_draft(db, draft_id))


@router.patch("/test-case-drafts/{draft_id}")
def save_draft(draft_id: int, payload: DraftSave, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"draft/{draft_id}/save", payload, lambda: versions.draft_read(db, versions.save_draft(db, draft_id, payload, user)))


@router.post("/test-case-drafts/{draft_id}/takeovers")
def takeover(draft_id: int, payload: RevisionRequest, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"draft/{draft_id}/takeover", payload, lambda: versions.draft_read(db, versions.takeover(db, draft_id, payload.lock_version, user)))


@router.post("/test-case-drafts/{draft_id}/submissions", status_code=201)
def submit(draft_id: int, payload: Submission, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"draft/{draft_id}/submit", payload, lambda: reviews.read(db, reviews.submit(db, draft_id, payload, user)))


@router.get("/test-cases/{case_id}/versions")
def history(case_id: int, db: DbSession, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    query = db.query(TestCaseVersion).filter(TestCaseVersion.test_case_id == case_id)
    return {"total": query.count(), "items": [versions.version_read(db, v) for v in query.order_by(TestCaseVersion.version_number.desc()).offset(offset).limit(limit)]}


@router.get("/test-case-versions/{version_id}")
def version(version_id: int, db: DbSession):
    row = db.get(TestCaseVersion, version_id)
    if not row:
        raise HTTPException(404, "Verze neexistuje.")
    return versions.version_read(db, row)


@router.get("/test-case-versions/{version_id}/diff")
def version_diff(version_id: int, base_version_id: int, db: DbSession):
    before, after = db.get(TestCaseVersion, base_version_id), db.get(TestCaseVersion, version_id)
    if not before or not after or before.test_case_id != after.test_case_id:
        raise HTTPException(422, "Vyberte dvě verze stejného test case.")
    return diff(before.content_snapshot, after.content_snapshot)


@router.get("/test-case-reviews")
def queue(db: DbSession, user: CurrentUser, status: str | None = None, q: str | None = None, mine: bool = False,
          unassigned: bool = False, decided: bool = False, origin_run_id: int | None = None,
          business_area_id: list[int] | None = Query(None), application_domain_id: list[int] | None = Query(None), object_type_id: list[int] | None = Query(None),
          limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return reviews.queue(db, user, status=status, q=q, mine=mine, unassigned=unassigned, decided=decided, origin_run_id=origin_run_id,
                         tags={"business_area": business_area_id, "application_domain": application_domain_id, "object_type": object_type_id}, limit=limit, offset=offset)


@router.get("/test-case-reviews/{review_id}")
def review(review_id: int, db: DbSession):
    return reviews.read(db, reviews.get_review(db, review_id), detail=True)


@router.post("/test-case-reviews/{review_id}/decisions")
def decision(review_id: int, payload: ReviewDecision, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"review/{review_id}/decide", payload, lambda: reviews.read(db, reviews.decide(db, review_id, payload, user), detail=True))


@router.post("/test-case-reviews/{review_id}/withdrawals")
def withdrawal(review_id: int, payload: RevisionRequest, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"review/{review_id}/withdraw", payload, lambda: reviews.read(db, reviews.withdraw(db, review_id, payload.lock_version, user), detail=True))


@router.patch("/test-case-reviews/{review_id}/assignment")
def assignment(review_id: int, payload: Assignment, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"review/{review_id}/assign", payload, lambda: reviews.read(db, reviews.assign(db, review_id, payload, user), detail=True))


@router.post("/test-case-reviews/{review_id}/comments", status_code=201)
def comment(review_id: int, payload: ReviewCommentCreate, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"review/{review_id}/comment", payload, lambda: versions.row_read(reviews.add_comment(db, review_id, payload, user)))


@router.post("/test-case-review-comments/{comment_id}/resolutions")
def resolve(comment_id: int, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"comment/{comment_id}/resolve", {}, lambda: versions.row_read(reviews.resolve_comment(db, comment_id, user)))


@router.post("/test-runs/{run_id}/case-drafts", status_code=201)
def run_draft(run_id: int, payload: ProposalCreate, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    def action():
        run, attempt = lock_run(db, run_id, user, open_required=False)
        return versions.draft_read(db, versions.create_proposal(db, payload, user, run=run, run_attempt=attempt))
    return mutate(db, user, idempotency_key, f"run/{run_id}/draft", payload, action)


@router.post("/test-runs/{run_id}/draft-executions", status_code=201)
def run_execution(run_id: int, payload: DraftExecution, db: DbSession, user: CurrentUser, idempotency_key: str = Header()):
    return mutate(db, user, idempotency_key, f"run/{run_id}/execute", payload, lambda: execute_draft(db, run_id, payload, user))


@router.get("/test-runs/{run_id}/case-proposals")
def run_proposals(run_id: int, db: DbSession, user: CurrentUser):
    return drafts(db, user, origin_run_id=run_id, limit=100, offset=0)


@router.get("/test-cases/{case_id}/events")
def events(case_id: int, db: DbSession, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return [versions.row_read(e) for e in db.query(TestCaseEvent).filter(TestCaseEvent.test_case_id == case_id).order_by(TestCaseEvent.id.desc()).offset(offset).limit(limit)]
