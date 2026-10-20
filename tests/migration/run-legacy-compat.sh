#!/usr/bin/env bash
# End-to-end upgrade check: seed accounts with a previous MMGIS release, run the
# migration dry run, start this checkout on the same database, verify logins.
#
#   tests/migration/run-legacy-compat.sh [base-ref]   (default: origin/development)
#
# Uses only the mmgis-test database, which is dropped and recreated.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$PWD
BASE_REF=${1:-origin/development}
OLD_PORT=${OLD_PORT:-8890}
NEW_PORT=${NEW_PORT:-8891}
WORK=${LEGACY_WORKTREE:-$ROOT/test-results/legacy-base}
LOGS=$ROOT/test-results
mkdir -p "$LOGS"

if [ "${NODE_ENV:-}" = "production" ]; then echo "Refusing to run with NODE_ENV=production"; exit 1; fi
[ -f .env ] || { echo ".env is required (DB credentials)"; exit 1; }

cleanup() {
  [ -n "${OLD_PID:-}" ] && kill "$OLD_PID" 2>/dev/null || true
  [ -n "${NEW_PID:-}" ] && kill "$NEW_PID" 2>/dev/null || true
  git worktree remove --force "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

wait_for() {
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:$1/api/users/logged_in" -X POST && return 0
    curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/" | grep -qv '^000$' && return 0
    sleep 2
  done
  echo "Server on :$1 did not start"; tail -50 "$2"; return 1
}

git worktree remove --force "$WORK" 2>/dev/null || true
git worktree add --detach "$WORK" "$BASE_REF" >/dev/null
ln -s "$ROOT/node_modules" "$WORK/node_modules"
grep -v -E '^(SITE_ACCESS|AUTH_PROVIDERS|AUTH|PORT|NODE_ENV|DB_NAME)=' .env > "$WORK/.env"
printf 'AUTH=local\nPORT=%s\nNODE_ENV=test\nDB_NAME=mmgis-test\n' "$OLD_PORT" >> "$WORK/.env"

node tests/test-db-clean.js
(cd "$WORK" && node scripts/init-db.js > "$LOGS/legacy-old-initdb.log" 2>&1)

echo "== Starting $BASE_REF on :$OLD_PORT"
(cd "$WORK" && exec node scripts/server.js > "$LOGS/legacy-old-server.log" 2>&1) &
OLD_PID=$!
wait_for "$OLD_PORT" "$LOGS/legacy-old-server.log"
BASE_URL=http://127.0.0.1:$OLD_PORT node tests/migration/legacy-accounts.js seed
kill "$OLD_PID"; wait "$OLD_PID" 2>/dev/null || true; OLD_PID=

echo "== Dry run against the not-yet-upgraded database, with the old .env"
before=$(node tests/migration/legacy-accounts.js snapshot)
(cd "$WORK" && env -u SITE_ACCESS -u AUTH_PROVIDERS node "$ROOT/scripts/auth-migrate.js" --dry-run) | grep -v '^{"level"'
after=$(node tests/migration/legacy-accounts.js snapshot)
[ "$before" = "$after" ] || { echo "Dry run changed the database"; exit 1; }

echo "== Starting this checkout on :$NEW_PORT"
env -u AUTH SITE_ACCESS=required AUTH_PROVIDERS='["local"]' PORT=$NEW_PORT NODE_ENV=test DB_NAME=mmgis-test \
  node scripts/server.js > "$LOGS/legacy-new-server.log" 2>&1 &
NEW_PID=$!
wait_for "$NEW_PORT" "$LOGS/legacy-new-server.log"
grep -o 'Imported [0-9]* role binding.*' "$LOGS/legacy-new-server.log" || true
BASE_URL=http://127.0.0.1:$NEW_PORT node tests/migration/legacy-accounts.js verify
