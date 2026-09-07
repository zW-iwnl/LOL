from typing import Literal, cast

from fastapi import HTTPException, status
from sqlalchemy import case, func, literal, or_
from sqlalchemy.orm import Session, selectinload

from app.models import (
    SuiteGroup,
    SuiteGroupMember,
    SuiteGroupRelation,
    TestCase,
    TestCaseTag,
    TestCaseTagAssignment,
    TestSuite,
)
from app.schemas.repository_search import (
    RepositorySearchResponse,
    RepositorySearchTag,
    RepositorySuiteGroupResult,
    RepositorySuiteTag,
    RepositoryTestCaseResult,
    RepositoryTestSuiteResult,
)
from app.services.suite_groups import group_tags_by_id, group_test_cases_cte
from app.services.test_case_tags import validate_tags

RepositoryResultType = Literal["test_case", "test_suite", "suite_group"]
ALLOWED_RESULT_TYPES = {"test_case", "test_suite", "suite_group"}


def parse_result_types(value: str) -> set[RepositoryResultType]:
    requested = {item.strip() for item in value.split(",") if item.strip()}
    if not requested or requested - ALLOWED_RESULT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Neplatný typ výsledku vyhledávání. Povolené hodnoty jsou "
                "test_case, test_suite a suite_group."
            ),
        )
    return cast(set[RepositoryResultType], requested)


