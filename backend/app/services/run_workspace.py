from sqlalchemy import case, func
from sqlalchemy.orm import selectinload
from app.models import TestRun, TestRunCase
from app.schemas.test_run import TestRunListItem
from app.services.approval_workspace import text_filter


def run_page(db, *, q=None, status=None, environment=None, offset=0, limit=50):
    query = db.query(TestRun)
    query = text_filter(db, query, q, [TestRun.name, TestRun.task_number])
    if status: query = query.filter(TestRun.status == status)
    if environment: query = query.filter(func.lower(TestRun.environment) == environment.strip().lower())
    total = query.count()
    statuses = dict(db.query(TestRun.status, func.count()).group_by(TestRun.status).all())
    per_run = db.query(TestRunCase.test_run_id,
        func.sum(case((TestRunCase.result == "passed", 1), else_=0)).label("passed"),
        func.sum(case((TestRunCase.result != "not_run", 1), else_=0)).label("executed")).group_by(TestRunCase.test_run_id).subquery()
    average = db.query(func.avg(per_run.c.passed * 100.0 / func.nullif(per_run.c.executed, 0))).scalar() or 0
    rows = query.options(selectinload(TestRun.test_run_cases)).order_by(TestRun.created_at.desc(), TestRun.id.desc()).offset(offset).limit(limit).all()
    items = []
    for row in rows:
        item = TestRunListItem.model_validate(row, from_attributes=True).model_dump(mode="json")
        for summary, run_case in zip(item["test_run_cases"], row.test_run_cases):
            snapshot = run_case.test_case_snapshot or {}
            summary.update(code=snapshot.get("code"), title=snapshot.get("title"))
        items.append(item)
    return {"items": items, "total": total, "offset": offset, "limit": limit,
        "stats": {"total": sum(statuses.values()), "active": statuses.get("open", 0) + statuses.get("in_progress", 0),
                  "completed": statuses.get("completed", 0), "averagePassRate": round(average)}}
