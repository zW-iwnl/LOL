#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  echo "Create it from .env.production.example and set production secrets." >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "Docker is not installed or is not available in PATH." >&2
  exit 1
}

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "Validating Docker Compose configuration..."
"${compose[@]}" config --quiet

if [[ "${BACKUP_BEFORE_DEPLOY:-true}" == "true" ]] && \
  "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "Creating a pre-deployment database backup..."
  ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup.sh"
fi

echo "Building production images..."
"${compose[@]}" build --pull

echo "Starting production services..."
"${compose[@]}" up --detach --remove-orphans --wait

echo "Verifying the application health through the frontend proxy..."
"${compose[@]}" exec -T frontend wget --quiet --spider http://127.0.0.1/health

"${compose[@]}" ps
echo "Deployment completed successfully."
