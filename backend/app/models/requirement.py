from sqlalchemy import BigInteger, CheckConstraint, Column, ForeignKey, Index, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


requirement_test_cases = Table(
    "requirement_test_cases",
    Base.metadata,
    Column("requirement_id", BigInteger, ForeignKey("requirements.id"), primary_key=True),
    Column("test_case_id", BigInteger, ForeignKey("test_cases.id"), primary_key=True),
)
Index(
    "idx_requirement_test_cases_case_requirement",
    requirement_test_cases.c.test_case_id,
    requirement_test_cases.c.requirement_id,
)


class Requirement(TimestampMixin, Base):
    __tablename__ = "requirements"
    __table_args__ = (
        UniqueConstraint("code", name="uq_requirements_code"),
        CheckConstraint("priority IN ('low', 'medium', 'high', 'critical')", name="ck_requirements_priority"),
        CheckConstraint("status IN ('draft', 'approved', 'deprecated')", name="ck_requirements_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(30), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    creator = relationship("User", foreign_keys=[created_by])
    test_cases = relationship("TestCase", secondary=requirement_test_cases, back_populates="requirements")
