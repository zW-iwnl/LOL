from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRunStepResult(TimestampMixin, Base):
    __tablename__ = "test_run_step_results"
    __table_args__ = (
        UniqueConstraint(
            "test_run_case_attempt_id",
            "test_step_id",
            name="uq_test_run_step_results_attempt_step",
        ),
        ForeignKeyConstraint(
            ["test_run_case_attempt_id", "test_run_case_id"],
            ["test_run_case_attempts.id", "test_run_case_attempts.test_run_case_id"],
            name="fk_step_results_attempt_run_case",
            ondelete="CASCADE",
        ),
        CheckConstraint("step_order >= 1", name="ck_test_run_step_results_order_positive"),
        CheckConstraint(
            "result IN ('not_run', 'passed', 'failed', 'skipped')",
            name="ck_test_run_step_results_result",
        ),
        Index("idx_test_run_step_results_run_case_id", "test_run_case_id"),
        Index("idx_test_run_step_results_case_attempt_id", "test_run_case_attempt_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_run_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    test_run_case_attempt_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    test_step_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="not_run")
    executed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    test_run_case = relationship(
        "TestRunCase",
        back_populates="all_step_results",
        overlaps="step_results,test_run_case_attempt",
    )
    test_run_case_attempt = relationship(
        "TestRunCaseAttempt",
        back_populates="step_results",
        overlaps="all_step_results,test_run_case",
    )
    executor = relationship("User", foreign_keys=[executed_by])
