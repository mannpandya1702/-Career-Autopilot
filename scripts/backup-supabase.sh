#!/usr/bin/env bash
# Nightly Supabase pg_dump backup.
# Per docs/build-phases.md P11.4: nightly Supabase DB dump to Oracle VM
# via pg_dump cron, keep 14 days.
#
# Triggered by .github/workflows/backup.yml on a UTC cron, OR by a
# systemd timer on the VM (if you don't want CI in the loop).
#
# Required env:
#   SUPABASE_DB_URL  postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
#   BACKUP_DIR       defaults to /var/backups/career-autopilot
#   RETENTION_DAYS   defaults to 14

set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[backup] SUPABASE_DB_URL not set" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/career-autopilot}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y-%m-%dT%H%M%SZ)"
out="$BACKUP_DIR/career-autopilot-${ts}.sql.gz"

echo "[backup] dumping → $out"
pg_dump \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --schema=public \
  --schema=auth \
  "$SUPABASE_DB_URL" \
  | gzip -9 > "$out"

# Verify the dump is non-empty + parseable.
if [[ ! -s "$out" ]]; then
  echo "[backup] $out is empty — failing"
  rm -f "$out"
  exit 2
fi
zcat "$out" | head -1 | grep -q "PostgreSQL database dump" \
  || { echo "[backup] $out missing PG header — failing"; rm -f "$out"; exit 3; }

size="$(du -h "$out" | cut -f1)"
echo "[backup] ok: $size"

# Prune older than RETENTION_DAYS.
find "$BACKUP_DIR" -name 'career-autopilot-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] retained $(ls "$BACKUP_DIR" | wc -l) files (limit ${RETENTION_DAYS} days)"
