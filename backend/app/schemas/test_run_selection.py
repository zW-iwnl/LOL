from pydantic import BaseModel, Field, PositiveInt


class GroupSelection(BaseModel):
    group_id: PositiveInt
    include_descendants: bool = True


class RunSelection(BaseModel):
    groups: list[GroupSelection] = Field(default_factory=list)
    suite_ids: list[PositiveInt] = Field(default_factory=list)
    test_case_ids: list[PositiveInt] = Field(default_factory=list)


class SelectionCase(BaseModel):
    id: int
    code: str
    title: str
    suite_id: int
    version_id: int | None
    tags: list[str]
    exclusion_reason: str | None


class SelectionSuite(BaseModel):
    id: int
    name: str
    case_ids: list[int]


class SelectionChild(BaseModel):
    group_id: int
    include_descendants: bool


class SelectionGroup(SelectionSuite):
    own_case_ids: list[int]
    suite_ids: list[int]
    children: list[SelectionChild]


class SelectionCatalog(BaseModel):
    cases: list[SelectionCase]
    suites: list[SelectionSuite]
    groups: list[SelectionGroup]


class SelectionPreview(BaseModel):
    cases: list[SelectionCase]
    excluded_cases: list[SelectionCase]
    fingerprint: str
