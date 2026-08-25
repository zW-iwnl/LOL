"""Add per-step execution results.

Revision ID: 0006_step_results
Revises: 0005_test_case_tags
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006_step_results"
down_revision: str | None = "0005_test_case_tags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "test_run_step_results",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("test_run_case_id", sa.BigInteger(), nullable=False),
        sa.Column("test_step_id", sa.BigInteger(), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("result", sa.String(length=30), nullable=False, server_default="not_run"),
        sa.Column("executed_by", sa.BigInteger(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["executed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["test_run_case_id"], ["test_run_cases.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("test_run_case_id", "test_step_id", name="uq_test_run_step_results_case_step"),
    )
    op.create_index(
        "idx_test_run_step_results_run_case_id",
        "test_run_step_results",
        ["test_run_case_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_test_run_step_results_run_case_id", table_name="test_run_step_results")
    op.drop_table("test_run_step_results")
