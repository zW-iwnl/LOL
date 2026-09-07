from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRunCaseAttempt(TimestampMixin, Base):
    __tablename__ = "test_run_case_attempts"
    __table_args__ = (
        UniqueConstraint(
            "test_run_attempt_id",
            "test_run_case_id",
            "attempt_number",
            name="uq_test_run_case_attempts_attempt_case_number",
        ),
        UniqueConstraint(
            "id",
            "test_run_case_id",
            name="uq_test_run_case_attempts_id_run_case",
        ),
        CheckConstraint("attempt_number >= 1", name="ck_test_run_case_attempts_number_positive"),
        CheckConstraint(
            "result IN ('not_run', 'passed', 'failed', 'blocked', 'skipped')",
            name="ck_test_run_case_attempts_result",
        ),
        Index("idx_test_run_case_attempts_attempt_id", "test_run_attempt_id"),
        Index("idx_test_run_case_attempts_run_case_id", "test_run_case_id"),
        Index(
            "idx_test_run_case_attempts_run_case_executed",
            "test_run_case_id",
            "executed_at",
            "updated_at",
            postgresql_where=text("result <> 'not_run'"),
            sqlite_where=text("result <> 'not_run'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_run_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    test_run_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_run_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="not_run")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    test_case_version_id: Mapped[int | None] = mapped_column(ForeignKey("test_case_versions.id", ondelete="RESTRICT"))
    execution_snapshot: Mapped[dict | None] = mapped_column(JSON)
    version_number: Mapped[int | None] = mapped_column(Integer)
    approval_state_at_binding: Mapped[str] = mapped_column(String(40), default="unknown", server_default="unknown")
    approval_state_at_start: Mapped[str | None] = mapped_column(String(40))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closure_reason: Mapped[str | None] = mapped_column(String(40))

    test_run_attempt = relationship("TestRunAttempt", back_populates="case_attempts")
    test_run_case = relationship("TestRunCase", back_populates="case_attempts")
    executor = relationship("User", foreign_keys=[executed_by])
    step_results = relationship(
        "TestRunStepResult",
        back_populates="test_run_case_attempt",
        cascade="all, delete-orphan",
        order_by="TestRunStepResult.step_order",
        overlaps="all_step_results,test_run_case",
    )
