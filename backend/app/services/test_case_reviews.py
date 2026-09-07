from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import TestCase, TestCaseDraft, TestCaseReview, TestCaseReviewComment, TestCaseVersion, TestCaseVersionTag, TestStep, User
from app.services import test_case_versions as versions
from app.services.policies import LEAD_ROLES, require_reviewer
from app.services.test_case_snapshots import diff


def independent(db: Session, version, user):
    require_reviewer(user)
    draft = db.get(TestCaseDraft, version.source_draft_id)
    if user.id == version.created_by or (draft and user.id in draft.contributors):
        raise HTTPException(403, "Vlastní návrh ani návrh, který jste upravovali, nemůžete schvalovat.")


def submit(db: Session, draft_id: int, payload, user):
    case, draft = versions.lock_draft(db, draft_id, user, payload.lock_version)
    if not payload.change_summary.strip():
        raise HTTPException(422, "Doplňte důvod změny.")
    draft.change_summary = payload.change_summary.strip()
    version = versions.freeze(db, case, draft, user)
    if payload.reviewer_id:
        reviewer = db.get(User, payload.reviewer_id)
        if not reviewer or not reviewer.is_active:
            raise HTTPException(422, "Reviewer není aktivní.")
        independent(db, version, reviewer)
    previous = db.query(TestCaseReview).filter(TestCaseReview.test_case_id == case.id).order_by(TestCaseReview.id.desc()).first()
    review = TestCaseReview(test_case_id=case.id, test_case_version_id=version.id,
                            base_approved_version_id=draft.base_approved_version_id, submitted_by=user.id,
                            reviewer_id=payload.reviewer_id, supersedes_review_id=previous.id if previous else None)
    db.add(review)
    draft.status = "submitted"
    draft.lock_version += 1
    db.flush()
    versions.event(db, case.id, user, "review_submitted", review_id=review.id, version_id=version.id)
    return review


def get_review(db, review_id):
    review = db.get(TestCaseReview, review_id)
    if not review:
        raise HTTPException(404, "Žádost neexistuje.")
    return review


def lock_review(db, review_id, revision):
    review = get_review(db, review_id)
    case = versions.lock_case(db, review.test_case_id)
    db.refresh(review)
    if review.lock_version != revision:
        raise HTTPException(412, "Žádost byla změněna. Obnovte detail.")
    if review.status != "pending":
        raise HTTPException(409, "O žádosti již bylo rozhodnuto.")
    return case, review, db.get(TestCaseVersion, review.test_case_version_id)


def publish(db, case, version):
    from app.services.test_cases import _set_tag_assignments
    from app.services.test_case_tags import validate_tag_ids
    content = version.content_snapshot
    validate_tag_ids(db, content.get("tag_ids", []))
    for field in ("title", "description", "preconditions", "expected_summary", "automated"):
        setattr(case, field, content.get(field))
    _set_tag_assignments(case, content.get("tag_ids", []))
    # Projection IDs are not execution step IDs; attempts always use their snapshot.
    case.steps.clear()
    db.flush()
    case.steps = [TestStep(id=step["id"], **{field: step.get(field) for field in ("step_order", "action", "step_type", "note", "expected_result", "test_data")}) for step in content["steps"]]
    version.approval_basis = "review"
    db.flush()
    case.current_approved_version_id = version.id
    case.version = version.version_number
    case.status = "ready"


def decide(db, review_id, payload, user):
    case, review, version = lock_review(db, review_id, payload.lock_version)
    versions.require_active(case)
    independent(db, version, user)
    if user.id == review.submitted_by:
        raise HTTPException(403, "Vlastní žádost nemůžete schválit.")
    if review.reviewer_id != user.id and user.role not in LEAD_ROLES:
        raise HTTPException(403, "Nejprve si žádost převezměte.")
    if payload.status != "approved" and not payload.reason.strip():
        raise HTTPException(422, "Vrácení nebo zamítnutí vyžaduje důvod.")
    if payload.status == "approved":
        if review.base_approved_version_id != case.current_approved_version_id:
            raise HTTPException(409, "Publikovaná verze se změnila. Návrh je nutné znovu porovnat.")
        if db.query(TestCaseReviewComment.id).filter(TestCaseReviewComment.review_id == review.id, TestCaseReviewComment.is_blocking.is_(True), TestCaseReviewComment.resolved_at.is_(None)).first():
            raise HTTPException(409, "Nejprve vyřešte blokující připomínky.")
        publish(db, case, version)
    review.status = payload.status
    review.decided_by = user.id
    review.decided_at = datetime.now(timezone.utc)
    review.decision_reason = payload.reason.strip() or None
    review.lock_version += 1
    draft = db.get(TestCaseDraft, version.source_draft_id)
    draft.status = "open" if payload.status == "changes_requested" else "closed"
    draft.lock_version += 1
    versions.event(db, case.id, user, "review_decided", review_id=review.id, status=review.status, reason=review.decision_reason)
    return review


