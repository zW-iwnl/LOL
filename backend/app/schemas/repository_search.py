from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.test_case_tag import TestCaseTagCategory


class RepositorySearchTag(BaseModel):
    id: int
    category: TestCaseTagCategory
    name: str


class RepositorySuiteTag(RepositorySearchTag):
    test_case_count: int


class RepositoryTestCaseResult(BaseModel):
    type: Literal["test_case"] = "test_case"
    id: int
    label: str
    code: str
    title: str
    suite_id: int
    suite_name: str
    status: str
    tags: list[RepositorySearchTag] = Field(default_factory=list)
    business_area: RepositorySearchTag | None
    application_domain: RepositorySearchTag | None
    object_type: RepositorySearchTag | None


class RepositoryTestSuiteResult(BaseModel):
    type: Literal["test_suite"] = "test_suite"
    id: int
    label: str
    group_ids: list[int] = Field(default_factory=list)
    test_case_count: int
    is_active: bool
    tags: list[RepositorySuiteTag] = Field(default_factory=list)


class RepositorySuiteGroupResult(BaseModel):
    type: Literal["suite_group"] = "suite_group"
    id: int
    label: str
    parent_ids: list[int] = Field(default_factory=list)
    child_ids: list[int] = Field(default_factory=list)
    test_case_count: int
    tags: list[RepositorySuiteTag] = Field(default_factory=list)


RepositorySearchItem = Annotated[
    RepositoryTestCaseResult
    | RepositoryTestSuiteResult
    | RepositorySuiteGroupResult,
    Field(discriminator="type"),
]


class RepositorySearchResponse(BaseModel):
    query: str
    items: list[RepositorySearchItem]
