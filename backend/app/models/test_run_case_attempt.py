from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
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
        Index("idx_test_run_case_attempts_attempt_id", "test_run_attempt_id"),
        Index("idx_test_run_case_attempts_run_case_id", "test_run_case_id"),
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

    test_run_attempt = relationship("TestRunAttempt", back_populates="case_attempts")
    test_run_case = relationship("TestRunCase", back_populates="case_attempts")
    executor = relationship("User", foreign_keys=[executed_by])
    step_results = relationship(
        "TestRunStepResult",
        back_populates="test_run_case_attempt",
        cascade="all, delete-orphan",
        order_by="TestRunStepResult.step_order",
    )
