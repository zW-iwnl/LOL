from pydantic import BaseModel, Field

from app.schemas.common import TestCaseStatus
from app.schemas.suite_group import SuiteGroupChildRelationRead, SuiteGroupTagRead
from app.schemas.repository_search import RepositorySearchTag


class RepositoryGroup(BaseModel):
    id: int
    name: str
    description: str | None
    sort_order: int
    parent_ids: list[int]
    child_ids: list[int]
    child_relations: list[SuiteGroupChildRelationRead]
    suite_count: int
    direct_case_count: int
    tags: list[SuiteGroupTagRead]


class RepositoryStructure(BaseModel):
    groups: list[RepositoryGroup]
    test_case_count: int


class CaseOrigin(BaseModel):
    group_id: int
    group_name: str
    suite_id: int | None = None
    suite_name: str | None = None


class RepositoryCase(BaseModel):
    id: int
    code: str
    title: str
    suite_id: int
    suite_name: str
    status: TestCaseStatus
    automated: bool
    tags: list[RepositorySearchTag]
    published_version: int | None = None
    draft_id: int | None = None
    draft_status: str | None = None
    review_id: int | None = None
    review_version: int | None = None
    origins: list[CaseOrigin] = Field(default_factory=list)


class RepositoryCasePage(BaseModel):
    items: list[RepositoryCase]
    total: int
    scope_total: int
    offset: int
    limit: int
