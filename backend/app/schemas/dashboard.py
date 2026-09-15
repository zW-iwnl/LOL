from pydantic import BaseModel


class DashboardStats(BaseModel):
    test_cases_count: int
    active_test_runs_count: int
    pass_rate: float


class DashboardRun(BaseModel):
    id: int
    name: str
    status: str
    environment: str | None
    total: int = 0
    executed: int = 0
    pass_rate: float = 0


class DashboardResult(BaseModel):
    result: str
    count: int


class DashboardRead(BaseModel):
    stats: DashboardStats
    recent_test_runs: list[DashboardRun]
    results: list[DashboardResult]
