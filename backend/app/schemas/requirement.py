from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Priority, TestRunCaseResult, TimestampFields
from app.schemas.test_case import TestCaseRead

RequirementStatus = Literal["draft", "approved", "deprecated"]
TraceabilityRiskStatus = Literal["missing_tests", "failing", "partial", "verified"]


class RequirementBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    priority: Priority = "medium"
    status: RequirementStatus = "draft"


class RequirementCreate(RequirementBase):
    test_case_ids: list[int] = []


class RequirementUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: Priority | None = None
    status: RequirementStatus | None = None


class RequirementRead(RequirementBase, TimestampFields):
    id: int
    created_by: int
    test_cases: list[TestCaseRead] = []


class RequirementLinkTestCasesRequest(BaseModel):
    test_case_ids: list[int] = Field(min_length=1)


class TraceabilityTestCase(BaseModel):
    id: int
    code: str
    title: str
    status: str


class TraceabilityRow(BaseModel):
    requirement_id: int
    requirement_code: str
    requirement_title: str
    requirement_priority: str
    requirement_status: str
    test_cases: list[TraceabilityTestCase]
    coverage_status: str
    risk_status: TraceabilityRiskStatus
    tested_case_count: int
    failed_case_count: int
    blocked_case_count: int
    latest_result: TestRunCaseResult | None
    latest_executed_at: datetime | None
