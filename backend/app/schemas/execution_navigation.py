from pydantic import BaseModel, Field

from app.schemas.test_run_selection import SelectionGroup, SelectionSuite


class ExecutionNavigationGroup(SelectionGroup):
    direct_case_ids: list[int] = Field(default_factory=list)


class ExecutionNavigation(BaseModel):
    suites: list[SelectionSuite] = Field(default_factory=list)
    groups: list[ExecutionNavigationGroup] = Field(default_factory=list)
