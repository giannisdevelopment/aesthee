#!/usr/bin/env bash
# Run Treatwell import chunks against Supabase Postgres.
# Usage:
#   export DATABASE_URL='postgresql://postgres....@aws-0-....pooler.supabase.com:6543/postgres'
#   # (Supabase → Project Settings → Database → Connection string → URI)
#   ./scripts/run-treatwell-import.sh
#
# Or:
#   DATABASE_URL='...' ./scripts/run-treatwell-import.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/supabase/treatwell-import"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL first (Supabase → Settings → Database → URI)."
  echo "Example:"
  echo "  export DATABASE_URL='postgresql://postgres.XXXX:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'"
  echo "  ./scripts/run-treatwell-import.sh"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install with: brew install libpq && brew link --force libpq"
  exit 1
fi

shopt -s nullglob
files=(
  "$DIR"/00-clients-*.sql
  "$DIR"/01-extra-clients.sql
  "$DIR"/02-visits-*.sql
  "$DIR"/03-appts-*.sql
  "$DIR"/99-summary.sql
)

if [[ ${#files[@]} -lt 2 ]]; then
  echo "No chunk files in $DIR"
  exit 1
fi

echo "Running ${#files[@]} SQL files…"
i=0
for f in "${files[@]}"; do
  i=$((i + 1))
  echo "[$i/${#files[@]}] $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "Done."
