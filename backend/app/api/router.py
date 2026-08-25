from fastapi import APIRouter
from fastapi import Depends

from app.api.deps import get_current_user
from app.api.routes import auth, dashboard, repository_search, requirements, suite_groups, test_case_tags, test_cases, test_runs, test_suites, users

api_router = APIRouter()
api_router.include_router(auth.router)
protected_dependencies = [Depends(get_current_user)]
api_router.include_router(test_suites.router, dependencies=protected_dependencies)
api_router.include_router(suite_groups.router, dependencies=protected_dependencies)
api_router.include_router(repository_search.router, dependencies=protected_dependencies)
api_router.include_router(test_case_tags.router, dependencies=protected_dependencies)
api_router.include_router(test_cases.router, dependencies=protected_dependencies)
api_router.include_router(test_runs.router, dependencies=protected_dependencies)
api_router.include_router(requirements.router, dependencies=protected_dependencies)
api_router.include_router(dashboard.router, dependencies=protected_dependencies)
api_router.include_router(users.router, dependencies=protected_dependencies)
