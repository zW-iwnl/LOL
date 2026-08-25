"""Remove test case type.

Revision ID: 0013_remove_test_case_type
Revises: 0012_remove_test_case_priority
Create Date: 2026-08-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0013_remove_test_case_type"
down_revision: str | None = "0012_remove_test_case_priority"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("test_cases", "type")


def downgrade() -> None:
    op.add_column(
        "test_cases",
        sa.Column("type", sa.String(length=50), nullable=False, server_default="manual"),
    )
