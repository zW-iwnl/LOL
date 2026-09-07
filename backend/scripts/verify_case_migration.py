"""Rehearse 0022 only in an explicitly named, separately restored database."""
import argparse
import hashlib
import json
import os
import subprocess

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core.config import settings


def digest(rows):
    return hashlib.sha256(json.dumps([dict(r) for r in rows], sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    original = make_url(settings.database_url)
    if not args.database.startswith("approval_verify_") or args.database == original.database:
        raise SystemExit("Refusing migration rehearsal outside an isolated approval_verify_ database.")
    url = original.set(database=args.database)
    engine = create_engine(url)
    checks = {}
    tables = ("test_run_cases", "test_run_attempts", "test_run_case_attempts", "test_run_step_results", "suite_group_relations", "suite_group_members", "suite_group_test_case_members")
    with engine.connect() as connection:
        for table in tables:
            columns = [c["name"] for c in inspect(connection).get_columns(table)]
            selected = ",".join(f'"{c}"' for c in columns)
            ordering = ",".join(f'"{c}"' for c in inspect(connection).get_pk_constraint(table)["constrained_columns"])
            rows = connection.execute(text(f'SELECT {selected} FROM "{table}" ORDER BY {ordering}')).mappings().all()
            checks[table] = {"columns": selected, "ordering": ordering, "count": len(rows), "hash": digest(rows),
                             "ids": [r["id"] for r in rows] if "id" in columns else None}
    env = {**os.environ, "DATABASE_URL": url.render_as_string(hide_password=False)}
    subprocess.run(["alembic", "upgrade", "head"], env=env, check=True)
    with engine.connect() as connection:
        for table, check in checks.items():
            selected = check["columns"]
            ordering = check["ordering"]
            rows = connection.execute(text(f'SELECT {selected} FROM "{table}" ORDER BY {ordering}')).mappings().all()
            if table in ("test_run_attempts", "test_run_case_attempts"):
                # Missing legacy attempts may be added, existing evidence must not change.
                rows = [r for r in rows if r["id"] in check["ids"]]
            assert len(rows) == check["count"] and digest(rows) == check["hash"], f"Historical data changed: {table}"
        mismatches = connection.scalar(text("""SELECT count(*) FROM test_run_case_attempts a JOIN test_run_cases c ON c.id=a.test_run_case_id
            WHERE a.execution_snapshot::jsonb IS DISTINCT FROM c.test_case_snapshot::jsonb
            OR a.version_number IS DISTINCT FROM c.test_case_version"""))
        assert mismatches == 0, "Attempt snapshot copy mismatch"
        ready_missing = connection.scalar(text("SELECT count(*) FROM test_cases WHERE status='ready' AND current_approved_version_id IS NULL"))
        assert ready_missing == 0, "Ready case lost its publication"
        print(json.dumps({"database": args.database, "history_unchanged": True,
                          "tables": {t: {"count": c["count"], "sha256": c["hash"]} for t, c in checks.items()},
                          "attempt_snapshot_mismatches": mismatches, "ready_without_publication": ready_missing}, indent=2))


if __name__ == "__main__":
    main()
