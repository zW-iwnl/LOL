from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class Defect(TimestampMixin, Base):
    __tablename__ = "defects"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    test_run_case_id: Mapped[int | None] = mapped_column(ForeignKey("test_run_cases.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="medium")
    priority: Mapped[str] = mapped_column(String(30), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reported_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="defects")
    test_run_case = relationship("TestRunCase", back_populates="defects")
    assignee = relationship("User", back_populates="assigned_defects", foreign_keys=[assigned_to])
    reporter = relationship("User", back_populates="reported_defects", foreign_keys=[reported_by])
