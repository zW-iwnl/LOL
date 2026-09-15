"""Lightweight repository reads. Never load scenario steps for navigation/lists."""
import unicodedata

from sqlalchemy import func, literal, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import TestRunCase, TestCaseDraft, TestCaseReview, TestCaseVersion, SuiteGroup, SuiteGroupRelation, SuiteGroupMember, SuiteGroupTestCaseMember, TestCase, TestCaseTag, TestCaseTagAssignment, TestSuite
from app.schemas.repository_workspace import CaseOrigin, RepositoryCase, RepositoryCasePage, RepositoryGroup, RepositoryStructure
from app.schemas.repository_search import RepositorySearchTag
from app.services.common import not_found
from app.services.suite_groups import group_tags_by_id


def structure(db: Session) -> RepositoryStructure:
    groups = db.query(SuiteGroup).options(
        selectinload(SuiteGroup.incoming_relations), selectinload(SuiteGroup.outgoing_relations),
    ).order_by(SuiteGroup.sort_order, SuiteGroup.name, SuiteGroup.id).all()
    suite_counts = dict(db.query(SuiteGroupMember.group_id, func.count()).group_by(SuiteGroupMember.group_id).all())
    case_counts = dict(db.query(SuiteGroupTestCaseMember.group_id, func.count()).group_by(SuiteGroupTestCaseMember.group_id).all())
    tags = group_tags_by_id(db, [group.id for group in groups])
    return RepositoryStructure(groups=[RepositoryGroup(
        id=group.id, name=group.name, description=group.description, sort_order=group.sort_order,
        parent_ids=group.parent_ids, child_ids=group.child_ids, child_relations=group.child_relations,
        suite_count=suite_counts.get(group.id, 0), direct_case_count=case_counts.get(group.id, 0), tags=tags[group.id],
    ) for group in groups], test_case_count=db.query(func.count(TestCase.id)).scalar() or 0)


