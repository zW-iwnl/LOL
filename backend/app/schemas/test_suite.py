from pydantic import BaseModel, Field

from app.schemas.common import TimestampFields


class TestSuiteBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True
    group_ids: list[int] = Field(default_factory=list)


class TestSuiteCreate(TestSuiteBase):
    pass


class TestSuiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    group_ids: list[int] | None = None


class TestSuiteRead(TestSuiteBase, TimestampFields):
    id: int
    created_by: int
    test_case_count: int = 0
