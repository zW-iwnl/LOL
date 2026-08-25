"""Remove test case priority.

Revision ID: 0012_remove_test_case_priority
Revises: 0011_case_attempt_numbers
Create Date: 2026-08-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_remove_test_case_priority"
down_revision: str | None = "0011_case_attempt_numbers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("test_cases", "priority")


def downgrade() -> None:
    op.add_column(
        "test_cases",
        sa.Column("priority", sa.String(length=30), nullable=False, server_default="medium"),
    )
