"""Add execution integrity constraints and workload-backed indexes.

Revision ID: 0020_execution_integrity
Revises: 0019_flat_repository
Create Date: 2026-09-07
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0020_execution_integrity"
down_revision: str | None = "0019_flat_repository"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CHECKS = (
    ("test_cases", "ck_test_cases_status", "status IN ('draft', 'ready', 'deprecated')"),
    ("test_cases", "ck_test_cases_version_positive", "version >= 1"),
    ("test_steps", "ck_test_steps_order_positive", "step_order >= 1"),
    ("test_steps", "ck_test_steps_type", "step_type IN ('test', 'information')"),
    ("test_runs", "ck_test_runs_status", "status IN ('open', 'in_progress', 'completed', 'archived')"),
    (
        "test_runs",
        "ck_test_runs_planned_dates",
        "planned_start IS NULL OR planned_end IS NULL OR planned_end >= planned_start",
    ),
    (
        "test_run_cases",
        "ck_test_run_cases_result",
        "result IN ('not_run', 'passed', 'failed', 'blocked', 'skipped')",
    ),
    ("test_run_cases", "ck_test_run_cases_version_positive", "test_case_version >= 1"),
    ("test_run_attempts", "ck_test_run_attempts_number_positive", "attempt_number >= 1"),
    (
        "test_run_attempts",
        "ck_test_run_attempts_status",
        "status IN ('open', 'in_progress', 'completed', 'archived')",
    ),
    (
        "test_run_case_attempts",
        "ck_test_run_case_attempts_number_positive",
        "attempt_number >= 1",
    ),
    (
        "test_run_case_attempts",
        "ck_test_run_case_attempts_result",
        "result IN ('not_run', 'passed', 'failed', 'blocked', 'skipped')",
    ),
    ("test_run_step_results", "ck_test_run_step_results_order_positive", "step_order >= 1"),
    (
        "test_run_step_results",
        "ck_test_run_step_results_result",
        "result IN ('not_run', 'passed', 'failed', 'skipped')",
    ),
    (
        "requirements",
        "ck_requirements_priority",
        "priority IN ('low', 'medium', 'high', 'critical')",
    ),
    (
        "requirements",
        "ck_requirements_status",
        "status IN ('draft', 'approved', 'deprecated')",
    ),
    (
        "test_case_tags",
        "ck_test_case_tags_category",
        "category IN ('business_area', 'application_domain', 'object_type')",
    ),
    ("test_suites", "ck_test_suites_sort_order_nonnegative", "sort_order >= 0"),
    ("suite_groups", "ck_suite_groups_sort_order_nonnegative", "sort_order >= 0"),
    (
        "suite_group_relations",
        "ck_suite_group_relations_sort_order_nonnegative",
        "sort_order >= 0",
    ),
    (
        "suite_group_members",
        "ck_suite_group_members_sort_order_nonnegative",
        "sort_order >= 0",
    ),
    (
        "suite_group_test_case_members",
        "ck_suite_group_test_case_members_sort_order_nonnegative",
        "sort_order >= 0",
    ),
)


def _assert_clean_data(connection) -> None:
    duplicate_run_case = connection.execute(
        sa.text(
            """
            SELECT test_run_id, test_case_id
            FROM test_run_cases
            GROUP BY test_run_id, test_case_id
            HAVING count(*) > 1
            LIMIT 1
            """
        )
    ).first()
    if duplicate_run_case:
        raise RuntimeError(
            "Nelze přidat uq_test_run_cases_run_case: existují duplicitní test cases v runu."
        )

    duplicate_step_order = connection.execute(
        sa.text(
            """
            SELECT test_case_id, step_order
            FROM test_steps
            GROUP BY test_case_id, step_order
            HAVING count(*) > 1
            LIMIT 1
            """
        )
    ).first()
    if duplicate_step_order:
        raise RuntimeError(
            "Nelze přidat uq_test_steps_case_order: test case obsahuje duplicitní pořadí kroků."
        )

    mismatched_step_result = connection.execute(
        sa.text(
            """
            SELECT step_result.id
            FROM test_run_step_results AS step_result
            JOIN test_run_case_attempts AS case_attempt
              ON case_attempt.id = step_result.test_run_case_attempt_id
            WHERE step_result.test_run_case_id <> case_attempt.test_run_case_id
            LIMIT 1
            """
        )
    ).first()
    if mismatched_step_result:
        raise RuntimeError(
            "Nelze přidat složený FK výsledků kroků: existuje vazba na jiný test run case."
        )

    for table_name, constraint_name, condition in CHECKS:
        invalid_row = connection.execute(
            sa.text(f"SELECT 1 FROM {table_name} WHERE NOT ({condition}) LIMIT 1")
        ).first()
        if invalid_row:
            raise RuntimeError(
                f"Nelze přidat {constraint_name}: tabulka {table_name} obsahuje neplatná data."
            )


def _create_unique_constraints(dialect_name: str) -> None:
    constraints = (
        (
            "test_run_cases",
            "uq_test_run_cases_run_case",
            ["test_run_id", "test_case_id"],
        ),
        (
            "test_steps",
            "uq_test_steps_case_order",
            ["test_case_id", "step_order"],
        ),
        (
            "test_run_case_attempts",
            "uq_test_run_case_attempts_id_run_case",
            ["id", "test_run_case_id"],
        ),
    )
    for table_name, constraint_name, columns in constraints:
        if dialect_name == "sqlite":
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.create_unique_constraint(constraint_name, columns)
        else:
            op.create_unique_constraint(constraint_name, table_name, columns)


def _create_checks(dialect_name: str) -> None:
    if dialect_name == "postgresql":
        for table_name, constraint_name, condition in CHECKS:
            op.create_check_constraint(
                constraint_name,
                table_name,
                condition,
                postgresql_not_valid=True,
            )
        for table_name, constraint_name, _ in CHECKS:
            op.execute(
                f'ALTER TABLE "{table_name}" VALIDATE CONSTRAINT "{constraint_name}"'
            )
    else:
        for table_name, constraint_name, condition in CHECKS:
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.create_check_constraint(constraint_name, condition)


def _create_indexes(dialect_name: str) -> None:
    index_specs = (
        (
            "idx_requirement_test_cases_case_requirement",
            "requirement_test_cases",
            ["test_case_id", "requirement_id"],
            None,
        ),
        (
            "idx_test_run_attempts_last_run_case_id",
            "test_run_attempts",
            ["last_test_run_case_id"],
            None,
        ),
        (
            "idx_test_run_cases_test_case_id",
            "test_run_cases",
            ["test_case_id"],
            None,
        ),
        (
            "idx_test_run_case_attempts_run_case_executed",
            "test_run_case_attempts",
            ["test_run_case_id", "executed_at", "updated_at"],
            sa.text("result <> 'not_run'"),
        ),
        (
            "idx_test_runs_created_id",
            "test_runs",
            ["created_at", "id"],
            None,
        ),
    )
    for name, table_name, columns, predicate in index_specs:
        kwargs = {}
        if predicate is not None and dialect_name == "postgresql":
            kwargs["postgresql_where"] = predicate
        if predicate is not None and dialect_name == "sqlite":
            kwargs["sqlite_where"] = predicate
        op.create_index(name, table_name, columns, **kwargs)


def upgrade() -> None:
    connection = op.get_bind()
    dialect_name = connection.dialect.name
    _assert_clean_data(connection)

    _create_unique_constraints(dialect_name)
    op.drop_index("idx_test_run_cases_test_run_id", table_name="test_run_cases")

    if dialect_name == "sqlite":
        with op.batch_alter_table("test_run_step_results") as batch_op:
            batch_op.drop_constraint(
                "fk_step_results_case_attempt",
                type_="foreignkey",
            )
            batch_op.create_foreign_key(
                "fk_step_results_attempt_run_case",
                "test_run_case_attempts",
                ["test_run_case_attempt_id", "test_run_case_id"],
                ["id", "test_run_case_id"],
                ondelete="CASCADE",
            )
    else:
        op.drop_constraint(
            "fk_step_results_case_attempt",
            "test_run_step_results",
            type_="foreignkey",
        )
        op.create_foreign_key(
            "fk_step_results_attempt_run_case",
            "test_run_step_results",
            "test_run_case_attempts",
            ["test_run_case_attempt_id", "test_run_case_id"],
            ["id", "test_run_case_id"],
            ondelete="CASCADE",
        )

    _create_checks(dialect_name)
    _create_indexes(dialect_name)


def downgrade() -> None:
    connection = op.get_bind()
    dialect_name = connection.dialect.name

    index_names = (
        "idx_test_runs_created_id",
        "idx_test_run_case_attempts_run_case_executed",
        "idx_test_run_cases_test_case_id",
        "idx_test_run_attempts_last_run_case_id",
        "idx_requirement_test_cases_case_requirement",
    )
    for index_name in index_names:
        op.drop_index(index_name)

    for table_name, constraint_name, _ in reversed(CHECKS):
        if dialect_name == "sqlite":
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.drop_constraint(constraint_name, type_="check")
        else:
            op.drop_constraint(constraint_name, table_name, type_="check")

    if dialect_name == "sqlite":
        with op.batch_alter_table("test_run_step_results") as batch_op:
            batch_op.drop_constraint(
                "fk_step_results_attempt_run_case",
                type_="foreignkey",
            )
            batch_op.create_foreign_key(
                "fk_step_results_case_attempt",
                "test_run_case_attempts",
                ["test_run_case_attempt_id"],
                ["id"],
                ondelete="CASCADE",
            )
        with op.batch_alter_table("test_run_case_attempts") as batch_op:
            batch_op.drop_constraint(
                "uq_test_run_case_attempts_id_run_case",
                type_="unique",
            )
    else:
        op.drop_constraint(
            "fk_step_results_attempt_run_case",
            "test_run_step_results",
            type_="foreignkey",
        )
        op.create_foreign_key(
            "fk_step_results_case_attempt",
            "test_run_step_results",
            "test_run_case_attempts",
            ["test_run_case_attempt_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.drop_constraint(
            "uq_test_run_case_attempts_id_run_case",
            "test_run_case_attempts",
            type_="unique",
        )

    if dialect_name == "sqlite":
        with op.batch_alter_table("test_steps") as batch_op:
            batch_op.drop_constraint("uq_test_steps_case_order", type_="unique")
        with op.batch_alter_table("test_run_cases") as batch_op:
            batch_op.drop_constraint("uq_test_run_cases_run_case", type_="unique")
    else:
        op.drop_constraint(
            "uq_test_steps_case_order",
            "test_steps",
            type_="unique",
        )
        op.drop_constraint(
            "uq_test_run_cases_run_case",
            "test_run_cases",
            type_="unique",
        )

    op.create_index(
        "idx_test_run_cases_test_run_id",
        "test_run_cases",
        ["test_run_id"],
    )
