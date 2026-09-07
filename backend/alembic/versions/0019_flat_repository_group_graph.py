"""Flatten test suites and allow suite groups to form a DAG.

Revision ID: 0019_flat_repository
Revises: 0018_remove_audit
Create Date: 2026-08-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0019_flat_repository"
down_revision: str | None = "0018_remove_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _insert_returning_id(connection, table, values: dict) -> int:
    return int(
        connection.execute(
            table.insert().values(**values).returning(table.c.id)
        ).scalar_one()
    )


def upgrade() -> None:
    op.create_table(
        "suite_group_relations",
        sa.Column("parent_group_id", sa.BigInteger(), nullable=False),
        sa.Column("child_group_id", sa.BigInteger(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "parent_group_id <> child_group_id",
            name="ck_suite_group_relations_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["parent_group_id"],
            ["suite_groups.id"],
            name="fk_suite_group_relations_parent_group_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["child_group_id"],
            ["suite_groups.id"],
            name="fk_suite_group_relations_child_group_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("parent_group_id", "child_group_id"),
    )
    op.create_index(
        "idx_suite_group_relations_parent_sort_child",
        "suite_group_relations",
        ["parent_group_id", "sort_order", "child_group_id"],
    )
    op.create_index(
        "idx_suite_group_relations_child_parent",
        "suite_group_relations",
        ["child_group_id", "parent_group_id"],
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO suite_group_relations
                (parent_group_id, child_group_id, sort_order)
            SELECT parent_group_id, id, sort_order
            FROM suite_groups
            WHERE parent_group_id IS NOT NULL
            """
        )
    )

    orphan_count = int(
        connection.execute(
            sa.text("SELECT count(*) FROM test_cases WHERE suite_id IS NULL")
        ).scalar_one()
    )
    if orphan_count:
        creator_id = connection.execute(
            sa.text("SELECT min(created_by) FROM test_cases WHERE suite_id IS NULL")
        ).scalar_one()
        orphan_suite_id = int(
            connection.execute(
                sa.text(
                    """
                    INSERT INTO test_suites
                        (name, description, path, level, sort_order, is_active, created_by)
                    VALUES
                        (:name, :description, :path, 0, 0, true, :creator_id)
                    RETURNING id
                    """
                ),
                {
                    "name": "Migrace – nezařazené test cases",
                    "description": "Technická suita vytvořená migrací pro původně nezařazené test cases.",
                    "path": "/Migrace – nezařazené test cases",
                    "creator_id": creator_id,
                },
            ).scalar_one()
        )
        connection.execute(
            sa.text(
                "UPDATE test_cases SET suite_id = :suite_id WHERE suite_id IS NULL"
            ),
            {"suite_id": orphan_suite_id},
        )

    suite_rows = connection.execute(
        sa.text(
            """
            SELECT id, parent_suite_id, name, sort_order
            FROM test_suites
            ORDER BY level, sort_order, id
            """
        )
    ).mappings().all()
    if suite_rows:
        group_table = sa.table(
            "suite_groups",
            sa.column("id", sa.BigInteger()),
            sa.column("parent_group_id", sa.BigInteger()),
            sa.column("name", sa.String()),
            sa.column("description", sa.Text()),
            sa.column("sort_order", sa.Integer()),
        )
        relation_table = sa.table(
            "suite_group_relations",
            sa.column("parent_group_id", sa.BigInteger()),
            sa.column("child_group_id", sa.BigInteger()),
            sa.column("sort_order", sa.Integer()),
        )
        member_table = sa.table(
            "suite_group_members",
            sa.column("group_id", sa.BigInteger()),
            sa.column("suite_id", sa.BigInteger()),
            sa.column("sort_order", sa.Integer()),
        )

        root_name = "Původní struktura test suit"
        suffix = 2
        while connection.execute(
            sa.text("SELECT 1 FROM suite_groups WHERE lower(name) = lower(:name)"),
            {"name": root_name},
        ).first():
            root_name = f"Původní struktura test suit ({suffix})"
            suffix += 1

        migration_root_id = _insert_returning_id(
            connection,
            group_table,
            {
                "parent_group_id": None,
                "name": root_name,
                "description": "Automaticky převedená původní stromová struktura suit.",
                "sort_order": 0,
            },
        )

        group_by_suite: dict[int, int] = {}
        for row in suite_rows:
            suite_id = int(row["id"])
            group_by_suite[suite_id] = _insert_returning_id(
                connection,
                group_table,
                {
                    "parent_group_id": migration_root_id,
                    "name": f"{row['name']} [suite #{suite_id}]",
                    "description": "Migrační skupina zachovávající původní umístění suity.",
                    "sort_order": int(row["sort_order"]),
                },
            )

        for row in suite_rows:
            suite_id = int(row["id"])
            group_id = group_by_suite[suite_id]
            parent_suite_id = row["parent_suite_id"]
            parent_group_id = (
                group_by_suite[int(parent_suite_id)]
                if parent_suite_id is not None
                else migration_root_id
            )
            connection.execute(
                relation_table.insert().values(
                    parent_group_id=parent_group_id,
                    child_group_id=group_id,
                    sort_order=int(row["sort_order"]),
                )
            )
            connection.execute(
                member_table.insert().values(
                    group_id=group_id,
                    suite_id=suite_id,
                    sort_order=0,
                )
            )

    op.alter_column(
        "test_cases",
        "suite_id",
        existing_type=sa.BigInteger(),
        nullable=False,
    )

    op.drop_constraint(
        "fk_suite_groups_parent_group_id_suite_groups",
        "suite_groups",
        type_="foreignkey",
    )
    op.drop_constraint(
        "uq_suite_groups_parent_name",
        "suite_groups",
        type_="unique",
    )
    op.drop_index("uq_suite_groups_root_name", table_name="suite_groups")
    op.drop_index("idx_suite_groups_parent_group_id", table_name="suite_groups")
    op.drop_column("suite_groups", "parent_group_id")

    op.drop_constraint(
        "test_suites_parent_suite_id_fkey",
        "test_suites",
        type_="foreignkey",
    )
    op.drop_index("idx_test_suites_parent_suite_id", table_name="test_suites")
    op.drop_index("idx_test_suites_path", table_name="test_suites")
    op.drop_column("test_suites", "parent_suite_id")
    op.drop_column("test_suites", "path")
    op.drop_column("test_suites", "level")


