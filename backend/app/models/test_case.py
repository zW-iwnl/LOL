from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestCase(TimestampMixin, Base):
    __tablename__ = "test_cases"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'ready', 'deprecated')", name="ck_test_cases_status"),
        CheckConstraint("version >= 1", name="ck_test_cases_version_positive"),
        Index("idx_test_cases_suite_id", "suite_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    suite_id: Mapped[int] = mapped_column(ForeignKey("test_suites.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    preconditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    automated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    current_approved_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("test_case_versions.id", use_alter=True, name="fk_case_published_version"), nullable=True)
    next_version_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    origin_run_id: Mapped[int | None] = mapped_column(ForeignKey("test_runs.id"), nullable=True)

    suite = relationship("TestSuite", back_populates="test_cases")
    creator = relationship("User", back_populates="created_test_cases", foreign_keys=[created_by])
    steps = relationship(
        "TestStep",
        back_populates="test_case",
        cascade="all, delete-orphan",
        order_by="TestStep.step_order",
    )
    test_run_cases = relationship(
        "TestRunCase",
        back_populates="test_case",
        passive_deletes=True,
    )
    requirements = relationship("Requirement", secondary="requirement_test_cases", back_populates="test_cases")
    tag_assignments = relationship(
        "TestCaseTagAssignment",
        back_populates="test_case",
        cascade="all, delete-orphan",
        order_by="TestCaseTagAssignment.tag_id",
    )
    suite_group_memberships = relationship(
        "SuiteGroupTestCaseMember",
        back_populates="test_case",
        cascade="all, delete-orphan",
    )

    @property
    def tags(self):
        return sorted(
            (assignment.tag for assignment in self.tag_assignments),
            key=lambda tag: (tag.category, tag.name.casefold(), tag.id),
        )

    @property
    def tag_ids(self) -> list[int]:
        return [tag.id for tag in self.tags]

    def _first_tag(self, category: str):
        return next((tag for tag in self.tags if tag.category == category), None)

    @property
    def business_area(self):
        return self._first_tag("business_area")

    @property
    def application_domain(self):
        return self._first_tag("application_domain")

    @property
    def object_type(self):
        return self._first_tag("object_type")

    @property
    def business_area_id(self) -> int | None:
        tag = self.business_area
        return tag.id if tag else None

    @property
    def application_domain_id(self) -> int | None:
        tag = self.application_domain
        return tag.id if tag else None

    @property
    def object_type_id(self) -> int | None:
        tag = self.object_type
        return tag.id if tag else None