def withdraw(db, review_id, revision, user):
    case, review, version = lock_review(db, review_id, revision)
    draft = db.get(TestCaseDraft, version.source_draft_id)
    if user.id not in (review.submitted_by, draft.editor_id):
        raise HTTPException(403, "Žádost může stáhnout pouze její autor nebo editor.")
    review.status = "withdrawn"
    review.decided_by = user.id
    review.decided_at = datetime.now(timezone.utc)
    review.lock_version += 1
    draft.status = "open"
    draft.lock_version += 1
    versions.event(db, case.id, user, "review_withdrawn", review_id=review.id)
    return review


def assign(db, review_id, payload, user):
    case, review, version = lock_review(db, review_id, payload.lock_version)
    require_reviewer(user)
    if user.role not in LEAD_ROLES and (review.reviewer_id is not None or payload.reviewer_id != user.id):
        raise HTTPException(403, "Můžete pouze převzít nepřiřazenou žádost.")
    reviewer = db.get(User, payload.reviewer_id)
    if not reviewer or not reviewer.is_active:
        raise HTTPException(422, "Reviewer není aktivní.")
    independent(db, version, reviewer)
    review.reviewer_id = reviewer.id
    review.lock_version += 1
    versions.event(db, case.id, user, "review_assigned", review_id=review.id, reviewer_id=reviewer.id)
    return review


def add_comment(db, review_id, payload, user):
    review = get_review(db, review_id)
    versions.lock_case(db, review.test_case_id)
    db.refresh(review)
    if review.status != "pending":
        raise HTTPException(409, "Rozhodnutá žádost je pouze ke čtení.")
    if not payload.body.strip():
        raise HTTPException(422, "Připomínka nesmí být prázdná.")
    if payload.is_blocking:
        independent(db, db.get(TestCaseVersion, review.test_case_version_id), user)
    comment = TestCaseReviewComment(review_id=review.id, author_id=user.id, **payload.model_dump())
    db.add(comment)
    review.lock_version += 1
    versions.event(db, review.test_case_id, user, "review_comment_added", review_id=review.id)
    db.flush()
    return comment


def resolve_comment(db, comment_id, user):
    comment = db.get(TestCaseReviewComment, comment_id)
    if not comment:
        raise HTTPException(404, "Připomínka neexistuje.")
    review = get_review(db, comment.review_id)
    versions.lock_case(db, review.test_case_id)
    db.refresh(review)
    if review.status != "pending":
        raise HTTPException(409, "Žádost je uzavřená.")
    draft = db.get(TestCaseDraft, db.get(TestCaseVersion, review.test_case_version_id).source_draft_id)
    if user.id not in (draft.editor_id, review.reviewer_id, comment.author_id) and user.role not in LEAD_ROLES:
        raise HTTPException(403, "Připomínku nemůžete uzavřít.")
    comment.resolved_by = user.id
    comment.resolved_at = datetime.now(timezone.utc)
    review.lock_version += 1
    versions.event(db, review.test_case_id, user, "review_comment_resolved", comment_id=comment.id)
    return comment


def read(db, review, *, detail=False):
    version = db.get(TestCaseVersion, review.test_case_version_id)
    author = db.get(User, review.submitted_by)
    reviewer = db.get(User, review.reviewer_id) if review.reviewer_id else None
    result = {**versions.row_read(review), "version_number": version.version_number,
              "code": version.content_snapshot["code"], "title": version.content_snapshot["title"],
              "origin_run_id": version.origin_run_id, "source_draft_id": version.source_draft_id,
              "author_name": author.name, "reviewer_name": reviewer.name if reviewer else None}
    if detail:
        base = db.get(TestCaseVersion, review.base_approved_version_id) if review.base_approved_version_id else None
        result.update(version=versions.version_read(db, version), changes=diff(base.content_snapshot if base else {}, version.content_snapshot),
                      comments=[versions.row_read(c) for c in db.query(TestCaseReviewComment).filter(TestCaseReviewComment.review_id == review.id).order_by(TestCaseReviewComment.id)])
    return result


def queue(db, user, *, status=None, q=None, mine=False, unassigned=False, decided=False, origin_run_id=None, tags=None, offset=0, limit=50):
    query = db.query(TestCaseReview).join(TestCaseVersion, TestCaseVersion.id == TestCaseReview.test_case_version_id)
    if status:
        query = query.filter(TestCaseReview.status == status)
    if decided:
        query = query.filter(TestCaseReview.status != "pending")
    if mine:
        query = query.filter(or_(TestCaseReview.reviewer_id == user.id, TestCaseReview.submitted_by == user.id))
    if unassigned:
        query = query.filter(TestCaseReview.reviewer_id.is_(None))
    if origin_run_id:
        query = query.filter(TestCaseVersion.origin_run_id == origin_run_id)
    if q:
        query = query.filter(or_(TestCaseVersion.content_snapshot["title"].as_string().ilike(f"%{q.strip()}%"), TestCaseVersion.content_snapshot["code"].as_string().ilike(f"%{q.strip()}%")))
    for category, ids in (tags or {}).items():
        if ids:
            query = query.filter(TestCaseVersion.id.in_(db.query(TestCaseVersionTag.version_id).filter(TestCaseVersionTag.category == category, TestCaseVersionTag.tag_id.in_(ids))))
    total = query.count()
    return {"total": total, "items": [read(db, r) for r in query.order_by(TestCaseReview.created_at, TestCaseReview.id).offset(offset).limit(limit)]}
