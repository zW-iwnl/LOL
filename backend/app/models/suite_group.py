from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class SuiteGroup(TimestampMixin, Base):
    __tablename__ = "suite_groups"
    __table_args__ = (
        UniqueConstraint("parent_group_id", "name", name="uq_suite_groups_parent_name"),
        Index("idx_suite_groups_parent_group_id", "parent_group_id"),
        Index(
            "uq_suite_groups_root_name",
            "name",
            unique=True,
            postgresql_where=text("parent_group_id IS NULL"),
            sqlite_where=text("parent_group_id IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parent_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("suite_groups.id", ondelete="RESTRICT"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    parent_group = relationship(
        "SuiteGroup",
        remote_side=[id],
        back_populates="child_groups",
    )
    child_groups = relationship(
        "SuiteGroup",
        back_populates="parent_group",
        order_by="SuiteGroup.sort_order, SuiteGroup.name",
    )
    memberships = relationship(
        "SuiteGroupMember",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SuiteGroupMember.sort_order, SuiteGroupMember.suite_id",
    )

    @property
    def members(self) -> list["SuiteGroupMember"]:
        return self.memberships

    test_case_memberships = relationship(
        "SuiteGroupTestCaseMember",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SuiteGroupTestCaseMember.sort_order, SuiteGroupTestCaseMember.test_case_id",
    )

    @property
    def test_case_members(self) -> list["SuiteGroupTestCaseMember"]:
        return self.test_case_memberships


class SuiteGroupMember(TimestampMixin, Base):
    __tablename__ = "suite_group_members"
    __table_args__ = (
        Index("idx_suite_group_members_suite_id", "suite_id"),
    )

    group_id: Mapped[int] = mapped_column(
        ForeignKey("suite_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    suite_id: Mapped[int] = mapped_column(
        ForeignKey("test_suites.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    group = relationship("SuiteGroup", back_populates="memberships")
    suite = relationship("TestSuite", back_populates="group_memberships")


class SuiteGroupTestCaseMember(TimestampMixin, Base):
    __tablename__ = "suite_group_test_case_members"
    __table_args__ = (
        Index(
            "idx_suite_group_test_case_members_test_case_id",
            "test_case_id",
            "group_id",
        ),
    )

    group_id: Mapped[int] = mapped_column(
        ForeignKey("suite_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    test_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    group = relationship("SuiteGroup", back_populates="test_case_memberships")
    test_case = relationship("TestCase", back_populates="suite_group_memberships")
