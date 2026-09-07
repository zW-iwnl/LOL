from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

TestCaseTagCategory = Literal["business_area", "application_domain", "object_type"]


class TestCaseTagCreate(BaseModel):
    category: TestCaseTagCategory
    name: str = Field(min_length=1, max_length=100)


class TestCaseTagUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class TestCaseTagRead(ORMModel):
    id: int
    category: TestCaseTagCategory
    name: str
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
