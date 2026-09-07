from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRunCase(TimestampMixin, Base):
    __tablename__ = "test_run_cases"
    __table_args__ = (
        UniqueConstraint("test_run_id", "test_case_id", name="uq_test_run_cases_run_case"),
        CheckConstraint(
            "result IN ('not_run', 'passed', 'failed', 'blocked', 'skipped')",
            name="ck_test_run_cases_result",
        ),
        CheckConstraint("test_case_version >= 1", name="ck_test_run_cases_version_positive"),
        Index("idx_test_run_cases_test_case_id", "test_case_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[int] = mapped_column(ForeignKey("test_runs.id"), nullable=False)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id"), nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="not_run")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    test_case_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    test_case_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    test_run = relationship("TestRun", back_populates="test_run_cases")
    test_case = relationship("TestCase", back_populates="test_run_cases")
    assignee = relationship("User", back_populates="assigned_test_run_cases", foreign_keys=[assigned_to])
    executor = relationship("User", back_populates="executed_test_run_cases", foreign_keys=[executed_by])
    case_attempts = relationship(
        "TestRunCaseAttempt",
        back_populates="test_run_case",
        cascade="all, delete-orphan",
    )
    all_step_results = relationship(
        "TestRunStepResult",
        back_populates="test_run_case",
        cascade="all, delete-orphan",
        order_by="TestRunStepResult.step_order",
    )

    @property
    def latest_case_attempt(self):
        if not self.case_attempts:
            return None
        return max(self.case_attempts, key=lambda item: (item.test_run_attempt.attempt_number, item.attempt_number))

    @property
    def step_results(self):
        latest = self.latest_case_attempt
        return latest.step_results if latest else []

    @property
    def code(self) -> str:
        return self.test_case.code

    @property
    def title(self) -> str:
        return self.test_case.title


    @property
    def suite_name(self) -> str | None:
        return self.test_case.suite.name if self.test_case.suite else None
