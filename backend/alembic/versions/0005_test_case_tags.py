"""Add managed test case tags.

Revision ID: 0005_test_case_tags
Revises: 0004_audit_snapshots
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005_test_case_tags"
down_revision: str | None = "0004_audit_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "test_case_tags",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("category", "name", name="uq_test_case_tags_category_name"),
    )
    op.create_index("idx_test_case_tags_category", "test_case_tags", ["category"])

    tag_table = sa.table(
        "test_case_tags",
        sa.column("category", sa.String()),
        sa.column("name", sa.String()),
    )
    op.bulk_insert(
        tag_table,
        [
            {"category": "business_area", "name": "Karty"},
            {"category": "business_area", "name": "Úvěry"},
            {"category": "business_area", "name": "Obchod"},
            {"category": "application_domain", "name": "IB"},
            {"category": "application_domain", "name": "Aron"},
            {"category": "object_type", "name": "Formulář"},
            {"category": "object_type", "name": "Pročka"},
            {"category": "object_type", "name": "Stránka"},
        ],
    )

    for column_name in ("business_area_id", "application_domain_id", "object_type_id"):
        op.add_column("test_cases", sa.Column(column_name, sa.BigInteger(), nullable=True))
        op.create_foreign_key(
            f"fk_test_cases_{column_name}_test_case_tags",
            "test_cases",
            "test_case_tags",
            [column_name],
            ["id"],
        )
        op.create_index(f"idx_test_cases_{column_name}", "test_cases", [column_name])


def downgrade() -> None:
    for column_name in ("object_type_id", "application_domain_id", "business_area_id"):
        op.drop_index(f"idx_test_cases_{column_name}", table_name="test_cases")
        op.drop_constraint(f"fk_test_cases_{column_name}_test_case_tags", "test_cases", type_="foreignkey")
        op.drop_column("test_cases", column_name)
    op.drop_index("idx_test_case_tags_category", table_name="test_case_tags")
    op.drop_table("test_case_tags")
