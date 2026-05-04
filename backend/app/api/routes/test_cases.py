from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.test_case import TestCaseCreate, TestCaseRead, TestCaseUpdate, TestStepCreate, TestStepRead, TestStepUpdate
from app.services import test_cases as test_case_service

router = APIRouter(tags=["Test Cases"])


@router.get("/projects/{project_id}/test-cases", response_model=list[TestCaseRead])
def list_test_cases(project_id: int, db: DbSession, suite_id: int | None = None):
    return test_case_service.list_test_cases(db, project_id, suite_id)


@router.post("/projects/{project_id}/test-cases", response_model=TestCaseRead, status_code=status.HTTP_201_CREATED)
def create_test_case(project_id: int, payload: TestCaseCreate, db: DbSession, current_user: CurrentUser):
    return test_case_service.create_test_case(db, project_id, payload, current_user)


@router.get("/test-cases/{test_case_id}", response_model=TestCaseRead)
def get_test_case(test_case_id: int, db: DbSession):
    return test_case_service.get_test_case(db, test_case_id)


@router.put("/test-cases/{test_case_id}", response_model=TestCaseRead)
def update_test_case(test_case_id: int, payload: TestCaseUpdate, db: DbSession):
    return test_case_service.update_test_case(db, test_case_id, payload)


@router.delete("/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(test_case_id: int, db: DbSession) -> Response:
    test_case_service.delete_test_case(db, test_case_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test-cases/{test_case_id}/steps", response_model=TestStepRead, status_code=status.HTTP_201_CREATED)
def create_step(test_case_id: int, payload: TestStepCreate, db: DbSession):
    return test_case_service.create_step(db, test_case_id, payload)


@router.put("/test-steps/{step_id}", response_model=TestStepRead)
def update_step(step_id: int, payload: TestStepUpdate, db: DbSession):
    return test_case_service.update_step(db, step_id, payload)


@router.delete("/test-steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(step_id: int, db: DbSession) -> Response:
    test_case_service.delete_step(db, step_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
