from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.test_case import TestCaseCreate, TestCaseRead, TestCaseUpdate, TestStepCreate, TestStepRead, TestStepUpdate
from app.services import test_cases as test_case_service

router = APIRouter(tags=["Test Cases"])


@router.get("/test-cases", response_model=list[TestCaseRead])
def list_all_test_cases(
    db: DbSession,
    suite_id: int | None = None,
    business_area_id: list[int] | None = Query(default=None),
    application_domain_id: list[int] | None = Query(default=None),
    object_type_id: list[int] | None = Query(default=None),
):
    return test_case_service.list_test_cases(
        db,
        suite_id=suite_id,
        business_area_ids=business_area_id,
        application_domain_ids=application_domain_id,
        object_type_ids=object_type_id,
    )


@router.post("/test-cases", response_model=TestCaseRead, status_code=status.HTTP_201_CREATED)
def create_test_case(payload: TestCaseCreate, db: DbSession, current_user: CurrentUser):
    return test_case_service.create_test_case(db, payload, current_user)


@router.get("/test-cases/{test_case_id}", response_model=TestCaseRead)
def get_test_case(test_case_id: int, db: DbSession):
    return test_case_service.get_test_case(db, test_case_id)


@router.put("/test-cases/{test_case_id}", response_model=TestCaseRead)
def update_test_case(test_case_id: int, payload: TestCaseUpdate, db: DbSession, current_user: CurrentUser):
    return test_case_service.update_test_case(db, test_case_id, payload, current_user)


@router.delete("/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(test_case_id: int, db: DbSession, current_user: CurrentUser) -> Response:
    if current_user.role not in {"test_lead", "admin"}:
        raise HTTPException(403, "Vyřazovat scénáře může pouze vedoucí nebo admin.")
    test_case_service.delete_test_case(db, test_case_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test-cases/{test_case_id}/steps", response_model=TestStepRead, status_code=status.HTTP_201_CREATED)
def create_step(test_case_id: int, payload: TestStepCreate, db: DbSession, current_user: CurrentUser):
    return test_case_service.create_step(db, test_case_id, payload, current_user)


@router.put("/test-steps/{step_id}", response_model=TestStepRead)
def update_step(step_id: int, payload: TestStepUpdate, db: DbSession, current_user: CurrentUser):
    return test_case_service.update_step(db, step_id, payload, current_user)


@router.delete("/test-steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(step_id: int, db: DbSession, current_user: CurrentUser) -> Response:
    test_case_service.delete_step(db, step_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
