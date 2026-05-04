from pydantic import BaseModel


class DashboardStats(BaseModel):
    test_cases_count: int
    active_test_runs_count: int
    pass_rate: float
    open_defects_count: int


class DashboardRun(BaseModel):
    id: int
    name: str
    status: str
    environment: str | None


class DashboardResult(BaseModel):
    result: str
    count: int


class DashboardRead(BaseModel):
    stats: DashboardStats
    recent_test_runs: list[DashboardRun]
    results: list[DashboardResult]
