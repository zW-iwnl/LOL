"""Add audit events and test case execution snapshots.

Revision ID: 0004_audit_snapshots
Revises: 0003_requirements_traceability
Create Date: 2026-05-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_audit_snapshots"
down_revision: str | None = "0003_requirements_traceability"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.BigInteger(), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("changes", sa.JSON(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
    )
    op.create_index("idx_audit_events_entity", "audit_events", ["entity_type", "entity_id"])
    op.create_index("idx_audit_events_actor_id", "audit_events", ["actor_id"])

    op.add_column("test_cases", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("test_run_cases", sa.Column("test_case_version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("test_run_cases", sa.Column("test_case_snapshot", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("test_run_cases", "test_case_snapshot")
    op.drop_column("test_run_cases", "test_case_version")
    op.drop_column("test_cases", "version")
    op.drop_index("idx_audit_events_actor_id", table_name="audit_events")
    op.drop_index("idx_audit_events_entity", table_name="audit_events")
    op.drop_table("audit_events")
