from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="tester")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_projects = relationship(
        "Project",
        back_populates="creator",
        foreign_keys="Project.created_by",
    )
    created_test_suites = relationship(
        "TestSuite",
        back_populates="creator",
        foreign_keys="TestSuite.created_by",
    )
    created_test_cases = relationship(
        "TestCase",
        back_populates="creator",
        foreign_keys="TestCase.created_by",
    )
    created_test_runs = relationship(
        "TestRun",
        back_populates="creator",
        foreign_keys="TestRun.created_by",
    )
    assigned_test_run_cases = relationship(
        "TestRunCase",
        back_populates="assignee",
        foreign_keys="TestRunCase.assigned_to",
    )
    executed_test_run_cases = relationship(
        "TestRunCase",
        back_populates="executor",
        foreign_keys="TestRunCase.executed_by",
    )
    assigned_defects = relationship(
        "Defect",
        back_populates="assignee",
        foreign_keys="Defect.assigned_to",
    )
    reported_defects = relationship(
        "Defect",
        back_populates="reporter",
        foreign_keys="Defect.reported_by",
    )
