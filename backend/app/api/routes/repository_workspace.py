from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.common import TestCaseStatus
from app.schemas.repository_workspace import RepositoryCasePage, RepositoryStructure
from app.services import repository_workspace as service

router = APIRouter(prefix="/repository", tags=["Repository"])


@router.get("/groups", response_model=RepositoryStructure)
def get_structure(db: DbSession):
    return service.structure(db)


@router.get("/cases", response_model=RepositoryCasePage)
def get_cases(db: DbSession, group_id: int | None = Query(default=None, gt=0),
              suite_id: int | None = Query(default=None, gt=0), include_descendants: bool = True,
              direct_only: bool = False, eligible_only: bool = False, exclude_run_id: int | None = Query(None, gt=0), q: str = Query(default="", max_length=200),
              status: TestCaseStatus | None = None, tag_id: list[int] | None = Query(default=None),
              offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
    return service.cases_page(db, group_id=group_id, suite_id=suite_id, include_descendants=include_descendants,
                              direct_only=direct_only, q=q, status=status, tag_ids=tag_id, offset=offset, limit=limit, eligible_only=eligible_only, exclude_run_id=exclude_run_id)
