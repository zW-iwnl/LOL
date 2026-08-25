from sqlalchemy import BigInteger, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestCaseTag(TimestampMixin, Base):
    __tablename__ = "test_case_tags"
    __table_args__ = (
        UniqueConstraint("category", "name", name="uq_test_case_tags_category_name"),
        Index("idx_test_case_tags_category", "category"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    assignments = relationship(
        "TestCaseTagAssignment",
        back_populates="tag",
        cascade="all, delete-orphan",
    )


class TestCaseTagAssignment(TimestampMixin, Base):
    __tablename__ = "test_case_tag_assignments"
    __table_args__ = (
        Index("idx_test_case_tag_assignments_tag_id", "tag_id", "test_case_id"),
    )

    test_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("test_case_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    test_case = relationship("TestCase", back_populates="tag_assignments")
    tag = relationship("TestCaseTag", back_populates="assignments")
