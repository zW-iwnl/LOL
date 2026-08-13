"""Add test planning entities.

Revision ID: 0002_test_planning
Revises: 0001_initial_schema
Create Date: 2026-05-22
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0002_test_planning"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "releases",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("release_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint("project_id", "name", name="uq_releases_project_name"),
    )
    op.create_index("idx_releases_project_id", "releases", ["project_id"])

    op.create_table(
        "milestones",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("release_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("planned_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["release_id"], ["releases.id"]),
    )
    op.create_index("idx_milestones_project_id", "milestones", ["project_id"])

    op.create_table(
        "test_plans",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("release_id", sa.BigInteger(), nullable=True),
        sa.Column("milestone_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["milestone_id"], ["milestones.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["release_id"], ["releases.id"]),
    )
    op.create_index("idx_test_plans_project_id", "test_plans", ["project_id"])

    op.create_table(
        "test_plan_runs",
        sa.Column("test_plan_id", sa.BigInteger(), nullable=False),
        sa.Column("test_run_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["test_plan_id"], ["test_plans.id"]),
        sa.ForeignKeyConstraint(["test_run_id"], ["test_runs.id"]),
        sa.PrimaryKeyConstraint("test_plan_id", "test_run_id"),
    )


def downgrade() -> None:
    op.drop_table("test_plan_runs")
    op.drop_index("idx_test_plans_project_id", table_name="test_plans")
    op.drop_table("test_plans")
    op.drop_index("idx_milestones_project_id", table_name="milestones")
    op.drop_table("milestones")
    op.drop_index("idx_releases_project_id", table_name="releases")
    op.drop_table("releases")
