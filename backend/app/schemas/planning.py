from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import TimestampFields
from app.schemas.test_run import TestRunListItem

PlanningStatus = Literal["planned", "active", "completed", "archived"]
TestPlanStatus = Literal["draft", "active", "completed", "archived"]


class ReleaseBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: PlanningStatus = "planned"
    release_date: datetime | None = None


class ReleaseCreate(ReleaseBase):
    pass


class ReleaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: PlanningStatus | None = None
    release_date: datetime | None = None


class ReleaseRead(ReleaseBase, TimestampFields):
    id: int
    project_id: int
    created_by: int


class MilestoneBase(BaseModel):
    release_id: int | None = None
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: PlanningStatus = "planned"
    planned_start: datetime | None = None
    planned_end: datetime | None = None


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    release_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: PlanningStatus | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None


class MilestoneRead(MilestoneBase, TimestampFields):
    id: int
    project_id: int
    created_by: int


class TestPlanBase(BaseModel):
    release_id: int | None = None
    milestone_id: int | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: TestPlanStatus = "draft"


class TestPlanCreate(TestPlanBase):
    test_run_ids: list[int] = []


class TestPlanUpdate(BaseModel):
    release_id: int | None = None
    milestone_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TestPlanStatus | None = None


class TestPlanAddRunsRequest(BaseModel):
    test_run_ids: list[int] = Field(min_length=1)


class TestPlanCreateRunRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    version: str | None = Field(default=None, max_length=100)
    environment: str | None = Field(default=None, max_length=100)
    planned_start: datetime | None = None
    planned_end: datetime | None = None


class TestPlanRead(TestPlanBase, TimestampFields):
    id: int
    project_id: int
    created_by: int
    test_runs: list[TestRunListItem] = []