def downgrade() -> None:
    op.add_column(
        "test_suites",
        sa.Column("level", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "test_suites",
        sa.Column("path", sa.String(length=1000), server_default="/", nullable=False),
    )
    op.add_column(
        "test_suites",
        sa.Column("parent_suite_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "test_suites_parent_suite_id_fkey",
        "test_suites",
        "test_suites",
        ["parent_suite_id"],
        ["id"],
    )
    op.create_index(
        "idx_test_suites_parent_suite_id",
        "test_suites",
        ["parent_suite_id"],
    )
    op.create_index("idx_test_suites_path", "test_suites", ["path"])
    op.execute("UPDATE test_suites SET path = '/' || name")
    op.alter_column("test_suites", "path", server_default=None)
    op.alter_column("test_suites", "level", server_default=None)

    op.add_column(
        "suite_groups",
        sa.Column("parent_group_id", sa.BigInteger(), nullable=True),
    )
    op.execute(
        """
        UPDATE suite_groups AS child
        SET parent_group_id = (
            SELECT min(parent_group_id)
            FROM suite_group_relations
            WHERE child_group_id = child.id
        )
        """
    )
    op.create_foreign_key(
        "fk_suite_groups_parent_group_id_suite_groups",
        "suite_groups",
        "suite_groups",
        ["parent_group_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_suite_groups_parent_name",
        "suite_groups",
        ["parent_group_id", "name"],
    )
    op.create_index(
        "idx_suite_groups_parent_group_id",
        "suite_groups",
        ["parent_group_id"],
    )
    op.create_index(
        "uq_suite_groups_root_name",
        "suite_groups",
        ["name"],
        unique=True,
        postgresql_where=sa.text("parent_group_id IS NULL"),
    )

    op.alter_column(
        "test_cases",
        "suite_id",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.drop_index(
        "idx_suite_group_relations_child_parent",
        table_name="suite_group_relations",
    )
    op.drop_index(
        "idx_suite_group_relations_parent_sort_child",
        table_name="suite_group_relations",
    )
    op.drop_table("suite_group_relations")
