"""Allow individual test cases to have rerun history.

Revision ID: 0011_case_attempt_numbers
Revises: 0010_test_run_attempts
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0011_case_attempt_numbers"
down_revision: str | None = "0010_test_run_attempts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "test_run_case_attempts",
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.drop_constraint(
        "uq_test_run_case_attempts_attempt_case",
        "test_run_case_attempts",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_test_run_case_attempts_attempt_case_number",
        "test_run_case_attempts",
        ["test_run_attempt_id", "test_run_case_id", "attempt_number"],
    )


def downgrade() -> None:
    # Keep the newest case attempt so the legacy uniqueness rule can be restored.
    op.execute(
        """
        DELETE FROM test_run_case_attempts AS older
        USING test_run_case_attempts AS newer
        WHERE older.test_run_attempt_id = newer.test_run_attempt_id
          AND older.test_run_case_id = newer.test_run_case_id
          AND older.attempt_number < newer.attempt_number
        """
    )
    op.drop_constraint(
        "uq_test_run_case_attempts_attempt_case_number",
        "test_run_case_attempts",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_test_run_case_attempts_attempt_case",
        "test_run_case_attempts",
        ["test_run_attempt_id", "test_run_case_id"],
    )
    op.drop_column("test_run_case_attempts", "attempt_number")
