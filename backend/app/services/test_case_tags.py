from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import TestCaseTag, TestCaseTagAssignment
from app.schemas.test_case_tag import TestCaseTagCategory, TestCaseTagCreate, TestCaseTagUpdate
from app.services.common import not_found


def list_tags(db: Session, category: TestCaseTagCategory | None = None) -> list[TestCaseTag]:
    query = db.query(TestCaseTag)
    if category is not None:
        query = query.filter(TestCaseTag.category == category)
    return query.order_by(TestCaseTag.category, TestCaseTag.name).all()


def get_tag(db: Session, tag_id: int) -> TestCaseTag:
    tag = db.get(TestCaseTag, tag_id)
    if tag is None:
        raise not_found("Položka číselníku")
    return tag


def _ensure_unique(db: Session, category: str, name: str, exclude_id: int | None = None) -> None:
    query = db.query(TestCaseTag).filter(
        TestCaseTag.category == category,
        func.lower(TestCaseTag.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(TestCaseTag.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Položka se stejným názvem už v tomto číselníku existuje.",
        )


def create_tag(db: Session, payload: TestCaseTagCreate) -> TestCaseTag:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Název je povinný.")
    _ensure_unique(db, payload.category, name)
    tag = TestCaseTag(category=payload.category, name=name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_tag(db: Session, tag_id: int, payload: TestCaseTagUpdate) -> TestCaseTag:
    tag = get_tag(db, tag_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Název je povinný.")
    _ensure_unique(db, tag.category, name, exclude_id=tag.id)
    tag.name = name
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag_id: int) -> None:
    tag = get_tag(db, tag_id)
    in_use = db.query(TestCaseTagAssignment.test_case_id).filter(
        TestCaseTagAssignment.tag_id == tag_id
    ).first()
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Položku nelze odstranit, protože ji používá některý test case.",
        )
    db.delete(tag)
    db.commit()


def validate_tag(db: Session, tag_id: int | None, expected_category: TestCaseTagCategory) -> None:
    if tag_id is None:
        return
    tag = get_tag(db, tag_id)
    if tag.category != expected_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Položka {tag.name} nepatří do číselníku {expected_category}.",
        )


def validate_tags(
    db: Session,
    tag_ids: list[int],
    expected_category: TestCaseTagCategory,
) -> list[TestCaseTag]:
    normalized_ids = list(dict.fromkeys(tag_ids))
    if len(normalized_ids) != len(tag_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seznam tagů obsahuje duplicitní ID.",
        )
    tags = db.query(TestCaseTag).filter(TestCaseTag.id.in_(normalized_ids)).all() if normalized_ids else []
    found_ids = {tag.id for tag in tags}
    missing_ids = sorted(set(normalized_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tagy nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )
    wrong = [tag.name for tag in tags if tag.category != expected_category]
    if wrong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tagy nepatří do kategorie {expected_category}: {', '.join(wrong)}.",
        )
    by_id = {tag.id: tag for tag in tags}
    return [by_id[tag_id] for tag_id in normalized_ids]


def validate_tag_ids(db: Session, tag_ids: list[int]) -> list[TestCaseTag]:
    normalized_ids = list(dict.fromkeys(tag_ids))
    if len(normalized_ids) != len(tag_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seznam tagů obsahuje duplicitní ID.",
        )
    tags = db.query(TestCaseTag).filter(TestCaseTag.id.in_(normalized_ids)).all() if normalized_ids else []
    found_ids = {tag.id for tag in tags}
    missing_ids = sorted(set(normalized_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tagy nebyly nalezeny: {', '.join(map(str, missing_ids))}.",
        )
    by_id = {tag.id: tag for tag in tags}
    return [by_id[tag_id] for tag_id in normalized_ids]
