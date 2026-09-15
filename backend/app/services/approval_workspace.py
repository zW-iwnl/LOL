"""Bounded, snapshot-aware reads for the review workspace."""
from fastapi import HTTPException
from sqlalchemy import Integer, cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import aliased

from app.models import TestCase, TestCaseDraft, TestCaseReview, TestCaseReviewComment, TestCaseVersion, TestCaseVersionTag, TestRun, User
from app.services.repository_workspace import _normalized, _search_expression, _origins, _scope_groups


def text_filter(db, query, q, fields):
    for word in _normalized(q or "").split():
        pattern = "%" + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(or_(*[_search_expression(db, field).like(pattern, escape="\\") for field in fields]))
    return query


def group_filter(db, query, group_id, include_descendants, case_column):
    if group_id is None:
        return query
    from app.models import SuiteGroup
    if db.get(SuiteGroup, group_id) is None:
        raise HTTPException(404, "Skupina neexistuje.")
    origins = _origins(_scope_groups(group_id, include_descendants))
    return query.filter(case_column.in_(select(origins.c.case_id)))


def queue(db, user, *, status=None, q=None, mine=False, assigned_to_me=False, author_id=None, reviewer_id=None,
          unassigned=False, decided=False, origin_run_id=None, case_id=None, suite_id=None, group_id=None, include_descendants=True,
          tags=None, offset=0, limit=50):
    author, reviewer = aliased(User), aliased(User)
    title = TestCaseVersion.content_snapshot["title"].as_string()
    code = TestCaseVersion.content_snapshot["code"].as_string()
    blocked = select(func.count(TestCaseReviewComment.id)).where(TestCaseReviewComment.review_id == TestCaseReview.id,
        TestCaseReviewComment.is_blocking.is_(True), TestCaseReviewComment.resolved_at.is_(None)).correlate(TestCaseReview).scalar_subquery()
    query = db.query(TestCaseReview, TestCaseVersion.version_number, title.label("title"), code.label("code"),
        TestCaseVersion.origin_run_id, TestCaseVersion.source_draft_id, author.name.label("author_name"), reviewer.name.label("reviewer_name"),
        blocked.label("blocking_count"), TestRun.name.label("origin_run_name"), TestRun.task_number.label("origin_task_number"))\
        .join(TestCaseVersion, TestCaseVersion.id == TestCaseReview.test_case_version_id)\
        .join(author, author.id == TestCaseReview.submitted_by).outerjoin(reviewer, reviewer.id == TestCaseReview.reviewer_id)\
        .outerjoin(TestRun, TestRun.id == TestCaseVersion.origin_run_id)
    if case_id: query = query.filter(TestCaseReview.test_case_id == case_id)
    if status: query = query.filter(TestCaseReview.status == status)
    if decided: query = query.filter(TestCaseReview.status != "pending")
    if mine: query = query.filter(TestCaseReview.submitted_by == user.id)
    if assigned_to_me: query = query.filter(TestCaseReview.reviewer_id == user.id)
    if author_id: query = query.filter(TestCaseReview.submitted_by == author_id)
    if reviewer_id: query = query.filter(TestCaseReview.reviewer_id == reviewer_id)
    if unassigned: query = query.filter(TestCaseReview.reviewer_id.is_(None))
    if origin_run_id: query = query.filter(TestCaseVersion.origin_run_id == origin_run_id)
    if suite_id: query = query.filter(TestCaseVersion.content_snapshot["suite_id"].as_integer() == suite_id)
    query = group_filter(db, query, group_id, include_descendants, TestCaseReview.test_case_id)
    query = text_filter(db, query, q, [title, code])
    for category, ids in (tags or {}).items():
        if ids:
            query = query.filter(TestCaseVersion.id.in_(select(TestCaseVersionTag.version_id).where(
                TestCaseVersionTag.category == category, TestCaseVersionTag.tag_id.in_(ids))))
    total = query.count()
    order = (TestCaseReview.decided_at.desc(), TestCaseReview.id.desc()) if decided else (TestCaseReview.created_at, TestCaseReview.id)
    from app.services.test_case_versions import row_read
    items = []
    for row in query.order_by(*order).offset(offset).limit(limit).all():
        values = dict(row._mapping); review = values.pop("TestCaseReview")
        items.append({**row_read(review), **values})
    return {"total": total, "items": items, "offset": offset, "limit": limit}


