from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.test_case import TestCaseRead
from app.schemas.test_suite import TestSuiteCreate, TestSuiteRead, TestSuiteTreeNode, TestSuiteUpdate
from app.services import test_suites as suite_service

router = APIRouter(tags=["Test Suites"])


@router.get("/test-suites", response_model=list[TestSuiteRead])
def list_suites(db: DbSession):
    return suite_service.list_suites(db)


@router.post("/test-suites", response_model=TestSuiteRead, status_code=status.HTTP_201_CREATED)
def create_suite(payload: TestSuiteCreate, db: DbSession, current_user: CurrentUser):
    return suite_service.create_suite(db, payload, current_user)


@router.get("/test-suites/tree", response_model=list[TestSuiteTreeNode])
def suite_tree(db: DbSession):
    return suite_service.get_suite_tree(db)


@router.get("/test-suites/search", response_model=list[TestSuiteRead])
def search_suites(db: DbSession, q: str = Query(min_length=2)):
    return suite_service.search_suites(db, q)


@router.get("/test-suites/{suite_id}", response_model=TestSuiteRead)
def get_suite(suite_id: int, db: DbSession):
    return suite_service.get_suite(db, suite_id)


@router.put("/test-suites/{suite_id}", response_model=TestSuiteRead)
def update_suite(suite_id: int, payload: TestSuiteUpdate, db: DbSession):
    return suite_service.update_suite(db, suite_id, payload)


@router.delete("/test-suites/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_suite(suite_id: int, db: DbSession) -> Response:
    suite_service.delete_suite(db, suite_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/test-suites/{suite_id}/children", response_model=list[TestSuiteRead])
def get_children(suite_id: int, db: DbSession):
    return suite_service.get_children(db, suite_id)


@router.get("/test-suites/{suite_id}/test-cases", response_model=list[TestCaseRead])
def suite_test_cases(suite_id: int, db: DbSession):
    return suite_service.get_suite_test_cases(db, suite_id)
