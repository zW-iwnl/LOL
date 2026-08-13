from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestRunCase(TimestampMixin, Base):
    __tablename__ = "test_run_cases"
    __table_args__ = (Index("idx_test_run_cases_test_run_id", "test_run_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[int] = mapped_column(ForeignKey("test_runs.id"), nullable=False)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id"), nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="not_run")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    defect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    test_case_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    test_case_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    test_run = relationship("TestRun", back_populates="test_run_cases")
    test_case = relationship("TestCase", back_populates="test_run_cases")
    assignee = relationship("User", back_populates="assigned_test_run_cases", foreign_keys=[assigned_to])
    executor = relationship("User", back_populates="executed_test_run_cases", foreign_keys=[executed_by])
    defects = relationship("Defect", back_populates="test_run_case")

    @property
    def code(self) -> str:
        return self.test_case.code

    @property
    def title(self) -> str:
        return self.test_case.title

    @property
    def priority(self) -> str:
        return self.test_case.priority

    @property
    def suite_name(self) -> str | None:
        return self.test_case.suite.name if self.test_case.suite else None
