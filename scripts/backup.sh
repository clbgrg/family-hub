#!/bin/sh
# Scheduled Postgres backups for Family Hub. Runs as a sidecar container: dumps
# the database to a gzipped file in /backups on start and then every
# BACKUP_INTERVAL_SECONDS, keeping the newest BACKUP_KEEP. Connection details
# come from the standard PG* environment variables.
set -u

: "${BACKUP_INTERVAL_SECONDS:=86400}" # daily
: "${BACKUP_KEEP:=7}"
DIR=/backups
mkdir -p "$DIR"

backup_once() {
  ts=$(date +%Y%m%d-%H%M%S)
  tmp="$DIR/.family-hub-$ts.sql.gz.tmp"
  out="$DIR/family-hub-$ts.sql.gz"

  # --clean --if-exists makes the dump self-contained: restoring it drops and
  # recreates everything, so a restore overwrites whatever's currently there.
  if pg_dump --clean --if-exists --no-owner --no-privileges | gzip >"$tmp"; then
    mv "$tmp" "$out"
    echo "[backup] wrote $out ($(du -h "$out" | cut -f1))"
  else
    echo "[backup] dump FAILED" >&2
    rm -f "$tmp"
    return 1
  fi

  # Prune oldest beyond BACKUP_KEEP.
  count=$(ls -1 "$DIR"/family-hub-*.sql.gz 2>/dev/null | wc -l)
  if [ "$count" -gt "$BACKUP_KEEP" ]; then
    ls -1t "$DIR"/family-hub-*.sql.gz | tail -n +$((BACKUP_KEEP + 1)) | while read -r old; do
      rm -f "$old" && echo "[backup] pruned $old"
    done
  fi
}

echo "[backup] starting (interval=${BACKUP_INTERVAL_SECONDS}s, keep=${BACKUP_KEEP})"
while true; do
  backup_once || true
  sleep "$BACKUP_INTERVAL_SECONDS"
done
