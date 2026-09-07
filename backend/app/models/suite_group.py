from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class SuiteGroup(TimestampMixin, Base):
    __tablename__ = "suite_groups"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_suite_groups_sort_order_nonnegative"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    outgoing_relations = relationship(
        "SuiteGroupRelation",
        foreign_keys="SuiteGroupRelation.parent_group_id",
        back_populates="parent_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SuiteGroupRelation.sort_order, SuiteGroupRelation.child_group_id",
    )
    incoming_relations = relationship(
        "SuiteGroupRelation",
        foreign_keys="SuiteGroupRelation.child_group_id",
        back_populates="child_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SuiteGroupRelation.parent_group_id",
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

    @property
    def parent_ids(self) -> list[int]:
        return [relation.parent_group_id for relation in self.incoming_relations]

    @property
    def child_ids(self) -> list[int]:
        return [relation.child_group_id for relation in self.outgoing_relations]

    @property
    def child_relations(self) -> list["SuiteGroupRelation"]:
        return self.outgoing_relations


class SuiteGroupRelation(TimestampMixin, Base):
    __tablename__ = "suite_group_relations"
    __table_args__ = (
        CheckConstraint("parent_group_id <> child_group_id", name="ck_suite_group_relations_not_self"),
        CheckConstraint("sort_order >= 0", name="ck_suite_group_relations_sort_order_nonnegative"),
        Index(
            "idx_suite_group_relations_parent_sort_child",
            "parent_group_id",
            "sort_order",
            "child_group_id",
        ),
        Index(
            "idx_suite_group_relations_child_parent",
            "child_group_id",
            "parent_group_id",
        ),
    )

    parent_group_id: Mapped[int] = mapped_column(
        ForeignKey("suite_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    child_group_id: Mapped[int] = mapped_column(
        ForeignKey("suite_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    include_descendants: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    parent_group = relationship(
        "SuiteGroup",
        foreign_keys=[parent_group_id],
        back_populates="outgoing_relations",
    )
    child_group = relationship(
        "SuiteGroup",
        foreign_keys=[child_group_id],
        back_populates="incoming_relations",
    )


class SuiteGroupMember(TimestampMixin, Base):
    __tablename__ = "suite_group_members"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_suite_group_members_sort_order_nonnegative"),
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
        CheckConstraint("sort_order >= 0", name="ck_suite_group_test_case_members_sort_order_nonnegative"),
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
