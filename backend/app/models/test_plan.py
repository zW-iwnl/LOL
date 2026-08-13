from sqlalchemy import BigInteger, Column, ForeignKey, Index, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


test_plan_runs = Table(
    "test_plan_runs",
    Base.metadata,
    Column("test_plan_id", BigInteger, ForeignKey("test_plans.id"), primary_key=True),
    Column("test_run_id", BigInteger, ForeignKey("test_runs.id"), primary_key=True),
)


class TestPlan(TimestampMixin, Base):
    __tablename__ = "test_plans"
    __table_args__ = (Index("idx_test_plans_project_id", "project_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    release_id: Mapped[int | None] = mapped_column(ForeignKey("releases.id"), nullable=True)
    milestone_id: Mapped[int | None] = mapped_column(ForeignKey("milestones.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="test_plans")
    release = relationship("Release", back_populates="test_plans")
    milestone = relationship("Milestone", back_populates="test_plans")
    creator = relationship("User", foreign_keys=[created_by])
    test_runs = relationship("TestRun", secondary=test_plan_runs, back_populates="test_plans")
