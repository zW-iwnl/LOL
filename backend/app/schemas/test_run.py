from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import TestRunCaseResult, TestRunStatus, TimestampFields
from app.schemas.defect import DefectCreate
from app.schemas.test_case import TestCaseRead


class TestRunBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    version: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=100)
    status: TestRunStatus = "open"
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class TestRunCreate(TestRunBase):
    test_case_ids: list[int] = []


class TestRunUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    version: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=100)
    status: TestRunStatus | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class TestRunCaseRead(TimestampFields):
    id: int
    test_run_id: int
    test_case_id: int
    assigned_to: int | None
    result: TestRunCaseResult
    comment: str | None
    executed_by: int | None
    executed_at: datetime | None
    defect_count: int
    test_case_version: int
    test_case_snapshot: dict | None


class TestRunCaseExecutionRead(TestRunCaseRead):
    code: str
    title: str
    priority: str
    suite_name: str | None = None
    test_case: TestCaseRead


class TestRunRead(TestRunBase, TimestampFields):
    id: int
    project_id: int
    created_by: int
    test_run_cases: list[TestRunCaseRead] = []


class TestRunListItem(TestRunRead):
    pass


class TestRunAddCasesRequest(BaseModel):
    test_case_ids: list[int] = Field(min_length=1)
    assigned_to: int | None = None


AddTestCasesRequest = TestRunAddCasesRequest


class TestRunCaseUpdate(BaseModel):
    assigned_to: int | None = None


class UpdateResultRequest(BaseModel):
    result: TestRunCaseResult
    comment: str | None = None
    defect: DefectCreate | None = None


class TestRunExecutionRead(TestRunRead):
    test_run_cases: list[TestRunCaseExecutionRead] = []
