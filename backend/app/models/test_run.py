from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRun(TimestampMixin, Base):
    __tablename__ = "test_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'in_progress', 'completed', 'archived')",
            name="ck_test_runs_status",
        ),
        CheckConstraint(
            "planned_start IS NULL OR planned_end IS NULL OR planned_end >= planned_start",
            name="ck_test_runs_planned_dates",
        ),
        Index("idx_test_runs_created_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    environment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    planned_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    creator = relationship("User", back_populates="created_test_runs", foreign_keys=[created_by])
    test_run_cases = relationship("TestRunCase", back_populates="test_run", cascade="all, delete-orphan")
    attempts = relationship(
        "TestRunAttempt",
        back_populates="test_run",
        cascade="all, delete-orphan",
        order_by="TestRunAttempt.attempt_number",
    )
