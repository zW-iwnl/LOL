from pydantic import BaseModel, Field

from app.schemas.common import TimestampFields


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


class SuiteGroupBase(BaseModel):
    parent_group_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = Field(default=0, ge=0)


class SuiteGroupCreate(SuiteGroupBase):
    pass


class SuiteGroupUpdate(BaseModel):
    parent_group_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class SuiteGroupRead(SuiteGroupBase, TimestampFields):
    id: int
    members: list[SuiteGroupMemberRead] = Field(default_factory=list)
    test_case_members: list[SuiteGroupTestCaseMemberRead] = Field(default_factory=list)


class SuiteGroupTreeNode(SuiteGroupRead):
    children: list["SuiteGroupTreeNode"] = Field(default_factory=list)


class SuiteGroupIdsUpdate(BaseModel):
    group_ids: list[int] = Field(default_factory=list)


class SuiteGroupTestCaseIdsUpdate(BaseModel):
    test_case_ids: list[int] = Field(default_factory=list)
