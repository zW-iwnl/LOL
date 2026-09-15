from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import TestRunCaseResult, TestRunStatus, TestRunStepResultValue, TimestampFields
from app.schemas.test_case import TestCaseRead
from app.schemas.test_run_selection import RunSelection
from app.schemas.execution_navigation import ExecutionNavigation


class RunTextValidation(BaseModel):
    @field_validator("name", "task_number", check_fields=False, mode="before")
    @classmethod
    def trim_text(cls, value, info):
        if isinstance(value, str):
            value = value.strip()
            if info.field_name == "task_number" and not value:
                return None
        return value


class TestRunBase(RunTextValidation):
    name: str = Field(min_length=1, max_length=255)
    task_number: str | None = Field(default=None, max_length=100)
    description: str | None = None
    version: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=100)
    status: TestRunStatus = "open"
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @model_validator(mode="after")
    def validate_planned_dates(self):
        if (
            self.planned_start is not None
            and self.planned_end is not None
            and self.planned_end < self.planned_start
        ):
            raise ValueError("Plánovaný konec nesmí být před plánovaným začátkem.")
        return self


class TestRunCreate(TestRunBase):
    test_case_ids: list[int] = []
    assigned_to: int | None = Field(default=None, gt=0)
    selection: RunSelection | None = None
    selection_fingerprint: str | None = Field(default=None, min_length=64, max_length=64)


class TestRunUpdate(RunTextValidation):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    task_number: str | None = Field(default=None, max_length=100)
    description: str | None = None
    version: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=100)
    status: TestRunStatus | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class TestRunStepResultRead(TimestampFields):
    id: int
    test_run_case_id: int
    test_run_case_attempt_id: int
    test_step_id: int
    step_order: int
    result: TestRunStepResultValue
    executed_by: int | None
    executed_at: datetime | None


class UpdateStepResultRequest(BaseModel):
    result: TestRunStepResultValue


class TestRunCaseAttemptHistoryRead(TimestampFields):
    id: int
    execution_snapshot: dict | None = None
    test_case_version_id: int | None = None
    version_number: int | None = None
    approval_state: str = "unknown"
    approval_state_at_start: str | None = None
    approval_state_at_binding: str = "unknown"
    closure_reason: str | None = None
    test_run_attempt_id: int
    test_run_attempt_number: int
    test_run_case_id: int
    attempt_number: int
    result: TestRunCaseResult
    comment: str | None
    executed_by: int | None
    executed_at: datetime | None
    step_results: list[TestRunStepResultRead] = []


class TestRunCaseRead(TimestampFields):
    id: int
    test_run_id: int
    test_case_id: int
    assigned_to: int | None
    result: TestRunCaseResult
    comment: str | None
    executed_by: int | None
    executed_at: datetime | None
    test_case_version: int
    test_case_snapshot: dict | None
    step_results: list[TestRunStepResultRead] = []


class TestRunCaseExecutionRead(TestRunCaseRead):
    case_attempt_id: int
    case_attempts: list[TestRunCaseAttemptHistoryRead] = []
    code: str
    title: str
    suite_name: str | None = None
    test_case: TestCaseRead


class TestRunRead(TestRunBase, TimestampFields):
    summary: dict | None = None
    id: int
    created_by: int
    test_run_cases: list[TestRunCaseRead] = []


class TestRunCaseListItem(BaseModel):
    id: int
    test_run_id: int
    test_case_id: int
    assigned_to: int | None
    result: TestRunCaseResult


class TestRunListItem(TestRunBase, TimestampFields):
    id: int
    created_by: int
    test_run_cases: list[TestRunCaseListItem] = []


class TestRunAddCasesRequest(BaseModel):
    test_case_ids: list[int] = Field(min_length=1)
    assigned_to: int | None = None


AddTestCasesRequest = TestRunAddCasesRequest


class TestRunCaseUpdate(BaseModel):
    assigned_to: int | None = None


class UpdateResultRequest(BaseModel):
    result: TestRunCaseResult
    comment: str | None = None


class TestRunAttemptRead(TimestampFields):
    id: int
    test_run_id: int
    attempt_number: int
    status: TestRunStatus
    started_at: datetime | None
    finished_at: datetime | None
    created_by: int
    last_test_run_case_id: int | None
    last_step_id: int | None


class TestRunExecutionRead(TestRunRead):
    navigation: ExecutionNavigation = Field(default_factory=ExecutionNavigation)
    definition_counts: dict[str, int] = Field(default_factory=dict)
    attempts: list[TestRunAttemptRead] = []
    selected_attempt_id: int
    test_run_cases: list[TestRunCaseExecutionRead] = []
