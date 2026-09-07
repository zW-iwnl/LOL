from fastapi import APIRouter, Response, status

from app.api.deps import DbSession
from app.schemas.suite_group import (
    SuiteGroupChildCreate,
    SuiteGroupCreate,
    SuiteGroupIdsUpdate,
    SuiteGroupMemberCreate,
    SuiteGroupMemberRead,
    SuiteGroupMemberUpdate,
    SuiteGroupParentIdsUpdate,
    SuiteGroupRead,
    SuiteGroupTestCaseIdsUpdate,
    SuiteGroupUpdate,
)
from app.schemas.test_suite import TestSuiteRead
from app.services import suite_groups as group_service

router = APIRouter(prefix="/suite-groups", tags=["Suite Groups"])


@router.get("", response_model=list[SuiteGroupRead])
def list_groups(db: DbSession):
    return group_service.list_groups(db)


@router.post("", response_model=SuiteGroupRead, status_code=status.HTTP_201_CREATED)
def create_group(payload: SuiteGroupCreate, db: DbSession):
    return group_service.create_group(db, payload)


@router.get("/{group_id}", response_model=SuiteGroupRead)
def get_group(group_id: int, db: DbSession):
    return group_service.get_group(db, group_id)


@router.put("/{group_id}", response_model=SuiteGroupRead)
def update_group(group_id: int, payload: SuiteGroupUpdate, db: DbSession):
    return group_service.update_group(db, group_id, payload)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: DbSession) -> Response:
    group_service.delete_group(db, group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{parent_group_id}/children", response_model=SuiteGroupRead)
def add_child(
    parent_group_id: int,
    payload: SuiteGroupChildCreate,
    db: DbSession,
):
    return group_service.add_child(
        db,
        parent_group_id,
        payload.child_group_id,
        payload.sort_order,
    )


@router.delete(
    "/{parent_group_id}/children/{child_group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_child(
    parent_group_id: int,
    child_group_id: int,
    db: DbSession,
) -> Response:
    group_service.remove_child(db, parent_group_id, child_group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{group_id}/parents", response_model=SuiteGroupRead)
def set_group_parents(
    group_id: int,
    payload: SuiteGroupParentIdsUpdate,
    db: DbSession,
):
    return group_service.set_group_parents(db, group_id, payload.parent_group_ids)


@router.post(
    "/{group_id}/members",
    response_model=SuiteGroupMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_member(group_id: int, payload: SuiteGroupMemberCreate, db: DbSession):
    return group_service.add_member(db, group_id, payload)


@router.put("/{group_id}/members/{suite_id}", response_model=SuiteGroupMemberRead)
def update_member(
    group_id: int,
    suite_id: int,
    payload: SuiteGroupMemberUpdate,
    db: DbSession,
):
    return group_service.update_member(db, group_id, suite_id, payload)


@router.delete("/{group_id}/members/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(group_id: int, suite_id: int, db: DbSession) -> Response:
    group_service.remove_member(db, group_id, suite_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{group_id}/test-case-members", response_model=SuiteGroupRead)
def set_group_test_cases(
    group_id: int,
    payload: SuiteGroupTestCaseIdsUpdate,
    db: DbSession,
):
    return group_service.set_group_test_cases(db, group_id, payload.test_case_ids)


@router.put("/suites/{suite_id}/groups", response_model=TestSuiteRead)
def set_suite_groups(
    suite_id: int,
    payload: SuiteGroupIdsUpdate,
    db: DbSession,
):
    return group_service.set_suite_groups(db, suite_id, payload.group_ids)
