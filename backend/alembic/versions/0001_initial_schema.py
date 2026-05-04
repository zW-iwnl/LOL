"""Initial database schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "test_suites",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_suite_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("path", sa.String(length=1000), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_suite_id"], ["test_suites.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("idx_test_suites_project_id", "test_suites", ["project_id"])
    op.create_index("idx_test_suites_parent_suite_id", "test_suites", ["parent_suite_id"])
    op.create_index("idx_test_suites_path", "test_suites", ["path"])

    op.create_table(
        "test_cases",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("suite_id", sa.BigInteger(), nullable=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("preconditions", sa.Text(), nullable=True),
        sa.Column("expected_summary", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(length=30), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("automated", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["suite_id"], ["test_suites.id"]),
        sa.UniqueConstraint("code"),
    )
    op.create_index("idx_test_cases_project_id", "test_cases", ["project_id"])
    op.create_index("idx_test_cases_suite_id", "test_cases", ["suite_id"])

    op.create_table(
        "test_steps",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("test_case_id", sa.BigInteger(), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("expected_result", sa.Text(), nullable=True),
        sa.Column("test_data", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["test_case_id"], ["test_cases.id"]),
    )

    op.create_table(
        "test_runs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("version", sa.String(length=100), nullable=True),
        sa.Column("environment", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("planned_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("idx_test_runs_project_id", "test_runs", ["project_id"])

    op.create_table(
        "test_run_cases",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("test_run_id", sa.BigInteger(), nullable=False),
        sa.Column("test_case_id", sa.BigInteger(), nullable=False),
        sa.Column("assigned_to", sa.BigInteger(), nullable=True),
        sa.Column("result", sa.String(length=30), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("executed_by", sa.BigInteger(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("defect_count", sa.Integer(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.ForeignKeyConstraint(["executed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["test_case_id"], ["test_cases.id"]),
        sa.ForeignKeyConstraint(["test_run_id"], ["test_runs.id"]),
    )
    op.create_index("idx_test_run_cases_test_run_id", "test_run_cases", ["test_run_id"])

    op.create_table(
        "defects",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("test_run_case_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(length=30), nullable=False),
        sa.Column("priority", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("assigned_to", sa.BigInteger(), nullable=True),
        sa.Column("reported_by", sa.BigInteger(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["reported_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["test_run_case_id"], ["test_run_cases.id"]),
    )


def downgrade() -> None:
    op.drop_table("defects")
    op.drop_index("idx_test_run_cases_test_run_id", table_name="test_run_cases")
    op.drop_table("test_run_cases")
    op.drop_index("idx_test_runs_project_id", table_name="test_runs")
    op.drop_table("test_runs")
    op.drop_table("test_steps")
    op.drop_index("idx_test_cases_suite_id", table_name="test_cases")
    op.drop_index("idx_test_cases_project_id", table_name="test_cases")
    op.drop_table("test_cases")
    op.drop_index("idx_test_suites_path", table_name="test_suites")
    op.drop_index("idx_test_suites_parent_suite_id", table_name="test_suites")
    op.drop_index("idx_test_suites_project_id", table_name="test_suites")
    op.drop_table("test_suites")
    op.drop_table("projects")
    op.drop_table("users")