def _escaped_pattern(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_test_cases(
    db: Session,
    query: str,
    limit: int,
    business_area_ids: list[int],
    application_domain_ids: list[int],
    object_type_ids: list[int],
) -> list[tuple[int, RepositoryTestCaseResult]]:
    statement = (
        db.query(TestCase, TestSuite.name.label("suite_name"))
        .options(
            selectinload(TestCase.tag_assignments).selectinload(
                TestCaseTagAssignment.tag
            )
        )
        .join(TestSuite, TestSuite.id == TestCase.suite_id)
    )
    for tag_ids in (
        business_area_ids,
        application_domain_ids,
        object_type_ids,
    ):
        if tag_ids:
            statement = statement.filter(
                TestCase.tag_assignments.any(
                    TestCaseTagAssignment.tag_id.in_(tag_ids)
                )
            )

    relevance = literal(0).label("relevance")
    if query:
        escaped = _escaped_pattern(query.lower())
        contains = f"%{escaped}%"
        prefix = f"{escaped}%"
        tag_match = TestCase.tag_assignments.any(
            TestCaseTagAssignment.tag.has(
                func.lower(TestCaseTag.name).like(contains, escape="\\")
            )
        )
        statement = statement.filter(
            or_(
                func.lower(TestCase.code).like(contains, escape="\\"),
                func.lower(TestCase.title).like(contains, escape="\\"),
                func.lower(func.coalesce(TestCase.description, "")).like(
                    contains, escape="\\"
                ),
                func.lower(func.coalesce(TestCase.preconditions, "")).like(
                    contains, escape="\\"
                ),
                func.lower(TestSuite.name).like(contains, escape="\\"),
                tag_match,
            )
        )
        relevance = case(
            (func.lower(TestCase.code) == query.lower(), 600),
            (func.lower(TestCase.code).like(prefix, escape="\\"), 500),
            (func.lower(TestCase.title).like(prefix, escape="\\"), 400),
            (func.lower(TestCase.title).like(contains, escape="\\"), 300),
            (func.lower(TestCase.code).like(contains, escape="\\"), 200),
            else_=100,
        ).label("relevance")

    rows = (
        statement.add_columns(relevance)
        .order_by(relevance.desc(), TestCase.title, TestCase.id)
        .limit(limit)
        .all()
    )
    ranked: list[tuple[int, RepositoryTestCaseResult]] = []
    for test_case, suite_name, score in rows:
        tags = [
            RepositorySearchTag(id=tag.id, category=tag.category, name=tag.name)
            for tag in test_case.tags
        ]
        first_by_category = {
            category: next((tag for tag in tags if tag.category == category), None)
            for category in ("business_area", "application_domain", "object_type")
        }
        ranked.append(
            (
                int(score),
                RepositoryTestCaseResult(
                    id=test_case.id,
                    label=f"{test_case.code} {test_case.title}",
                    code=test_case.code,
                    title=test_case.title,
                    suite_id=test_case.suite_id,
                    suite_name=suite_name,
                    status=test_case.status,
                    tags=tags,
                    business_area=first_by_category["business_area"],
                    application_domain=first_by_category["application_domain"],
                    object_type=first_by_category["object_type"],
                ),
            )
        )
    return ranked


def _suite_tags_by_id(
    db: Session,
    suite_ids: list[int],
) -> dict[int, list[RepositorySuiteTag]]:
    tags_by_suite = {suite_id: [] for suite_id in suite_ids}
    if not suite_ids:
        return tags_by_suite
    rows = (
        db.query(
            TestCase.suite_id,
            TestCaseTag.id,
            TestCaseTag.category,
            TestCaseTag.name,
            func.count(func.distinct(TestCase.id)).label("test_case_count"),
        )
        .join(
            TestCaseTagAssignment,
            TestCaseTagAssignment.test_case_id == TestCase.id,
        )
        .join(TestCaseTag, TestCaseTag.id == TestCaseTagAssignment.tag_id)
        .filter(TestCase.suite_id.in_(suite_ids))
        .group_by(
            TestCase.suite_id,
            TestCaseTag.id,
            TestCaseTag.category,
            TestCaseTag.name,
        )
        .order_by(
            TestCase.suite_id,
            TestCaseTag.category,
            TestCaseTag.name,
            TestCaseTag.id,
        )
        .all()
    )
    for row in rows:
        tags_by_suite[row.suite_id].append(
            RepositorySuiteTag(
                id=row.id,
                category=row.category,
                name=row.name,
                test_case_count=int(row.test_case_count),
            )
        )
    return tags_by_suite


def _suite_group_ids(
    db: Session,
    suite_ids: list[int],
) -> dict[int, list[int]]:
    result = {suite_id: [] for suite_id in suite_ids}
    if not suite_ids:
        return result
    rows = (
        db.query(SuiteGroupMember.suite_id, SuiteGroupMember.group_id)
        .filter(SuiteGroupMember.suite_id.in_(suite_ids))
        .order_by(
            SuiteGroupMember.suite_id,
            SuiteGroupMember.sort_order,
            SuiteGroupMember.group_id,
        )
        .all()
    )
    for suite_id, group_id in rows:
        result[suite_id].append(group_id)
    return result


def _search_test_suites(
    db: Session,
    query: str,
    limit: int,
    business_area_ids: list[int],
    application_domain_ids: list[int],
    object_type_ids: list[int],
) -> list[tuple[int, RepositoryTestSuiteResult]]:
    name = func.lower(TestSuite.name)
    description = func.lower(func.coalesce(TestSuite.description, ""))
    relevance = literal(150).label("relevance")
    statement = (
        db.query(
            TestSuite.id,
            TestSuite.name,
            TestSuite.is_active,
            func.count(func.distinct(TestCase.id)).label("test_case_count"),
        )
        .outerjoin(TestCase, TestCase.suite_id == TestSuite.id)
    )
    for tag_ids in (
        business_area_ids,
        application_domain_ids,
        object_type_ids,
    ):
        if tag_ids:
            statement = statement.filter(
                TestCase.tag_assignments.any(
                    TestCaseTagAssignment.tag_id.in_(tag_ids)
                )
            )

    if query:
        escaped = _escaped_pattern(query.lower())
        contains = f"%{escaped}%"
        prefix = f"{escaped}%"
        inherited_tag_match = TestCase.tag_assignments.any(
            TestCaseTagAssignment.tag.has(
                func.lower(TestCaseTag.name).like(contains, escape="\\")
            )
        )
        statement = statement.filter(
            or_(
                name.like(contains, escape="\\"),
                description.like(contains, escape="\\"),
                inherited_tag_match,
            )
        )
        relevance = case(
            (name == query.lower(), 450),
            (name.like(prefix, escape="\\"), 400),
            (name.like(contains, escape="\\"), 300),
            else_=150,
        ).label("relevance")

    rows = (
        statement.add_columns(relevance)
        .group_by(TestSuite.id, TestSuite.name, TestSuite.is_active)
        .order_by(relevance.desc(), TestSuite.name, TestSuite.id)
        .limit(limit)
        .all()
    )
    suite_ids = [row.id for row in rows]
    tags_by_suite = _suite_tags_by_id(db, suite_ids)
    groups_by_suite = _suite_group_ids(db, suite_ids)
    return [
        (
            int(row.relevance),
            RepositoryTestSuiteResult(
                id=row.id,
                label=row.name,
                group_ids=groups_by_suite[row.id],
                test_case_count=int(row.test_case_count),
                is_active=row.is_active,
                tags=tags_by_suite[row.id],
            ),
        )
        for row in rows
    ]


def _group_relation_ids(
    db: Session,
    group_ids: list[int],
) -> tuple[dict[int, list[int]], dict[int, list[int]]]:
    parents = {group_id: [] for group_id in group_ids}
    children = {group_id: [] for group_id in group_ids}
    if not group_ids:
        return parents, children
    rows = db.query(
        SuiteGroupRelation.parent_group_id,
        SuiteGroupRelation.child_group_id,
        SuiteGroupRelation.sort_order,
    ).filter(
        or_(
            SuiteGroupRelation.parent_group_id.in_(group_ids),
            SuiteGroupRelation.child_group_id.in_(group_ids),
        )
    ).order_by(
        SuiteGroupRelation.sort_order,
        SuiteGroupRelation.parent_group_id,
        SuiteGroupRelation.child_group_id,
    ).all()
    for parent_id, child_id, _ in rows:
        if child_id in parents:
            parents[child_id].append(parent_id)
        if parent_id in children:
            children[parent_id].append(child_id)
    return parents, children


def _search_suite_groups(
    db: Session,
    query: str,
    limit: int,
    business_area_ids: list[int],
    application_domain_ids: list[int],
    object_type_ids: list[int],
) -> list[tuple[int, RepositorySuiteGroupResult]]:
    visible_cases = group_test_cases_cte()
    name = func.lower(SuiteGroup.name)
    description = func.lower(func.coalesce(SuiteGroup.description, ""))
    relevance = literal(150).label("relevance")
    statement = (
        db.query(
            SuiteGroup.id,
            SuiteGroup.name,
            func.count(func.distinct(TestCase.id)).label("test_case_count"),
        )
        .outerjoin(visible_cases, visible_cases.c.group_id == SuiteGroup.id)
        .outerjoin(TestCase, TestCase.id == visible_cases.c.test_case_id)
    )
    for tag_ids in (
        business_area_ids,
        application_domain_ids,
        object_type_ids,
    ):
        if tag_ids:
            statement = statement.filter(
                TestCase.tag_assignments.any(
                    TestCaseTagAssignment.tag_id.in_(tag_ids)
                )
            )

    if query:
        escaped = _escaped_pattern(query.lower())
        contains = f"%{escaped}%"
        prefix = f"{escaped}%"
        inherited_tag_match = TestCase.tag_assignments.any(
            TestCaseTagAssignment.tag.has(
                func.lower(TestCaseTag.name).like(contains, escape="\\")
            )
        )
        statement = statement.filter(
            or_(
                name.like(contains, escape="\\"),
                description.like(contains, escape="\\"),
                inherited_tag_match,
            )
        )
        relevance = case(
            (name == query.lower(), 450),
            (name.like(prefix, escape="\\"), 400),
            (name.like(contains, escape="\\"), 300),
            else_=150,
        ).label("relevance")

    rows = (
        statement.add_columns(relevance)
        .group_by(SuiteGroup.id, SuiteGroup.name)
        .order_by(relevance.desc(), SuiteGroup.name, SuiteGroup.id)
        .limit(limit)
        .all()
    )
    group_ids = [row.id for row in rows]
    tags_by_group = group_tags_by_id(db, group_ids)
    parents, children = _group_relation_ids(db, group_ids)
    return [
        (
            int(row.relevance),
            RepositorySuiteGroupResult(
                id=row.id,
                label=row.name,
                parent_ids=parents[row.id],
                child_ids=children[row.id],
                test_case_count=int(row.test_case_count),
                tags=[
                    RepositorySuiteTag(
                        id=tag.id,
                        category=tag.category,
                        name=tag.name,
                        test_case_count=tag.test_case_count,
                    )
                    for tag in tags_by_group[row.id]
                ],
            ),
        )
        for row in rows
    ]


def search_repository(
    db: Session,
    query: str | None,
    result_types: set[RepositoryResultType],
    limit: int,
    business_area_ids: list[int] | None = None,
    application_domain_ids: list[int] | None = None,
    object_type_ids: list[int] | None = None,
) -> RepositorySearchResponse:
    normalized_query = (query or "").strip()
    business_area_ids = business_area_ids or []
    application_domain_ids = application_domain_ids or []
    object_type_ids = object_type_ids or []
    has_tag_filter = any(
        (business_area_ids, application_domain_ids, object_type_ids)
    )
    if normalized_query and len(normalized_query) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vyhledávání vyžaduje alespoň 2 znaky.",
        )
    if not normalized_query and not has_tag_filter:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Zadejte dotaz nebo alespoň jeden tagový filtr.",
        )

    for tag_ids, category in (
        (business_area_ids, "business_area"),
        (application_domain_ids, "application_domain"),
        (object_type_ids, "object_type"),
    ):
        if tag_ids:
            validate_tags(db, tag_ids, category)

    ranked_items: list[
        tuple[
            int,
            RepositoryTestCaseResult
            | RepositoryTestSuiteResult
            | RepositorySuiteGroupResult,
        ]
    ] = []
    if "test_case" in result_types:
        ranked_items.extend(
            _search_test_cases(
                db,
                normalized_query,
                limit,
                business_area_ids,
                application_domain_ids,
                object_type_ids,
            )
        )
    if "test_suite" in result_types:
        ranked_items.extend(
            _search_test_suites(
                db,
                normalized_query,
                limit,
                business_area_ids,
                application_domain_ids,
                object_type_ids,
            )
        )
    if "suite_group" in result_types:
        ranked_items.extend(
            _search_suite_groups(
                db,
                normalized_query,
                limit,
                business_area_ids,
                application_domain_ids,
                object_type_ids,
            )
        )

    type_order = {"test_case": 0, "test_suite": 1, "suite_group": 2}
    ranked_items.sort(
        key=lambda ranked: (
            -ranked[0],
            type_order[ranked[1].type],
            ranked[1].label.casefold(),
            ranked[1].id,
        )
    )
    return RepositorySearchResponse(
        query=normalized_query,
        items=[item for _, item in ranked_items[:limit]],
    )
