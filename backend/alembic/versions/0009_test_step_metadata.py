"""Add test step type and note.

Revision ID: 0009_test_step_metadata
Revises: 0008_remove_test_plans
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_test_step_metadata"
down_revision: str | None = "0008_remove_test_plans"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "test_steps",
        sa.Column("step_type", sa.String(length=30), nullable=False, server_default="test"),
    )
    op.add_column("test_steps", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("test_steps", "note")
    op.drop_column("test_steps", "step_type")
