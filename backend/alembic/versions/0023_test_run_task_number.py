"""Add an optional external task number to test runs."""
from alembic import op
import sqlalchemy as sa

revision = "0023_test_run_task_number"
down_revision = "0022_case_approval_versions"
branch_labels = depends_on = None


def upgrade():
    op.add_column("test_runs", sa.Column("task_number", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("test_runs", "task_number")