def _normalized(value: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFD", value.lower()) if not unicodedata.combining(char))


def _search_expression(db: Session, value):
    if db.get_bind().dialect.name == "sqlite":
        # SQLite is supported by the isolated tests and local installations.
        db.connection().connection.driver_connection.create_function("repository_normalize", 1, lambda text: _normalized(text or ""), deterministic=True)
        return func.repository_normalize(value)
    return func.translate(func.lower(value), "áčďéěíňóřšťúůýžäöüľĺŕ", "acdeeinorstuuyzaoullr")


def _scope_groups(group_id: int, include_descendants: bool):
    if not include_descendants:
        return select(SuiteGroup.id).where(SuiteGroup.id == group_id)
    # Start at this group, avoiding a transitive closure for unrelated roots.
    descendants = select(SuiteGroup.id.label("group_id"), literal(True).label("can_expand")).where(
        SuiteGroup.id == group_id).cte("repository_scope", recursive=True)
    descendants = descendants.union(select(SuiteGroupRelation.child_group_id, SuiteGroupRelation.include_descendants).join(
        descendants, SuiteGroupRelation.parent_group_id == descendants.c.group_id).where(descendants.c.can_expand.is_(True)))
    return select(descendants.c.group_id)


def _origins(group_ids):
    direct = select(SuiteGroupTestCaseMember.test_case_id.label("case_id"),
                    SuiteGroupTestCaseMember.group_id.label("group_id"), literal(None).label("suite_id")).where(
        SuiteGroupTestCaseMember.group_id.in_(group_ids))
    suites = select(TestCase.id.label("case_id"), SuiteGroupMember.group_id.label("group_id"),
                    TestCase.suite_id.label("suite_id")).join(SuiteGroupMember, SuiteGroupMember.suite_id == TestCase.suite_id).where(
        SuiteGroupMember.group_id.in_(group_ids))
    return direct.union(suites).cte("repository_case_origins")


def cases_page(db: Session, *, group_id: int | None = None, suite_id: int | None = None,
               include_descendants: bool = True, direct_only: bool = False,
               q: str = "", status: str | None = None, tag_ids: list[int] | None = None,
               offset: int = 0, limit: int = 50, eligible_only: bool = False, exclude_run_id: int | None = None) -> RepositoryCasePage:
    if group_id is not None and db.get(SuiteGroup, group_id) is None:
        raise not_found("Skupina suit")
    if suite_id is not None and db.get(TestSuite, suite_id) is None:
        raise not_found("Test suite")
    source = _origins(_scope_groups(group_id, include_descendants)) if group_id is not None else None
    query = db.query(TestCase.id, TestCase.code, TestCase.title, TestCase.suite_id,
                     TestCase.status, TestCase.automated, TestSuite.name.label("suite_name"),
                     TestCase.version, TestCase.current_approved_version_id).join(TestSuite, TestSuite.id == TestCase.suite_id)
    if source is not None:
        source_ids = select(source.c.case_id)
        if direct_only:
            source_ids = source_ids.where(source.c.group_id == group_id, source.c.suite_id.is_(None))
        query = query.filter(TestCase.id.in_(source_ids))
    if suite_id is not None:
        query = query.filter(TestCase.suite_id == suite_id)
    if eligible_only:
        query = query.filter(TestCase.status == "ready", TestCase.current_approved_version_id.is_not(None), TestSuite.is_active.is_(True))
    if exclude_run_id is not None:
        query = query.filter(~TestCase.id.in_(select(TestRunCase.test_case_id).where(TestRunCase.test_run_id == exclude_run_id)))
    scope_total = query.count()
    if status:
        query = query.filter(TestCase.status == status)
    for tag_id in set(tag_ids or []):
        query = query.filter(TestCase.tag_assignments.any(TestCaseTagAssignment.tag_id == tag_id))
    for word in _normalized(q).split():
        pattern = "%" + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        tag_match = TestCase.tag_assignments.any(TestCaseTagAssignment.tag.has(
            _search_expression(db, TestCaseTag.name).like(pattern, escape="\\")))
        query = query.filter(or_(
            *[_search_expression(db, field).like(pattern, escape="\\") for field in (TestCase.code, TestCase.title, TestSuite.name)], tag_match))
    total = query.count()
    rows = query.order_by(TestCase.code, TestCase.id).offset(offset).limit(limit).all()
    ids = [row.id for row in rows]
    tags: dict[int, list[RepositorySearchTag]] = {id: [] for id in ids}
    origins: dict[int, list[CaseOrigin]] = {id: [] for id in ids}
    workflow = {}
    if ids:
        for draft in db.query(TestCaseDraft.id, TestCaseDraft.test_case_id, TestCaseDraft.status).filter(TestCaseDraft.test_case_id.in_(ids), TestCaseDraft.status.in_(["open", "submitted"])):
            workflow[draft.test_case_id] = {"draft_id": draft.id, "draft_status": draft.status}
        for review in db.query(TestCaseReview.test_case_id, TestCaseReview.id, TestCaseVersion.version_number).join(TestCaseVersion, TestCaseVersion.id == TestCaseReview.test_case_version_id).filter(TestCaseReview.test_case_id.in_(ids), TestCaseReview.status == "pending"):
            workflow.setdefault(review.test_case_id, {}).update(review_id=review.id, review_version=review.version_number)
        for case_id, tag in db.query(TestCaseTagAssignment.test_case_id, TestCaseTag).join(
                TestCaseTag, TestCaseTag.id == TestCaseTagAssignment.tag_id).filter(TestCaseTagAssignment.test_case_id.in_(ids)).order_by(TestCaseTag.category, TestCaseTag.name).all():
            tags[case_id].append(RepositorySearchTag(id=tag.id, name=tag.name, category=tag.category))
        if source is not None:
            for origin in db.query(source.c.case_id, source.c.group_id, source.c.suite_id,
                                    SuiteGroup.name.label("group_name"), TestSuite.name.label("suite_name")).join(
                    SuiteGroup, SuiteGroup.id == source.c.group_id).outerjoin(TestSuite, TestSuite.id == source.c.suite_id).filter(
                    source.c.case_id.in_(ids)).order_by(SuiteGroup.name, source.c.suite_id).all():
                origins[origin.case_id].append(CaseOrigin(group_id=origin.group_id, group_name=origin.group_name,
                                                         suite_id=origin.suite_id, suite_name=origin.suite_name))
    return RepositoryCasePage(items=[RepositoryCase(**row._mapping, tags=tags[row.id], origins=origins[row.id], published_version=row.version if row.current_approved_version_id else None, **workflow.get(row.id, {})) for row in rows],
                              total=total, scope_total=scope_total, offset=offset, limit=limit)
