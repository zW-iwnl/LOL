from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRunAttempt(TimestampMixin, Base):
    __tablename__ = "test_run_attempts"
    __table_args__ = (
        UniqueConstraint("test_run_id", "attempt_number", name="uq_test_run_attempts_run_number"),
        Index("idx_test_run_attempts_test_run_id", "test_run_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[int] = mapped_column(
        ForeignKey("test_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    last_test_run_case_id: Mapped[int | None] = mapped_column(
        ForeignKey("test_run_cases.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_step_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    test_run = relationship("TestRun", back_populates="attempts")
    creator = relationship("User", foreign_keys=[created_by])
    case_attempts = relationship(
        "TestRunCaseAttempt",
        back_populates="test_run_attempt",
        cascade="all, delete-orphan",
    )
