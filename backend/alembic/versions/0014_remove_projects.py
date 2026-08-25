"""Remove projects and make repository data global.

Revision ID: 0014_remove_projects
Revises: 0013_remove_test_case_type
Create Date: 2026-08-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0014_remove_projects"
down_revision: str | None = "0013_remove_test_case_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PROJECT_TABLES = ("test_suites", "test_cases", "test_runs")


def _make_requirement_codes_global() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, code FROM requirements ORDER BY id")).mappings()
    used: set[str] = set()
    for row in rows:
        code = row["code"]
        if code not in used:
            used.add(code)
            continue

        suffix = f"-{row['id']}"
        candidate = f"{code[: 50 - len(suffix)]}{suffix}"
        counter = 2
        while candidate in used:
            suffix = f"-{row['id']}-{counter}"
            candidate = f"{code[: 50 - len(suffix)]}{suffix}"
            counter += 1
        connection.execute(
            sa.text("UPDATE requirements SET code = :code WHERE id = :id"),
            {"code": candidate, "id": row["id"]},
        )
        used.add(candidate)


def upgrade() -> None:
    _make_requirement_codes_global()

    for table_name in PROJECT_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_index(f"idx_{table_name}_project_id")
            batch_op.drop_column("project_id")

    with op.batch_alter_table("requirements") as batch_op:
        batch_op.drop_constraint("uq_requirements_project_code", type_="unique")
        batch_op.drop_index("idx_requirements_project_id")
        batch_op.drop_column("project_id")
        batch_op.create_unique_constraint("uq_requirements_code", ["code"])

    op.drop_table("projects")


def downgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.UniqueConstraint("code"),
    )

    connection = op.get_bind()
    user_id = connection.execute(sa.text("SELECT MIN(id) FROM users")).scalar()
    if user_id is None:
        raise RuntimeError("Projektovou strukturu nelze obnovit bez existujícího uživatele.")
    if connection.dialect.name == "sqlite":
        project_id = 1
        connection.execute(
            sa.text(
                """
                INSERT INTO projects (id, name, code, description, status, created_by)
                VALUES (:id, 'Repository', 'REPO', 'Obnovený projekt pro globální repository.', 'active', :user_id)
                """
            ),
            {"id": project_id, "user_id": user_id},
        )
    else:
        project_id = connection.execute(
            sa.text(
                """
                INSERT INTO projects (name, code, description, status, created_by)
                VALUES ('Repository', 'REPO', 'Obnovený projekt pro globální repository.', 'active', :user_id)
                RETURNING id
                """
            ),
            {"user_id": user_id},
        ).scalar_one()

    for table_name in PROJECT_TABLES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(
                sa.Column("project_id", sa.BigInteger(), nullable=False, server_default=str(project_id))
            )
            batch_op.create_foreign_key(
                f"fk_{table_name}_project_id_projects",
                "projects",
                ["project_id"],
                ["id"],
            )
            batch_op.create_index(f"idx_{table_name}_project_id", ["project_id"])
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column("project_id", server_default=None)

    with op.batch_alter_table("requirements") as batch_op:
        batch_op.drop_constraint("uq_requirements_code", type_="unique")
        batch_op.add_column(
            sa.Column("project_id", sa.BigInteger(), nullable=False, server_default=str(project_id))
        )
        batch_op.create_foreign_key(
            "fk_requirements_project_id_projects",
            "projects",
            ["project_id"],
            ["id"],
        )
        batch_op.create_index("idx_requirements_project_id", ["project_id"])
        batch_op.create_unique_constraint(
            "uq_requirements_project_code",
            ["project_id", "code"],
        )


    with op.batch_alter_table("requirements") as batch_op:
        batch_op.alter_column("project_id", server_default=None)
