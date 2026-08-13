from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models import Milestone, Release, TestPlan, TestRun, User
from app.schemas.planning import (
    MilestoneCreate,
    ReleaseCreate,
    TestPlanAddRunsRequest,
    TestPlanCreate,
    TestPlanCreateRunRequest,
)
from app.schemas.test_run import TestRunAddCasesRequest
from app.services.common import get_project_or_404, not_found
from app.services.test_runs import add_test_cases


def _validate_release(db: Session, project_id: int, release_id: int | None) -> None:
    if release_id is None:
        return
    release = db.get(Release, release_id)
    if release is None or release.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Release neexistuje v projektu.")


def _validate_milestone(db: Session, project_id: int, milestone_id: int | None) -> None:
    if milestone_id is None:
        return
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Milestone neexistuje v projektu.")


def list_releases(db: Session, project_id: int) -> list[Release]:
    get_project_or_404(db, project_id)
    return db.query(Release).filter(Release.project_id == project_id).order_by(Release.created_at.desc()).all()


def create_release(db: Session, project_id: int, payload: ReleaseCreate, current_user: User) -> Release:
    get_project_or_404(db, project_id)
    release = Release(**payload.model_dump(), project_id=project_id, created_by=current_user.id)
    db.add(release)
    db.commit()
    db.refresh(release)
    return release


def list_milestones(db: Session, project_id: int) -> list[Milestone]:
    get_project_or_404(db, project_id)
    return db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.created_at.desc()).all()


def create_milestone(db: Session, project_id: int, payload: MilestoneCreate, current_user: User) -> Milestone:
    get_project_or_404(db, project_id)
    _validate_release(db, project_id, payload.release_id)
    if payload.planned_start and payload.planned_end and payload.planned_start > payload.planned_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Začátek milestone musí být před koncem.")
    milestone = Milestone(**payload.model_dump(), project_id=project_id, created_by=current_user.id)
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


def list_test_plans(db: Session, project_id: int) -> list[TestPlan]:
    get_project_or_404(db, project_id)
    return (
        db.query(TestPlan)
        .options(selectinload(TestPlan.test_runs).selectinload(TestRun.test_run_cases))
        .filter(TestPlan.project_id == project_id)
        .order_by(TestPlan.created_at.desc())
        .all()
    )


def get_test_plan(db: Session, test_plan_id: int) -> TestPlan:
    test_plan = (
        db.query(TestPlan)
        .options(selectinload(TestPlan.test_runs).selectinload(TestRun.test_run_cases))
        .filter(TestPlan.id == test_plan_id)
        .first()
    )
    if test_plan is None:
        raise not_found("Test plan")
    return test_plan


def create_test_plan(db: Session, project_id: int, payload: TestPlanCreate, current_user: User) -> TestPlan:
    get_project_or_404(db, project_id)
    _validate_release(db, project_id, payload.release_id)
    _validate_milestone(db, project_id, payload.milestone_id)
    data = payload.model_dump(exclude={"test_run_ids"})
    test_plan = TestPlan(**data, project_id=project_id, created_by=current_user.id)
    db.add(test_plan)
    db.flush()
    if payload.test_run_ids:
        _add_runs(db, test_plan, payload.test_run_ids)
    db.commit()
    return get_test_plan(db, test_plan.id)


def add_runs_to_test_plan(db: Session, test_plan_id: int, payload: TestPlanAddRunsRequest) -> TestPlan:
    test_plan = get_test_plan(db, test_plan_id)
    _add_runs(db, test_plan, payload.test_run_ids)
    db.commit()
    return get_test_plan(db, test_plan.id)


def create_run_from_test_plan(db: Session, test_plan_id: int, payload: TestPlanCreateRunRequest, current_user: User) -> TestPlan:
    test_plan = get_test_plan(db, test_plan_id)
    if test_plan.status == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivovaný test plan nelze spustit.")
    source_case_ids = sorted(
        {
            run_case.test_case_id
            for test_run in test_plan.test_runs
            for run_case in test_run.test_run_cases
        }
    )
    if not source_case_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test plan neobsahuje žádné test cases. Přidej do plánu existující run.",
        )
    if payload.planned_start and payload.planned_end and payload.planned_start > payload.planned_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plánovaný začátek musí být před plánovaným koncem.")

    test_run = TestRun(
        project_id=test_plan.project_id,
        name=payload.name or f"{test_plan.name} - Run",
        description=payload.description or test_plan.description,
        version=payload.version,
        environment=payload.environment,
        status="open",
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        created_by=current_user.id,
    )
    db.add(test_run)
    db.flush()
    add_test_cases(db, test_run.id, TestRunAddCasesRequest(test_case_ids=source_case_ids), current_user=current_user)
    if test_run not in test_plan.test_runs:
        test_plan.test_runs.append(test_run)
    if test_plan.status == "draft":
        test_plan.status = "active"
    db.commit()
    return get_test_plan(db, test_plan.id)


def remove_run_from_test_plan(db: Session, test_plan_id: int, test_run_id: int) -> None:
    test_plan = get_test_plan(db, test_plan_id)
    test_run = next((run for run in test_plan.test_runs if run.id == test_run_id), None)
    if test_run is None:
        raise not_found("Test run v test planu")
    test_plan.test_runs.remove(test_run)
    db.commit()


def _add_runs(db: Session, test_plan: TestPlan, test_run_ids: list[int]) -> None:
    test_runs = db.query(TestRun).filter(TestRun.project_id == test_plan.project_id, TestRun.id.in_(test_run_ids)).all()
    found_ids = {test_run.id for test_run in test_runs}
    missing_ids = sorted(set(test_run_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test runy neexistují v projektu: {missing_ids}",
        )

    existing_ids = {test_run.id for test_run in test_plan.test_runs}
    for test_run in test_runs:
        if test_run.id not in existing_ids:
            test_plan.test_runs.append(test_run)
