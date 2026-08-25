"""Add explicit test case membership to suite groups.

Revision ID: 0017_group_test_cases
Revises: 0016_tag_assignments
Create Date: 2026-08-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0017_group_test_cases"
down_revision: str | None = "0016_tag_assignments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suite_group_test_case_members",
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("test_case_id", sa.BigInteger(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["suite_groups.id"],
            name="fk_suite_group_test_case_members_group_id_suite_groups",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["test_case_id"],
            ["test_cases.id"],
            name="fk_suite_group_test_case_members_test_case_id_test_cases",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("group_id", "test_case_id"),
    )
    op.create_index(
        "idx_suite_group_test_case_members_test_case_id",
        "suite_group_test_case_members",
        ["test_case_id", "group_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_suite_group_test_case_members_test_case_id",
        table_name="suite_group_test_case_members",
    )
    op.drop_table("suite_group_test_case_members")
