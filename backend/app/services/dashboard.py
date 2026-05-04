from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Defect, TestCase, TestRun, TestRunCase
from app.schemas.dashboard import DashboardRead, DashboardResult, DashboardRun, DashboardStats
from app.services.common import get_project_or_404


def get_dashboard(db: Session, project_id: int) -> DashboardRead:
    get_project_or_404(db, project_id)
    test_cases_count = db.query(TestCase).filter(TestCase.project_id == project_id).count()
    active_test_runs_count = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id, TestRun.status.in_(["open", "in_progress"]))
        .count()
    )
    open_defects_count = (
        db.query(Defect)
        .filter(Defect.project_id == project_id, Defect.status.in_(["open", "in_progress", "retest"]))
        .count()
    )
    result_rows = (
        db.query(TestRunCase.result, func.count(TestRunCase.id))
        .join(TestRun, TestRun.id == TestRunCase.test_run_id)
        .filter(TestRun.project_id == project_id)
        .group_by(TestRunCase.result)
        .all()
    )
    result_counts = {result: count for result, count in result_rows}
    executed_total = sum(count for result, count in result_counts.items() if result != "not_run")
    pass_rate = round((result_counts.get("passed", 0) / executed_total) * 100, 2) if executed_total else 0.0
    recent_runs = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id)
        .order_by(TestRun.created_at.desc())
        .limit(5)
        .all()
    )

    return DashboardRead(
        stats=DashboardStats(
            test_cases_count=test_cases_count,
            active_test_runs_count=active_test_runs_count,
            pass_rate=pass_rate,
            open_defects_count=open_defects_count,
        ),
        recent_test_runs=[
            DashboardRun(id=run.id, name=run.name, status=run.status, environment=run.environment)
            for run in recent_runs
        ],
        results=[DashboardResult(result=result, count=count) for result, count in result_counts.items()],
    )