def draft_summaries(db, user, *, mine=False, q=None, origin_run_id=None, suite_id=None, group_id=None, include_descendants=True,
                    author_id=None, tags=None, offset=0, limit=50):
    title = TestCaseDraft.content["title"].as_string()
    query = db.query(TestCaseDraft.id, TestCaseDraft.test_case_id, TestCase.code, title.label("title"), TestCase.suite_id,
        TestCaseDraft.status, TestCaseDraft.editor_id, User.name.label("editor_name"), TestCaseDraft.updated_at, TestCaseDraft.origin_run_id,
        TestRun.name.label("origin_run_name"), TestRun.task_number.label("origin_task_number"))\
        .join(TestCase, TestCase.id == TestCaseDraft.test_case_id).join(User, User.id == TestCaseDraft.editor_id)\
        .outerjoin(TestRun, TestRun.id == TestCaseDraft.origin_run_id).filter(TestCaseDraft.status == "open", TestCase.status != "deprecated")
    if mine: query = query.filter(TestCaseDraft.editor_id == user.id)
    if author_id: query = query.filter(TestCaseDraft.editor_id == author_id)
    if suite_id: query = query.filter(TestCase.suite_id == suite_id)
    if origin_run_id: query = query.filter(TestCaseDraft.origin_run_id == origin_run_id)
    query = group_filter(db, query, group_id, include_descendants, TestCase.id)
    query = text_filter(db, query, q, [TestCase.code, title])
    for ids in (tags or {}).values():
        if not ids: continue
        if db.get_bind().dialect.name == "postgresql":
            entries = func.jsonb_array_elements_text(cast(TestCaseDraft.content["tag_ids"], JSONB)).table_valued("value")
        else:
            entries = func.json_each(TestCaseDraft.content["tag_ids"]).table_valued("value")
        query = query.filter(select(1).select_from(entries).where(cast(entries.c.value, Integer).in_(ids)).exists())
    total = query.count()
    return {"total": total, "offset": offset, "limit": limit,
        "items": [dict(row._mapping) for row in query.order_by(TestCaseDraft.updated_at.desc(), TestCaseDraft.id.desc()).offset(offset).limit(limit).all()]}


def capabilities(db, review, version, user, comments):
    from app.services.policies import LEAD_ROLES, REVIEW_ROLES
    draft = db.get(TestCaseDraft, version.source_draft_id)
    case = db.get(TestCase, review.test_case_id)
    contributors = set(draft.contributors if draft else []) | {version.created_by, review.submitted_by}
    eligible = db.query(User).filter(User.is_active.is_(True), User.role.in_(REVIEW_ROLES), User.id.notin_(contributors)).order_by(User.name, User.id).all()
    independent = user.id in {person.id for person in eligible}
    lead = user.role in LEAD_ROLES
    pending = review.status == "pending"
    reason = None
    if not pending: reason = "Žádost je uzavřená."
    elif case.status == "deprecated": reason = "Test case je vyřazený."
    elif not independent: reason = "Rozhodnout může pouze nezávislý reviewer."
    elif not lead and review.reviewer_id != user.id: reason = "Nejprve si žádost převezměte nebo požádejte o přiřazení."
    approve_reason = reason
    if approve_reason is None and any(c.is_blocking and c.resolved_at is None for c in comments): approve_reason = "Nejprve vyřešte blokující připomínky."
    if approve_reason is None and review.base_approved_version_id != case.current_approved_version_id: approve_reason = "Publikovaná verze se změnila. Návrh je nutné znovu porovnat."
    return {"can_decide": reason is None, "can_approve": approve_reason is None, "decision_reason": reason, "approval_reason": approve_reason,
        "can_claim": pending and independent and review.reviewer_id is None,
        "can_assign": pending and lead, "can_comment": pending, "can_block": pending and independent,
        "can_withdraw": pending and user.id in (review.submitted_by, draft.editor_id if draft else None),
        "resolvable_comment_ids": [c.id for c in comments if pending and c.resolved_at is None and (lead or user.id in (c.author_id, review.reviewer_id, draft.editor_id if draft else None))],
        "eligible_reviewers": [{"id": person.id, "name": person.name} for person in eligible]}
