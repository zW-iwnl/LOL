from fastapi import APIRouter

from app.api.routes import auth, dashboard, defects, projects, test_cases, test_runs, test_suites, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(test_suites.router)
api_router.include_router(test_cases.router)
api_router.include_router(test_runs.router)
api_router.include_router(defects.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
