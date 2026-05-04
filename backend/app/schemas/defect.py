from pydantic import BaseModel, Field

from app.schemas.common import DefectStatus, Priority, TimestampFields


class DefectBase(BaseModel):
    test_run_case_id: int | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    severity: Priority = "medium"
    priority: Priority = "medium"
    status: DefectStatus = "open"
    assigned_to: int | None = None


class DefectCreate(DefectBase):
    pass


class DefectUpdate(BaseModel):
    test_run_case_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    severity: Priority | None = None
    priority: Priority | None = None
    status: DefectStatus | None = None
    assigned_to: int | None = None


class DefectRead(DefectBase, TimestampFields):
    id: int
    project_id: int
    reported_by: int
