"""Add versioned execution attempts for test run reruns.

Revision ID: 0010_test_run_attempts
Revises: 0009_test_step_metadata
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_test_run_attempts"
down_revision: str | None = "0009_test_step_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "test_run_attempts",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("test_run_id", sa.BigInteger(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("last_test_run_case_id", sa.BigInteger(), nullable=True),
        sa.Column("last_step_id", sa.BigInteger(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["last_test_run_case_id"], ["test_run_cases.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["test_run_id"], ["test_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("test_run_id", "attempt_number", name="uq_test_run_attempts_run_number"),
    )
    op.create_index("idx_test_run_attempts_test_run_id", "test_run_attempts", ["test_run_id"])

    op.create_table(
        "test_run_case_attempts",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("test_run_attempt_id", sa.BigInteger(), nullable=False),
        sa.Column("test_run_case_id", sa.BigInteger(), nullable=False),
        sa.Column("result", sa.String(length=30), nullable=False, server_default="not_run"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("executed_by", sa.BigInteger(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["executed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["test_run_attempt_id"], ["test_run_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["test_run_case_id"], ["test_run_cases.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "test_run_attempt_id",
            "test_run_case_id",
            name="uq_test_run_case_attempts_attempt_case",
        ),
    )
    op.create_index(
        "idx_test_run_case_attempts_attempt_id",
        "test_run_case_attempts",
        ["test_run_attempt_id"],
    )
    op.create_index(
        "idx_test_run_case_attempts_run_case_id",
        "test_run_case_attempts",
        ["test_run_case_id"],
    )

    # Every existing run becomes attempt 1 and retains its original results.
    op.execute(
        """
        INSERT INTO test_run_attempts (
            test_run_id, attempt_number, status, started_at, finished_at,
            created_by, created_at, updated_at
        )
        SELECT
            id,
            1,
            CASE WHEN status = 'archived' THEN 'completed' ELSE status END,
            started_at,
            finished_at,
            created_by,
            created_at,
            updated_at
        FROM test_runs
        """
    )
    op.execute(
        """
        INSERT INTO test_run_case_attempts (
            test_run_attempt_id, test_run_case_id, result, comment,
            executed_by, executed_at, created_at, updated_at
        )
        SELECT
            attempt.id,
            run_case.id,
            run_case.result,
            run_case.comment,
            run_case.executed_by,
            run_case.executed_at,
            run_case.created_at,
            run_case.updated_at
        FROM test_run_cases AS run_case
        JOIN test_run_attempts AS attempt
          ON attempt.test_run_id = run_case.test_run_id
         AND attempt.attempt_number = 1
        """
    )

    op.add_column(
        "test_run_step_results",
        sa.Column("test_run_case_attempt_id", sa.BigInteger(), nullable=True),
    )
    op.execute(
        """
        UPDATE test_run_step_results AS step_result
        SET test_run_case_attempt_id = case_attempt.id
        FROM test_run_case_attempts AS case_attempt
        JOIN test_run_attempts AS attempt
          ON attempt.id = case_attempt.test_run_attempt_id
         AND attempt.attempt_number = 1
        WHERE case_attempt.test_run_case_id = step_result.test_run_case_id
        """
    )
    op.alter_column("test_run_step_results", "test_run_case_attempt_id", nullable=False)
    op.create_foreign_key(
        "fk_step_results_case_attempt",
        "test_run_step_results",
        "test_run_case_attempts",
        ["test_run_case_attempt_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint(
        "uq_test_run_step_results_case_step",
        "test_run_step_results",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_test_run_step_results_attempt_step",
        "test_run_step_results",
        ["test_run_case_attempt_id", "test_step_id"],
    )
    op.create_index(
        "idx_test_run_step_results_case_attempt_id",
        "test_run_step_results",
        ["test_run_case_attempt_id"],
    )


def downgrade() -> None:
    # Only attempt 1 can fit the legacy uniqueness rule.
    op.execute(
        """
        DELETE FROM test_run_step_results
        WHERE test_run_case_attempt_id IN (
            SELECT case_attempt.id
            FROM test_run_case_attempts AS case_attempt
            JOIN test_run_attempts AS attempt ON attempt.id = case_attempt.test_run_attempt_id
            WHERE attempt.attempt_number > 1
        )
        """
    )
    op.drop_index("idx_test_run_step_results_case_attempt_id", table_name="test_run_step_results")
    op.drop_constraint("uq_test_run_step_results_attempt_step", "test_run_step_results", type_="unique")
    op.create_unique_constraint(
        "uq_test_run_step_results_case_step",
        "test_run_step_results",
        ["test_run_case_id", "test_step_id"],
    )
    op.drop_constraint("fk_step_results_case_attempt", "test_run_step_results", type_="foreignkey")
    op.drop_column("test_run_step_results", "test_run_case_attempt_id")
    op.drop_index("idx_test_run_case_attempts_run_case_id", table_name="test_run_case_attempts")
    op.drop_index("idx_test_run_case_attempts_attempt_id", table_name="test_run_case_attempts")
    op.drop_table("test_run_case_attempts")
    op.drop_index("idx_test_run_attempts_test_run_id", table_name="test_run_attempts")
    op.drop_table("test_run_attempts")
