from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.requirement import (
    RequirementCreate,
    RequirementLinkTestCasesRequest,
    RequirementRead,
    RequirementUpdate,
    TraceabilityRow,
)
from app.services import requirements as requirement_service

router = APIRouter(tags=["Requirements", "Traceability"])


@router.get("/projects/{project_id}/requirements", response_model=list[RequirementRead])
def list_requirements(project_id: int, db: DbSession):
    return requirement_service.list_requirements(db, project_id)


@router.post("/projects/{project_id}/requirements", response_model=RequirementRead, status_code=status.HTTP_201_CREATED)
def create_requirement(project_id: int, payload: RequirementCreate, db: DbSession, current_user: CurrentUser):
    return requirement_service.create_requirement(db, project_id, payload, current_user)


@router.get("/requirements/{requirement_id}", response_model=RequirementRead)
def get_requirement(requirement_id: int, db: DbSession):
    return requirement_service.get_requirement(db, requirement_id)


@router.put("/requirements/{requirement_id}", response_model=RequirementRead)
def update_requirement(requirement_id: int, payload: RequirementUpdate, db: DbSession):
    return requirement_service.update_requirement(db, requirement_id, payload)


@router.delete("/requirements/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_requirement(requirement_id: int, db: DbSession) -> Response:
    requirement_service.delete_requirement(db, requirement_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/requirements/{requirement_id}/test-cases", response_model=RequirementRead, status_code=status.HTTP_201_CREATED)
def link_test_cases(requirement_id: int, payload: RequirementLinkTestCasesRequest, db: DbSession):
    return requirement_service.link_test_cases(db, requirement_id, payload)


@router.delete("/requirements/{requirement_id}/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_test_case(requirement_id: int, test_case_id: int, db: DbSession) -> Response:
    requirement_service.unlink_test_case(db, requirement_id, test_case_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/projects/{project_id}/traceability", response_model=list[TraceabilityRow])
def get_traceability_matrix(project_id: int, db: DbSession):
    return requirement_service.get_traceability_matrix(db, project_id)
