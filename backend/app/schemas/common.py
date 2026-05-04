from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Priority = Literal["low", "medium", "high", "critical"]
TestCaseStatus = Literal["draft", "ready", "deprecated"]
TestRunStatus = Literal["open", "in_progress", "completed", "archived"]
TestRunCaseResult = Literal["not_run", "passed", "failed", "blocked", "skipped"]
DefectStatus = Literal["open", "in_progress", "fixed", "retest", "closed", "rejected"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampFields(ORMModel):
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    message: str
