"""Add descendant scope to suite group relations.

Revision ID: 0021_group_relation_scope
Revises: 0020_execution_integrity
Create Date: 2026-09-07
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0021_group_relation_scope"
down_revision: str | None = "0020_execution_integrity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suite_group_relations",
        sa.Column(
            "include_descendants",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("suite_group_relations", "include_descendants")
