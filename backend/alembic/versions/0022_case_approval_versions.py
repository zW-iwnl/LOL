"""Immutable case versions, independent reviews and per-attempt snapshots.

Run during a maintenance window after a database backup. Legacy execution
snapshots are copied verbatim, never reconstructed from today's definition.
"""
import hashlib
import json
import logging
from uuid import NAMESPACE_URL, uuid5

from alembic import op
import sqlalchemy as sa

revision = "0022_case_approval_versions"
down_revision = "0021_group_relation_scope"
branch_labels = depends_on = None


def ident():
    return sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True)


def timestamps():
    return [sa.Column(n, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()) for n in ("created_at", "updated_at")]


def fk(name, target, nullable=True):
    return sa.Column(name, sa.BigInteger(), sa.ForeignKey(target, ondelete="RESTRICT"), nullable=nullable)


def upgrade():
    op.create_table("test_case_drafts", ident(), fk("test_case_id", "test_cases.id", False),
        sa.Column("base_version_id", sa.BigInteger()), sa.Column("base_approved_version_id", sa.BigInteger()),
        sa.Column("content", sa.JSON(), nullable=False), sa.Column("lock_version", sa.Integer(), nullable=False, server_default="1"),
        fk("editor_id", "users.id", False), fk("created_by", "users.id", False),
        sa.Column("contributors", sa.JSON(), nullable=False), sa.Column("change_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        fk("origin_run_id", "test_runs.id"), fk("origin_run_attempt_id", "test_run_attempts.id"), fk("origin_case_attempt_id", "test_run_case_attempts.id"),
        sa.Column("last_frozen_version_id", sa.BigInteger()), *timestamps(),
        sa.CheckConstraint("status IN ('open','submitted','closed')", name="ck_case_draft_status"))
    op.create_index("uq_case_open_draft", "test_case_drafts", ["test_case_id"], unique=True, postgresql_where=sa.text("status IN ('open','submitted')"))
    op.create_table("test_case_versions", ident(), fk("test_case_id", "test_cases.id", False),
        sa.Column("version_number", sa.Integer(), nullable=False), fk("source_draft_id", "test_case_drafts.id"),
        fk("base_version_id", "test_case_versions.id"), sa.Column("content_snapshot", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False), sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        fk("created_by", "users.id", False), sa.Column("change_summary", sa.Text(), nullable=False, server_default=""),
        fk("origin_run_id", "test_runs.id"), sa.Column("approval_basis", sa.String(30)), *timestamps(),
        sa.UniqueConstraint("test_case_id", "version_number", name="uq_case_version_number"))
    op.create_foreign_key("fk_draft_base_version", "test_case_drafts", "test_case_versions", ["base_version_id"], ["id"])
    op.create_table("test_case_reviews", ident(), fk("test_case_id", "test_cases.id", False),
        fk("test_case_version_id", "test_case_versions.id", False), sa.Column("base_approved_version_id", sa.BigInteger()),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"), fk("submitted_by", "users.id", False),
        fk("reviewer_id", "users.id"), fk("decided_by", "users.id"), sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("decision_reason", sa.Text()), fk("supersedes_review_id", "test_case_reviews.id"),
        sa.Column("lock_version", sa.Integer(), nullable=False, server_default="1"), *timestamps(),
        sa.CheckConstraint("status IN ('pending','approved','changes_requested','rejected','withdrawn')", name="ck_case_review_status"))
    op.create_index("uq_case_pending_review", "test_case_reviews", ["test_case_id"], unique=True, postgresql_where=sa.text("status = 'pending'"))
    op.create_index("idx_case_review_queue", "test_case_reviews", ["status", "reviewer_id", "created_at"])
    op.create_table("test_case_review_comments", ident(), fk("review_id", "test_case_reviews.id", False), fk("author_id", "users.id", False),
        sa.Column("body", sa.Text(), nullable=False), sa.Column("field_path", sa.String(255)),
        sa.Column("is_blocking", sa.Boolean(), nullable=False, server_default=sa.false()), fk("resolved_by", "users.id"),
        sa.Column("resolved_at", sa.DateTime(timezone=True)), *timestamps())
    op.create_index("ix_test_case_review_comments_review_id", "test_case_review_comments", ["review_id"])
    op.create_table("test_case_events", ident(), fk("test_case_id", "test_cases.id", False), fk("actor_id", "users.id", False),
        sa.Column("event_type", sa.String(50), nullable=False), sa.Column("payload", sa.JSON(), nullable=False), *timestamps())
    op.create_index("ix_test_case_events_test_case_id", "test_case_events", ["test_case_id"])
    op.create_table("test_case_operations", ident(), fk("actor_id", "users.id", False),
        sa.Column("key", sa.String(100), nullable=False), sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response", sa.JSON()), *timestamps(), sa.UniqueConstraint("actor_id", "key", name="uq_case_operation_actor_key"))
    op.create_table("test_case_version_tags",
        sa.Column("version_id", sa.BigInteger(), sa.ForeignKey("test_case_versions.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("tag_id", sa.BigInteger(), sa.ForeignKey("test_case_tags.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("category", sa.String(40), nullable=False), sa.Column("name_snapshot", sa.String(255), nullable=False))
    op.create_index("ix_test_case_version_tags_category", "test_case_version_tags", ["category"])
    op.add_column("test_cases", sa.Column("current_approved_version_id", sa.BigInteger()))
    op.create_foreign_key("fk_case_published_version", "test_cases", "test_case_versions", ["current_approved_version_id"], ["id"])
    op.add_column("test_cases", sa.Column("next_version_number", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("test_cases", sa.Column("origin_run_id", sa.BigInteger(), sa.ForeignKey("test_runs.id")))
    for column in [sa.Column("test_case_version_id", sa.BigInteger(), sa.ForeignKey("test_case_versions.id", ondelete="RESTRICT")),
                   sa.Column("execution_snapshot", sa.JSON()), sa.Column("version_number", sa.Integer()),
                   sa.Column("approval_state_at_binding", sa.String(40), nullable=False, server_default="unknown"),
                   sa.Column("approval_state_at_start", sa.String(40)), sa.Column("started_at", sa.DateTime(timezone=True)),
                   sa.Column("closed_at", sa.DateTime(timezone=True)), sa.Column("closure_reason", sa.String(40))]:
        op.add_column("test_run_case_attempts", column)
    backfill(op.get_bind())
    op.execute("""CREATE FUNCTION protect_case_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.content_snapshot::jsonb IS DISTINCT FROM OLD.content_snapshot::jsonb
        OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.version_number <> OLD.version_number
        OR NEW.test_case_id <> OLD.test_case_id OR NEW.source_draft_id IS DISTINCT FROM OLD.source_draft_id
        OR NEW.origin_run_id IS DISTINCT FROM OLD.origin_run_id OR NEW.created_by <> OLD.created_by
      THEN RAISE EXCEPTION 'Test case version content is immutable'; END IF;
      RETURN NEW;
    END $$""")
    op.execute("CREATE TRIGGER immutable_case_version BEFORE UPDATE ON test_case_versions FOR EACH ROW EXECUTE FUNCTION protect_case_version()")
    op.execute("""CREATE FUNCTION validate_published_case_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.current_approved_version_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM test_case_versions v WHERE v.id=NEW.current_approved_version_id
        AND v.test_case_id=NEW.id AND v.approval_basis IN ('review','legacy_import'))
      THEN RAISE EXCEPTION 'Invalid published version'; END IF;
      RETURN NEW;
    END $$""")
    op.execute("CREATE CONSTRAINT TRIGGER valid_published_case_version AFTER INSERT OR UPDATE ON test_cases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_published_case_version()")


def backfill(bind):
    metadata = sa.MetaData()
    names = ["test_cases", "test_steps", "test_suites", "test_case_tags", "test_case_tag_assignments", "test_case_drafts", "test_case_versions", "test_case_version_tags", "test_run_cases"]
    tables = {name: sa.Table(name, metadata, autoload_with=bind) for name in names}
    cases, steps, suites = (tables[n] for n in names[:3])
    counts = {"ready_imported": 0, "drafts": 0, "archived": 0}
    # Old direct seed/import paths could bypass the run service even after 0010.
    # Preserve recorded results and timestamps, marking the imported attempt.
    legacy_run_ids = list(bind.scalars(sa.text("SELECT id FROM test_runs r WHERE NOT EXISTS (SELECT 1 FROM test_run_attempts a WHERE a.test_run_id=r.id)")))
    counts["legacy_runs_without_attempts"] = len(legacy_run_ids)
    bind.execute(sa.text("""INSERT INTO test_run_attempts
        (test_run_id,attempt_number,status,started_at,finished_at,created_by,created_at,updated_at)
        SELECT r.id,1,r.status,r.started_at,r.finished_at,r.created_by,r.created_at,r.updated_at
        FROM test_runs r WHERE NOT EXISTS (SELECT 1 FROM test_run_attempts a WHERE a.test_run_id=r.id)"""))
    if legacy_run_ids:
        bind.execute(sa.text("""INSERT INTO test_run_case_attempts
        (test_run_attempt_id,test_run_case_id,attempt_number,result,comment,executed_by,executed_at,created_at,updated_at,closure_reason)
        SELECT a.id,c.id,1,c.result,c.comment,c.executed_by,c.executed_at,c.created_at,c.updated_at,'legacy_import'
        FROM test_run_cases c JOIN test_run_attempts a ON a.test_run_id=c.test_run_id AND a.attempt_number=1
        WHERE c.test_run_id IN :run_ids AND NOT EXISTS (SELECT 1 FROM test_run_case_attempts ca WHERE ca.test_run_case_id=c.id)""")
        .bindparams(sa.bindparam("run_ids", expanding=True)), {"run_ids": legacy_run_ids})
    for case in bind.execute(sa.select(cases).order_by(cases.c.id)).mappings():
        content = {f: case[f] for f in ("title", "description", "preconditions", "expected_summary", "automated")}
        tags = [dict(t) for t in bind.execute(sa.text("SELECT t.id,t.name,t.category FROM test_case_tags t JOIN test_case_tag_assignments a ON a.tag_id=t.id WHERE a.test_case_id=:id ORDER BY t.id"), {"id": case["id"]}).mappings()]
        content["tag_ids"] = [t["id"] for t in tags]
        content["steps"] = [{**{f: s[f] for f in ("step_order", "action", "step_type", "note", "expected_result", "test_data")},
                              "step_key": str(uuid5(NAMESPACE_URL, f"test-manager/case/{case['id']}/step/{s['id']}")), "id": s["id"]}
                             for s in bind.execute(sa.select(steps).where(steps.c.test_case_id == case["id"]).order_by(steps.c.step_order)).mappings()]
        legacy_max = bind.scalar(sa.select(sa.func.max(tables["test_run_cases"].c.test_case_version)).where(tables["test_run_cases"].c.test_case_id == case["id"])) or 0
        bind.execute(cases.update().where(cases.c.id == case["id"]).values(next_version_number=max(case["version"], legacy_max) + 1))
        if case["status"] == "draft":
            bind.execute(tables["test_case_drafts"].insert().values(test_case_id=case["id"], content=content, editor_id=case["created_by"], created_by=case["created_by"], contributors=[case["created_by"]]))
            counts["drafts"] += 1
        else:
            content.update(id=case["id"], code=case["code"], suite_id=case["suite_id"], tags=tags, schema_version=1,
                           suite_name=bind.scalar(sa.select(suites.c.name).where(suites.c.id == case["suite_id"])))
            for category, key in (("business_area", "business_areas"), ("application_domain", "application_domains"), ("object_type", "object_types")):
                content[key] = [{"id": t["id"], "name": t["name"]} for t in tags if t["category"] == category]
                content[category] = content[key][0] if content[key] else None
            digest = hashlib.sha256(json.dumps(content, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
            version_id = bind.scalar(tables["test_case_versions"].insert().values(test_case_id=case["id"], version_number=case["version"], content_snapshot=content,
                content_hash=digest, created_by=case["created_by"], approval_basis="legacy_import" if case["status"] == "ready" else None).returning(tables["test_case_versions"].c.id))
            for tag in tags:
                bind.execute(tables["test_case_version_tags"].insert().values(version_id=version_id, tag_id=tag["id"], category=tag["category"], name_snapshot=tag["name"]))
            if case["status"] == "ready":
                bind.execute(cases.update().where(cases.c.id == case["id"]).values(current_approved_version_id=version_id))
                counts["ready_imported"] += 1
            else:
                counts["archived"] += 1
    bind.execute(sa.text("""UPDATE test_run_case_attempts a SET execution_snapshot=c.test_case_snapshot,
        version_number=c.test_case_version, approval_state_at_start='unknown',
        approval_state_at_binding=CASE WHEN c.test_case_snapshot IS NULL OR c.test_case_snapshot::jsonb='null'::jsonb THEN 'legacy_snapshot_missing' ELSE 'unknown' END
        FROM test_run_cases c WHERE a.test_run_case_id=c.id"""))
    counts["missing_snapshots"] = bind.scalar(sa.text("SELECT count(*) FROM test_run_case_attempts WHERE approval_state_at_binding='legacy_snapshot_missing'"))
    counts["legacy_version_collisions"] = bind.scalar(sa.text("SELECT count(*) FROM (SELECT test_case_id,test_case_version FROM test_run_cases GROUP BY test_case_id,test_case_version HAVING count(DISTINCT test_case_snapshot::jsonb)>1) c"))
    logging.getLogger("alembic.runtime.migration").info("Case approval migration report: %s", counts)


def downgrade():
    raise RuntimeError("Verze a rozhodnutí nelze bezeztrátově převést zpět. Použijte forward fix nebo ověřenou zálohu.")
