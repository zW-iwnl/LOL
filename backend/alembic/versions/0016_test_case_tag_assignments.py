"""Allow multiple tags from each category on a test case.

Revision ID: 0016_tag_assignments
Revises: 0015_suite_groups
Create Date: 2026-08-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0016_tag_assignments"
down_revision: str | None = "0015_suite_groups"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


LEGACY_COLUMNS = (
    ("business_area_id", "business_area"),
    ("application_domain_id", "application_domain"),
    ("object_type_id", "object_type"),
)


def upgrade() -> None:
    op.create_table(
        "test_case_tag_assignments",
        sa.Column("test_case_id", sa.BigInteger(), nullable=False),
        sa.Column("tag_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["test_case_id"],
            ["test_cases.id"],
            name="fk_test_case_tag_assignments_test_case_id_test_cases",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["test_case_tags.id"],
            name="fk_test_case_tag_assignments_tag_id_test_case_tags",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("test_case_id", "tag_id"),
    )
    op.create_index(
        "idx_test_case_tag_assignments_tag_id",
        "test_case_tag_assignments",
        ["tag_id", "test_case_id"],
    )

    connection = op.get_bind()
    for column_name, _category in LEGACY_COLUMNS:
        connection.execute(
            sa.text(
                f"""
                INSERT INTO test_case_tag_assignments (test_case_id, tag_id)
                SELECT id, {column_name}
                FROM test_cases
                WHERE {column_name} IS NOT NULL
                """
            )
        )

    with op.batch_alter_table("test_cases") as batch_op:
        for column_name, _category in reversed(LEGACY_COLUMNS):
            batch_op.drop_index(f"idx_test_cases_{column_name}")
            batch_op.drop_constraint(
                f"fk_test_cases_{column_name}_test_case_tags",
                type_="foreignkey",
            )
            batch_op.drop_column(column_name)


def downgrade() -> None:
    with op.batch_alter_table("test_cases") as batch_op:
        for column_name, _category in LEGACY_COLUMNS:
            batch_op.add_column(sa.Column(column_name, sa.BigInteger(), nullable=True))
            batch_op.create_foreign_key(
                f"fk_test_cases_{column_name}_test_case_tags",
                "test_case_tags",
                [column_name],
                ["id"],
            )
            batch_op.create_index(f"idx_test_cases_{column_name}", [column_name])

    connection = op.get_bind()
    for column_name, category in LEGACY_COLUMNS:
        connection.execute(
            sa.text(
                f"""
                UPDATE test_cases
                SET {column_name} = (
                    SELECT MIN(assignments.tag_id)
                    FROM test_case_tag_assignments AS assignments
                    JOIN test_case_tags AS tags ON tags.id = assignments.tag_id
                    WHERE assignments.test_case_id = test_cases.id
                      AND tags.category = :category
                )
                """
            ),
            {"category": category},
        )

    op.drop_index(
        "idx_test_case_tag_assignments_tag_id",
        table_name="test_case_tag_assignments",
    )
    op.drop_table("test_case_tag_assignments")
