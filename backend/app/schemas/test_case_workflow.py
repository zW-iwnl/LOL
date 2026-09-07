from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.test_case import TestStepBase


class DraftStep(TestStepBase):
    step_key: UUID = Field(default_factory=uuid4)
    action: str = Field(default="", max_length=100000)


class DraftContent(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    preconditions: str | None = None
    expected_summary: str | None = None
    automated: bool = False
    tag_ids: list[int] = Field(default_factory=list, max_length=500)
    steps: list[DraftStep] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def unique_steps(self):
        if len({s.step_key for s in self.steps}) != len(self.steps):
            raise ValueError("Klíče kroků musí být unikátní.")
        if len({s.step_order for s in self.steps}) != len(self.steps):
            raise ValueError("Pořadí kroků musí být unikátní.")
        self.tag_ids = sorted(set(self.tag_ids))
        self.steps.sort(key=lambda s: s.step_order)
        return self


class ProposalCreate(BaseModel):
    suite_id: int = Field(gt=0)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    content: DraftContent


class DraftCreate(BaseModel):
    base_version_id: int | None = None
    origin_case_attempt_id: int | None = None


class DraftSave(BaseModel):
    lock_version: int = Field(ge=1)
    content: DraftContent
    change_summary: str = Field(default="", max_length=5000)


class Submission(BaseModel):
    lock_version: int = Field(ge=1)
    change_summary: str = Field(min_length=1, max_length=5000)
    reviewer_id: int | None = None


class ReviewDecision(BaseModel):
    lock_version: int = Field(ge=1)
    status: Literal["approved", "changes_requested", "rejected"]
    reason: str = Field(default="", max_length=10000)


class RevisionRequest(BaseModel):
    lock_version: int = Field(ge=1)


class Assignment(RevisionRequest):
    reviewer_id: int


class ReviewCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    field_path: str | None = Field(default=None, max_length=255)
    is_blocking: bool = False


class DraftExecution(RevisionRequest):
    draft_id: int


class VersionRerun(BaseModel):
    version_id: int | None = None
    draft_id: int | None = None
    lock_version: int | None = None

    @model_validator(mode="after")
    def exclusive_source(self):
        if self.version_id and self.draft_id:
            raise ValueError("Vyberte verzi nebo draft, ne obojí.")
        if self.draft_id and not self.lock_version:
            raise ValueError("Chybí revize draftu.")
        return self
