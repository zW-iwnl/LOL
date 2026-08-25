"""Add nested suite groups and suite memberships.

Revision ID: 0015_suite_groups
Revises: 0014_remove_projects
Create Date: 2026-08-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0015_suite_groups"
down_revision: str | None = "0014_remove_projects"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suite_groups",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("parent_group_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_group_id"],
            ["suite_groups.id"],
            name="fk_suite_groups_parent_group_id_suite_groups",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("parent_group_id", "name", name="uq_suite_groups_parent_name"),
    )
    op.create_index("idx_suite_groups_parent_group_id", "suite_groups", ["parent_group_id"])
    op.create_index(
        "uq_suite_groups_root_name",
        "suite_groups",
        ["name"],
        unique=True,
        postgresql_where=sa.text("parent_group_id IS NULL"),
        sqlite_where=sa.text("parent_group_id IS NULL"),
    )

    op.create_table(
        "suite_group_members",
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("suite_id", sa.BigInteger(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["suite_groups.id"],
            name="fk_suite_group_members_group_id_suite_groups",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["suite_id"],
            ["test_suites.id"],
            name="fk_suite_group_members_suite_id_test_suites",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("group_id", "suite_id"),
    )
    op.create_index("idx_suite_group_members_suite_id", "suite_group_members", ["suite_id"])


def downgrade() -> None:
    op.drop_table("suite_group_members")
    op.drop_index("uq_suite_groups_root_name", table_name="suite_groups")
    op.drop_index("idx_suite_groups_parent_group_id", table_name="suite_groups")
    op.drop_table("suite_groups")
