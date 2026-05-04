from pydantic import BaseModel, Field
from typing import Literal

from app.schemas.common import TimestampFields

ProjectStatus = Literal["active", "archived", "paused"]


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    status: ProjectStatus = "active"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    status: ProjectStatus | None = None


class ProjectRead(ProjectBase, TimestampFields):
    id: int
    created_by: int


class ProjectListItem(ProjectRead):
    pass
