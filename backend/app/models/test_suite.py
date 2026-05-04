from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestSuite(TimestampMixin, Base):
    __tablename__ = "test_suites"
    __table_args__ = (
        Index("idx_test_suites_project_id", "project_id"),
        Index("idx_test_suites_parent_suite_id", "parent_suite_id"),
        Index("idx_test_suites_path", "path"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    parent_suite_id: Mapped[int | None] = mapped_column(ForeignKey("test_suites.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    path: Mapped[str] = mapped_column(String(1000), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="test_suites")
    parent_suite = relationship("TestSuite", remote_side=[id], back_populates="child_suites")
    child_suites = relationship("TestSuite", back_populates="parent_suite")
    creator = relationship("User", back_populates="created_test_suites", foreign_keys=[created_by])
    test_cases = relationship("TestCase", back_populates="suite")
