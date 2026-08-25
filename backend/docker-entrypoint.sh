#!/bin/sh
set -e

export PYTHONPATH=/app

until alembic upgrade head; do
  echo "Database is not ready yet, retrying migrations..."
  sleep 2
done

if [ "$SEED_DEMO_DATA" = "true" ]; then
  python scripts/seed_demo.py
fi

if [ "$APP_ENV" = "production" ]; then
  # Bind explicitly to the dual-stack IPv6 wildcard. Railway private
  # networking may be IPv6-only; this socket also accepts IPv4.
  exec uvicorn app.main:app --host "::" --port "${PORT:-8000}" --workers "${UVICORN_WORKERS:-2}"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
