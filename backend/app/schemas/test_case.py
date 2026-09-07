from pydantic import BaseModel, Field, model_validator

from app.schemas.common import TestCaseStatus, TestStepType, TimestampFields
from app.schemas.test_case_tag import TestCaseTagRead


class TestStepBase(BaseModel):
    step_order: int = Field(ge=1)
    action: str = Field(min_length=1)
    step_type: TestStepType = "test"
    note: str | None = None
    expected_result: str | None = None
    test_data: str | None = None

    @model_validator(mode="after")
    def clear_test_fields_for_information_step(self):
        if self.step_type == "information":
            self.expected_result = None
            self.test_data = None
        return self


class TestStepCreate(TestStepBase):
    pass


class TestStepUpdate(BaseModel):
    step_order: int | None = Field(default=None, ge=1)
    action: str | None = Field(default=None, min_length=1)
    step_type: TestStepType | None = None
    note: str | None = None
    expected_result: str | None = None
    test_data: str | None = None


class TestStepRead(TestStepBase, TimestampFields):
    id: int
    test_case_id: int


class TestCaseBase(BaseModel):
    suite_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    preconditions: str | None = None
    expected_summary: str | None = None
    business_area_id: int | None = None
    application_domain_id: int | None = None
    object_type_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list)
    status: TestCaseStatus = "draft"
    automated: bool = False


class TestCaseCreate(TestCaseBase):
    steps: list[TestStepCreate] = []

    @model_validator(mode="after")
    def validate_unique_step_order(self):
        orders = [step.step_order for step in self.steps]
        if len(orders) != len(set(orders)):
            raise ValueError("Pořadí kroků musí být v rámci test case unikátní.")
        return self


class TestCaseUpdate(BaseModel):
    suite_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def require_suite_when_provided(self):
        if "suite_id" in self.model_fields_set and self.suite_id is None:
            raise ValueError("Test case musí patřit do test suity.")
        return self
    code: str | None = Field(default=None, min_length=1, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    preconditions: str | None = None
    expected_summary: str | None = None
    status: TestCaseStatus | None = None
    automated: bool | None = None

    business_area_id: int | None = None
    application_domain_id: int | None = None
    object_type_id: int | None = None
    tag_ids: list[int] | None = None


class TestCaseRead(TestCaseBase, TimestampFields):
    id: int
    version: int
    created_by: int
    steps: list[TestStepRead] = []
    tags: list[TestCaseTagRead] = Field(default_factory=list)
    business_area: TestCaseTagRead | None = None
    application_domain: TestCaseTagRead | None = None
    object_type: TestCaseTagRead | None = None
