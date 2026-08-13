from sqlalchemy import BigInteger, Column, ForeignKey, Index, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


requirement_test_cases = Table(
    "requirement_test_cases",
    Base.metadata,
    Column("requirement_id", BigInteger, ForeignKey("requirements.id"), primary_key=True),
    Column("test_case_id", BigInteger, ForeignKey("test_cases.id"), primary_key=True),
)


class Requirement(TimestampMixin, Base):
    __tablename__ = "requirements"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_requirements_project_code"),
        Index("idx_requirements_project_id", "project_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(30), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="requirements")
    creator = relationship("User", foreign_keys=[created_by])
    test_cases = relationship("TestCase", secondary=requirement_test_cases, back_populates="requirements")
