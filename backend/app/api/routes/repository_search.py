from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.repository_search import RepositorySearchResponse
from app.services import repository_search as repository_search_service

router = APIRouter(tags=["Repository Search"])


@router.get("/repository/search", response_model=RepositorySearchResponse)
def search_repository(
    db: DbSession,
    q: str | None = Query(default=None, max_length=200),
    types: str = Query(default="test_case,test_suite,suite_group", max_length=80),
    limit: int = Query(default=20, ge=1, le=50),
    business_area_id: list[int] | None = Query(default=None),
    application_domain_id: list[int] | None = Query(default=None),
    object_type_id: list[int] | None = Query(default=None),
):
    return repository_search_service.search_repository(
        db=db,
        query=q,
        result_types=repository_search_service.parse_result_types(types),
        limit=limit,
        business_area_ids=business_area_id,
        application_domain_ids=application_domain_id,
        object_type_ids=object_type_id,
    )
