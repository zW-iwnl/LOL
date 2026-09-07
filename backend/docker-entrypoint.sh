#!/bin/sh
set -e

export PYTHONPATH=/app

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  migration_attempt=1
  migration_max_attempts="${MIGRATION_MAX_ATTEMPTS:-30}"
  until alembic upgrade head; do
    if [ "$migration_attempt" -ge "$migration_max_attempts" ]; then
      echo "Database migration failed after $migration_attempt attempts." >&2
      exit 1
    fi
    echo "Database is not ready yet, retrying migration ($migration_attempt/$migration_max_attempts)..."
    migration_attempt=$((migration_attempt + 1))
    sleep 2
  done
fi

if [ "$SEED_DEMO_DATA" = "true" ]; then
  python scripts/seed_demo.py
fi

if [ "$APP_ENV" = "production" ]; then
  # Bind explicitly to the dual-stack IPv6 wildcard. Railway private
  # networking may be IPv6-only; this socket also accepts IPv4.
  exec uvicorn app.main:app --host "::" --port "${PORT:-8000}" --workers "${UVICORN_WORKERS:-2}"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
