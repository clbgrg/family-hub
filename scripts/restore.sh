#!/bin/sh
# Restore a Family Hub backup. Run on the host, from the project directory.
#
# ⚠️ Prod (the Pi): this script runs `docker compose exec`, which reads the
# DEFAULT compose file (docker-compose.yml — the dev stack), not the prod one.
# Export COMPOSE_FILE so every step (and this script) targets the prod stack:
#
#   export COMPOSE_FILE=docker-compose.prod.yml   # prod only; skip for dev
#   # 1. stop the app so nothing writes mid-restore:
#   docker compose stop app
#   # 2. restore a dump (DROPs and recreates all data):
#   scripts/restore.sh backups/family-hub-YYYYMMDD-HHMMSS.sql.gz
#   # 3. bring the app back:
#   docker compose up -d
#
# The app applies `prisma migrate deploy` on start, so the schema is reconciled
# automatically after a restore.
set -eu

file="${1:?usage: scripts/restore.sh <backup.sql.gz>   (stop the app first)}"
[ -f "$file" ] || {
  echo "No such file: $file" >&2
  exit 1
}

echo "Restoring $file — this overwrites ALL current data."
gunzip -c "$file" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U skylite -d skylite

echo "Restore complete. Start the app:  docker compose up -d"
