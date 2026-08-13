from pydantic import BaseModel, Field

from app.schemas.common import Priority, TestCaseStatus, TimestampFields


class TestStepBase(BaseModel):
    step_order: int = Field(ge=1)
    action: str = Field(min_length=1)
    expected_result: str | None = None
    test_data: str | None = None


class TestStepCreate(TestStepBase):
    pass


class TestStepUpdate(BaseModel):
    step_order: int | None = Field(default=None, ge=1)
    action: str | None = Field(default=None, min_length=1)
    expected_result: str | None = None
    test_data: str | None = None


class TestStepRead(TestStepBase, TimestampFields):
    id: int
    test_case_id: int


class TestCaseBase(BaseModel):
    suite_id: int | None = None
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    preconditions: str | None = None
    expected_summary: str | None = None
    priority: Priority = "medium"
    type: str = Field(default="manual", max_length=50)
    status: TestCaseStatus = "draft"
    automated: bool = False


class TestCaseCreate(TestCaseBase):
    steps: list[TestStepCreate] = []


class TestCaseUpdate(BaseModel):
    suite_id: int | None = None
    code: str | None = Field(default=None, min_length=1, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    preconditions: str | None = None
    expected_summary: str | None = None
    priority: Priority | None = None
    type: str | None = Field(default=None, max_length=50)
    status: TestCaseStatus | None = None
    automated: bool | None = None


class TestCaseRead(TestCaseBase, TimestampFields):
    id: int
    project_id: int
    version: int
    created_by: int
    steps: list[TestStepRead] = []
