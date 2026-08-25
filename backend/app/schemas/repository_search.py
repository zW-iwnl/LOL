from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.test_case_tag import TestCaseTagCategory


class RepositorySearchTag(BaseModel):
    id: int
    category: TestCaseTagCategory
    name: str


class RepositoryTestCaseResult(BaseModel):
    type: Literal["test_case"] = "test_case"
    id: int
    label: str
    code: str
    title: str
    suite_id: int | None
    suite_path: str | None
    status: str
    tags: list[RepositorySearchTag] = Field(default_factory=list)
    business_area: RepositorySearchTag | None
    application_domain: RepositorySearchTag | None
    object_type: RepositorySearchTag | None


class RepositoryTestSuiteResult(BaseModel):
    type: Literal["test_suite"] = "test_suite"
    id: int
    label: str
    path: str
    test_case_count: int
    is_active: bool


RepositorySearchItem = Annotated[
    RepositoryTestCaseResult | RepositoryTestSuiteResult,
    Field(discriminator="type"),
]


class RepositorySearchResponse(BaseModel):
    query: str
    items: list[RepositorySearchItem]
