#!/usr/bin/env bash
# Regenerate packages/db/src/types/database.ts from the local Supabase project.
# Usage: pnpm db:types
#
# Requires SUPABASE_DB_URL or a linked Supabase project (`supabase link`).

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=packages/db/src/types/database.ts
mkdir -p "$(dirname "$OUT")"

# Prefer linked project; fall back to DB URL.
if supabase status >/dev/null 2>&1; then
  echo "==> Generating types from linked Supabase project"
  pnpm exec supabase gen types typescript --linked >"$OUT"
elif [ -n "${SUPABASE_DB_URL:-}" ]; then
  echo "==> Generating types from SUPABASE_DB_URL"
  pnpm exec supabase gen types typescript --db-url "$SUPABASE_DB_URL" >"$OUT"
else
  echo "!! Neither a linked Supabase project nor SUPABASE_DB_URL is set." >&2
  echo "!! Run 'supabase link' or set SUPABASE_DB_URL in .env.local." >&2
  exit 1
fi

echo "==> Wrote $OUT"
