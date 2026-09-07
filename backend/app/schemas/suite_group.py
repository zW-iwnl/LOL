from pydantic import BaseModel, Field

from app.schemas.common import TimestampFields
from app.schemas.test_case_tag import TestCaseTagCategory


class SuiteGroupTagRead(BaseModel):
    id: int
    category: TestCaseTagCategory
    name: str
    test_case_count: int


class SuiteGroupMemberCreate(BaseModel):
    suite_id: int
    sort_order: int = Field(default=0, ge=0)


class SuiteGroupMemberUpdate(BaseModel):
    sort_order: int = Field(ge=0)


class SuiteGroupMemberRead(TimestampFields):
    group_id: int
    suite_id: int
    sort_order: int


class SuiteGroupTestCaseMemberRead(TimestampFields):
    group_id: int
    test_case_id: int
    sort_order: int


class SuiteGroupChildRelationRead(TimestampFields):
    parent_group_id: int
    child_group_id: int
    sort_order: int
    include_descendants: bool


class SuiteGroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = Field(default=0, ge=0)


class SuiteGroupCreate(SuiteGroupBase):
    pass


class SuiteGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class SuiteGroupRead(SuiteGroupBase, TimestampFields):
    id: int
    parent_ids: list[int] = Field(default_factory=list)
    child_ids: list[int] = Field(default_factory=list)
    child_relations: list[SuiteGroupChildRelationRead] = Field(default_factory=list)
    members: list[SuiteGroupMemberRead] = Field(default_factory=list)
    test_case_members: list[SuiteGroupTestCaseMemberRead] = Field(default_factory=list)
    tags: list[SuiteGroupTagRead] = Field(default_factory=list)


class SuiteGroupChildCreate(BaseModel):
    child_group_id: int
    sort_order: int = Field(default=0, ge=0)
    include_descendants: bool = True


class SuiteGroupChildUpdate(BaseModel):
    include_descendants: bool


class SuiteGroupParentIdsUpdate(BaseModel):
    parent_group_ids: list[int] = Field(default_factory=list)


class SuiteGroupIdsUpdate(BaseModel):
    group_ids: list[int] = Field(default_factory=list)


class SuiteGroupTestCaseIdsUpdate(BaseModel):
    test_case_ids: list[int] = Field(default_factory=list)
