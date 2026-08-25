from typing import Literal, cast

from fastapi import HTTPException, status
from sqlalchemy import case, func, literal, or_
from sqlalchemy.orm import Session, selectinload

from app.models import TestCase, TestCaseTag, TestCaseTagAssignment, TestSuite
from app.schemas.repository_search import (
    RepositorySearchResponse,
    RepositorySearchTag,
    RepositoryTestCaseResult,
    RepositoryTestSuiteResult,
)
from app.services.test_case_tags import validate_tags

RepositoryResultType = Literal["test_case", "test_suite"]
ALLOWED_RESULT_TYPES = {"test_case", "test_suite"}


def parse_result_types(value: str) -> set[RepositoryResultType]:
    requested = {item.strip() for item in value.split(",") if item.strip()}
    if not requested or requested - ALLOWED_RESULT_TYPES:
        detail = "Neplatný typ výsledku vyhledávání. Povolené hodnoty jsou test_case a test_suite."
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
    return cast(set[RepositoryResultType], requested)


def _escaped_pattern(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _tag(tag_id: int | None, category: str, name: str | None) -> RepositorySearchTag | None:
    if tag_id is None or name is None:
        return None
    return RepositorySearchTag(id=tag_id, category=category, name=name)


def _search_test_cases(
    db: Session,
    query: str,
    limit: int,
    business_area_ids: list[int],
    application_domain_ids: list[int],
    object_type_ids: list[int],
) -> list[tuple[int, RepositoryTestCaseResult]]:
    statement = (
        db.query(TestCase, TestSuite.path.label("suite_path"))
        .options(
            selectinload(TestCase.tag_assignments).selectinload(
                TestCaseTagAssignment.tag
            )
        )
        .outerjoin(TestSuite, TestSuite.id == TestCase.suite_id)
    )
    for tag_ids, category in (
        (business_area_ids, "business_area"),
        (application_domain_ids, "application_domain"),
        (object_type_ids, "object_type"),
    ):
        if tag_ids:
            validate_tags(db, tag_ids, category)
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
                func.lower(func.coalesce(TestSuite.path, "")).like(
                    contains, escape="\\"
                ),
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
    for test_case, suite_path, score in rows:
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
                    suite_path=suite_path,
                    status=test_case.status,
                    tags=tags,
                    business_area=first_by_category["business_area"],
                    application_domain=first_by_category["application_domain"],
                    object_type=first_by_category["object_type"],
                ),
            )
        )
    return ranked


def _search_test_suites(
    db: Session,
    query: str,
    limit: int,
) -> list[tuple[int, RepositoryTestSuiteResult]]:
    escaped = _escaped_pattern(query.lower())
    contains = f"%{escaped}%"
    prefix = f"{escaped}%"
    name = func.lower(TestSuite.name)
    path = func.lower(TestSuite.path)
    description = func.lower(func.coalesce(TestSuite.description, ""))
    score = case(
        (name == query.lower(), 450),
        (name.like(prefix, escape="\\"), 400),
        (name.like(contains, escape="\\"), 300),
        (path.like(contains, escape="\\"), 200),
        else_=100,
    ).label("relevance")
    rows = (
        db.query(
            TestSuite.id,
            TestSuite.name,
            TestSuite.path,
            TestSuite.is_active,
            func.count(TestCase.id).label("test_case_count"),
            score,
        )
        .outerjoin(TestCase, TestCase.suite_id == TestSuite.id)
        .filter(
            or_(
                name.like(contains, escape="\\"),
                path.like(contains, escape="\\"),
                description.like(contains, escape="\\"),
            ),
        )
        .group_by(TestSuite.id, TestSuite.name, TestSuite.path, TestSuite.is_active)
        .order_by(score.desc(), TestSuite.name, TestSuite.id)
        .limit(limit)
        .all()
    )
    return [
        (
            int(row.relevance),
            RepositoryTestSuiteResult(
                id=row.id,
                label=row.name,
                path=row.path,
                test_case_count=row.test_case_count,
                is_active=row.is_active,
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
    has_tag_filter = any((business_area_ids, application_domain_ids, object_type_ids))
    if normalized_query and len(normalized_query) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vyhledávání vyžaduje alespoň 2 znaky.")
    if not normalized_query and not has_tag_filter:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Zadejte dotaz nebo alespoň jeden tagový filtr.")


    ranked_items: list[tuple[int, RepositoryTestCaseResult | RepositoryTestSuiteResult]] = []
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
    if "test_suite" in result_types and normalized_query and not has_tag_filter:
        ranked_items.extend(_search_test_suites(db, normalized_query, limit))

    ranked_items.sort(
        key=lambda ranked: (
            -ranked[0],
            0 if ranked[1].type == "test_case" else 1,
            ranked[1].label.casefold(),
            ranked[1].id,
        )
    )
    return RepositorySearchResponse(query=normalized_query, items=[item for _, item in ranked_items[:limit]])
