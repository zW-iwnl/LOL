from pydantic import BaseModel, Field

from app.schemas.common import TimestampFields


class TestSuiteBase(BaseModel):
    parent_suite_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    path: str | None = Field(default=None, max_length=1000)
    level: int = Field(default=0, ge=0)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class TestSuiteCreate(TestSuiteBase):
    pass


class TestSuiteUpdate(BaseModel):
    parent_suite_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    path: str | None = Field(default=None, max_length=1000)
    level: int | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class TestSuiteRead(TestSuiteBase, TimestampFields):
    id: int
    project_id: int
    path: str
    created_by: int


class TestSuiteTreeNode(TestSuiteRead):
    children: list["TestSuiteTreeNode"] = []
