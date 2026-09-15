from sqlalchemy import case, func, or_
from sqlalchemy.orm import selectinload
from app.models import TestRun, TestRunCase, TestRunCaseAttempt, TestRunAttempt, TestRunStepResult
from app.schemas.test_run import TestRunListItem
from app.services.common import not_found
from app.services.approval_workspace import text_filter


def run_page(db, *, q=None, status=None, environment=None, offset=0, limit=50, summary_only=False):
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
    if not summary_only:
        query = query.options(selectinload(TestRun.test_run_cases))
    rows = query.order_by(TestRun.created_at.desc(), TestRun.id.desc()).offset(offset).limit(limit).all()
    items = []
    summaries = run_summaries(db, [row.id for row in rows]) if summary_only else {}
    for row in rows:
        if summary_only:
            items.append(run_metadata(row, summaries[row.id]))
            continue
        item = TestRunListItem.model_validate(row, from_attributes=True).model_dump(mode="json")
        for summary, run_case in zip(item["test_run_cases"], row.test_run_cases):
            snapshot = run_case.test_case_snapshot or {}
            summary.update(code=snapshot.get("code"), title=snapshot.get("title"))
        items.append(item)
    return {"items": items, "total": total, "offset": offset, "limit": limit,
        "stats": {"total": sum(statuses.values()), "active": statuses.get("open", 0) + statuses.get("in_progress", 0),
                  "completed": statuses.get("completed", 0), "averagePassRate": round(average)}}


RESULTS = ("passed", "failed", "blocked", "skipped", "not_run")


def run_summaries(db, ids):
    counts = {run_id: dict.fromkeys(RESULTS, 0) for run_id in ids}
    if ids:
        for run_id, result, count in db.query(TestRunCase.test_run_id, TestRunCase.result, func.count()).filter(
            TestRunCase.test_run_id.in_(ids)
        ).group_by(TestRunCase.test_run_id, TestRunCase.result):
            counts[run_id][result] = count
    summaries = {}
    for run_id, values in counts.items():
        total = sum(values.values())
        executed = total - values["not_run"]
        summaries[run_id] = {"counts": values, "total": total, "executed": executed,
            "progress": int(executed * 100 / total + .5) if total else 0,
            "passRate": int(values["passed"] * 100 / executed + .5) if executed else None}
    return summaries


def run_metadata(run, summary):
    # Read scalar columns only: never materialize the case collection for navigation.
    return {**{column.key: getattr(run, column.key) for column in TestRun.__table__.columns}, "summary": summary, "test_run_cases": []}


def run_detail(db, run_id):
    run = db.get(TestRun, run_id)
    if run is None:
        raise not_found("Test run")
    return run_metadata(run, run_summaries(db, [run_id])[run_id])


def run_cases_page(db, run_id, *, q=None, result=None, tester=None, offset=0, limit=25):
    if db.get(TestRun, run_id) is None:
        raise not_found("Test run")
    # Rank attempts exactly as execution does; legacy snapshots apply only without an attempt.
    ranked = db.query(TestRunCaseAttempt.test_run_case_id.label("case_id"),
        TestRunCaseAttempt.execution_snapshot.label("snapshot"),
        func.row_number().over(partition_by=TestRunCaseAttempt.test_run_case_id,
            order_by=(TestRunAttempt.attempt_number.desc(), TestRunCaseAttempt.attempt_number.desc())).label("position")
    ).join(TestRunAttempt, TestRunAttempt.id == TestRunCaseAttempt.test_run_attempt_id).filter(TestRunAttempt.test_run_id == run_id).subquery()
    code = case((ranked.c.case_id.is_not(None), ranked.c.snapshot["code"].as_string()), else_=TestRunCase.test_case_snapshot["code"].as_string())
    title = case((ranked.c.case_id.is_not(None), ranked.c.snapshot["title"].as_string()), else_=TestRunCase.test_case_snapshot["title"].as_string())
    history = or_(db.query(TestRunCaseAttempt.id).filter(TestRunCaseAttempt.test_run_case_id == TestRunCase.id, TestRunCaseAttempt.result != "not_run").exists(),
        db.query(TestRunStepResult.id).filter(TestRunStepResult.test_run_case_id == TestRunCase.id, TestRunStepResult.result != "not_run").exists())
    query = db.query(TestRunCase, code.label("code"), title.label("title"), history.label("has_history")).outerjoin(
        ranked, (ranked.c.case_id == TestRunCase.id) & (ranked.c.position == 1)
    ).filter(TestRunCase.test_run_id == run_id)
    query = text_filter(db, query, q, [code, title])
    if result:
        query = query.filter(TestRunCase.result == result)
    if tester == "unassigned":
        query = query.filter(TestRunCase.assigned_to.is_(None))
    elif tester:
        query = query.filter(TestRunCase.assigned_to == int(tester))
    total = query.count()
    items = [{"id": row.id, "test_run_id": row.test_run_id, "test_case_id": row.test_case_id,
        "assigned_to": row.assigned_to, "result": row.result, "code": code, "title": title, "has_history": history}
        for row, code, title, history in query.order_by(TestRunCase.id).offset(offset).limit(limit)]
    return {"items": items, "total": total, "offset": offset, "limit": limit}
