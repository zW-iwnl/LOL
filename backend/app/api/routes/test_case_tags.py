from fastapi import APIRouter, Response, status

from app.api.deps import DbSession
from app.schemas.test_case_tag import TestCaseTagCategory, TestCaseTagCreate, TestCaseTagRead, TestCaseTagUpdate
from app.services import test_case_tags as tag_service

router = APIRouter(prefix="/test-case-tags", tags=["Test Case Tags"])


@router.get("", response_model=list[TestCaseTagRead])
def list_tags(db: DbSession, category: TestCaseTagCategory | None = None):
    return tag_service.list_tags(db, category)


@router.post("", response_model=TestCaseTagRead, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TestCaseTagCreate, db: DbSession):
    return tag_service.create_tag(db, payload)


@router.put("/{tag_id}", response_model=TestCaseTagRead)
def update_tag(tag_id: int, payload: TestCaseTagUpdate, db: DbSession):
    return tag_service.update_tag(db, tag_id, payload)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: DbSession) -> Response:
    tag_service.delete_tag(db, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
