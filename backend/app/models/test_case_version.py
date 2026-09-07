"""Content history and the independent review lifecycle."""
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestCaseDraft(TimestampMixin, Base):
    __tablename__ = "test_case_drafts"
    __table_args__ = (
        CheckConstraint("status IN ('open','submitted','closed')", name="ck_case_draft_status"),
        Index("uq_case_open_draft", "test_case_id", unique=True,
              postgresql_where=text("status IN ('open','submitted')"),
              sqlite_where=text("status IN ('open','submitted')")),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="RESTRICT"))
    base_version_id: Mapped[int | None] = mapped_column(ForeignKey("test_case_versions.id", use_alter=True))
    base_approved_version_id: Mapped[int | None] = mapped_column(BigInteger)
    content: Mapped[dict] = mapped_column(JSON)
    lock_version: Mapped[int] = mapped_column(Integer, default=1)
    editor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    contributors: Mapped[list] = mapped_column(JSON, default=list)
    change_summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open")
    origin_run_id: Mapped[int | None] = mapped_column(ForeignKey("test_runs.id"))
    origin_run_attempt_id: Mapped[int | None] = mapped_column(ForeignKey("test_run_attempts.id"))
    origin_case_attempt_id: Mapped[int | None] = mapped_column(ForeignKey("test_run_case_attempts.id", use_alter=True))
    last_frozen_version_id: Mapped[int | None] = mapped_column(BigInteger)


class TestCaseVersion(TimestampMixin, Base):
    __tablename__ = "test_case_versions"
    __table_args__ = (UniqueConstraint("test_case_id", "version_number", name="uq_case_version_number"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="RESTRICT"))
    version_number: Mapped[int] = mapped_column(Integer)
    source_draft_id: Mapped[int | None] = mapped_column(ForeignKey("test_case_drafts.id", use_alter=True))
    base_version_id: Mapped[int | None] = mapped_column(ForeignKey("test_case_versions.id"))
    content_snapshot: Mapped[dict] = mapped_column(JSON)
    content_hash: Mapped[str] = mapped_column(String(64))
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    change_summary: Mapped[str] = mapped_column(Text, default="")
    origin_run_id: Mapped[int | None] = mapped_column(ForeignKey("test_runs.id"))
    approval_basis: Mapped[str | None] = mapped_column(String(30))


class TestCaseReview(TimestampMixin, Base):
    __tablename__ = "test_case_reviews"
    __table_args__ = (
        CheckConstraint("status IN ('pending','approved','changes_requested','rejected','withdrawn')", name="ck_case_review_status"),
        Index("uq_case_pending_review", "test_case_id", unique=True,
              postgresql_where=text("status = 'pending'"), sqlite_where=text("status = 'pending'")),
        Index("idx_case_review_queue", "status", "reviewer_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="RESTRICT"))
    test_case_version_id: Mapped[int] = mapped_column(ForeignKey("test_case_versions.id", ondelete="RESTRICT"))
    base_approved_version_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    supersedes_review_id: Mapped[int | None] = mapped_column(ForeignKey("test_case_reviews.id"))
    lock_version: Mapped[int] = mapped_column(Integer, default=1)


class TestCaseReviewComment(TimestampMixin, Base):
    __tablename__ = "test_case_review_comments"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("test_case_reviews.id", ondelete="RESTRICT"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    field_path: Mapped[str | None] = mapped_column(String(255))
    is_blocking: Mapped[bool] = mapped_column(default=False)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TestCaseEvent(TimestampMixin, Base):
    __tablename__ = "test_case_events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="RESTRICT"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class TestCaseOperation(TimestampMixin, Base):
    __tablename__ = "test_case_operations"
    __table_args__ = (UniqueConstraint("actor_id", "key", name="uq_case_operation_actor_key"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict | None] = mapped_column(JSON)


class TestCaseVersionTag(Base):
    __tablename__ = "test_case_version_tags"
    version_id: Mapped[int] = mapped_column(ForeignKey("test_case_versions.id", ondelete="RESTRICT"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("test_case_tags.id", ondelete="RESTRICT"), primary_key=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    name_snapshot: Mapped[str] = mapped_column(String(255))
