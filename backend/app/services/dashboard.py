from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import TestCase, TestRun, TestRunCase
from app.schemas.dashboard import DashboardRead, DashboardResult, DashboardRun, DashboardStats


def get_dashboard(db: Session) -> DashboardRead:
    test_cases_count = db.query(TestCase).count()
    active_test_runs_count = (
        db.query(TestRun)
        .filter(TestRun.status.in_(["open", "in_progress"]))
        .count()
    )
    result_rows = (
        db.query(TestRunCase.result, func.count(TestRunCase.id))
        .join(TestRun, TestRun.id == TestRunCase.test_run_id)
        .group_by(TestRunCase.result)
        .all()
    )
    result_counts = {result: count for result, count in result_rows}
    executed_total = sum(count for result, count in result_counts.items() if result != "not_run")
    pass_rate = round((result_counts.get("passed", 0) / executed_total) * 100, 2) if executed_total else 0.0
    recent_runs = (
        db.query(TestRun)
        .order_by(TestRun.created_at.desc())
        .limit(5)
        .all()
    )

    progress = {row.test_run_id: row for row in db.query(TestRunCase.test_run_id, func.count().label("total"),
        func.sum(case((TestRunCase.result != "not_run", 1), else_=0)).label("executed"),
        func.sum(case((TestRunCase.result == "passed", 1), else_=0)).label("passed")).filter(TestRunCase.test_run_id.in_([run.id for run in recent_runs])).group_by(TestRunCase.test_run_id)}

    return DashboardRead(
        stats=DashboardStats(
            test_cases_count=test_cases_count,
            active_test_runs_count=active_test_runs_count,
            pass_rate=pass_rate,
        ),
        recent_test_runs=[
            DashboardRun(id=run.id, name=run.name, status=run.status, environment=run.environment, total=progress[run.id].total if run.id in progress else 0,
                         executed=progress[run.id].executed if run.id in progress else 0,
                         pass_rate=round(progress[run.id].passed * 100 / progress[run.id].executed, 2) if run.id in progress and progress[run.id].executed else 0)
            for run in recent_runs
        ],
        results=[DashboardResult(result=result, count=count) for result, count in result_counts.items()],
    )
