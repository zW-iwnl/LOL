"""Remove Requirements and their case links. Back up data before upgrading.

Downgrade restores the empty schema only; deleted data requires a backup.
"""
from alembic import op
import sqlalchemy as sa

revision = "0024_remove_requirements"
down_revision = "0023_test_run_task_number"
branch_labels = depends_on = None


def upgrade():
    # No CASCADE: unexpected incoming dependencies must stop this migration.
    op.drop_table("requirement_test_cases")
    op.drop_table("requirements")


def downgrade():
    op.create_table("requirements",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("priority", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_by", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_requirements_code"),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high', 'critical')", name="ck_requirements_priority"),
        sa.CheckConstraint("status IN ('draft', 'approved', 'deprecated')", name="ck_requirements_status"))
    op.create_table("requirement_test_cases",
        sa.Column("requirement_id", sa.BigInteger(), sa.ForeignKey("requirements.id"), primary_key=True),
        sa.Column("test_case_id", sa.BigInteger(), sa.ForeignKey("test_cases.id"), primary_key=True))
    op.create_index("idx_requirement_test_cases_case_requirement", "requirement_test_cases", ["test_case_id", "requirement_id"])
