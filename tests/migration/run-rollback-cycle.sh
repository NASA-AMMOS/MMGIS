#!/usr/bin/env bash
# Upgrade, roll back and change accounts on the previous release, upgrade again:
# access removed there must stay removed. Uses only mmgis-test, which is dropped and recreated.
#   tests/migration/run-rollback-cycle.sh [base-ref]   (default: origin/development)
if [ "${NODE_ENV:-}" = "production" ]; then echo "Refusing to run with NODE_ENV=production"; exit 1; fi
set -euo pipefail
cd "$(dirname "$0")/../.."; ROOT=$PWD; OLD=${OLD_PORT:-8892}; NEW=${NEW_PORT:-8893}; BASE_REF=${1:-origin/development}; WORK=$ROOT/test-results/rb-base; LOGS=$ROOT/test-results; mkdir -p "$LOGS"; S=tests/migration/rollback-cycle.js
cleanup(){ [ -n "${PID:-}" ] && kill $PID 2>/dev/null || true; git worktree remove --force "$WORK" 2>/dev/null || true; }
trap cleanup EXIT
wait_for(){ for _ in $(seq 1 90); do curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/" | grep -qv '^000$' && return 0; sleep 2; done; tail -30 "$2"; return 1; }
git worktree remove --force "$WORK" 2>/dev/null || true
git worktree add --detach "$WORK" "$BASE_REF" >/dev/null
ln -s "$ROOT/node_modules" "$WORK/node_modules"
grep -v -E '^(SITE_ACCESS|AUTH_PROVIDERS|AUTH|PORT|NODE_ENV|DB_NAME)=' .env > "$WORK/.env"
printf 'AUTH=local\nPORT=%s\nNODE_ENV=test\nDB_NAME=mmgis-test\n' "$OLD" >> "$WORK/.env"
node tests/test-db-clean.js
(cd "$WORK" && PGDATABASE=postgres node scripts/init-db.js > "$LOGS/rb-initdb.log" 2>&1)
old(){ (cd "$WORK" && exec node scripts/server.js > "$LOGS/rb-old-$1.log" 2>&1) & PID=$!; wait_for $OLD "$LOGS/rb-old-$1.log"; }
new(){ env -u AUTH SITE_ACCESS=required AUTH_PROVIDERS='["local"]' PORT=$NEW NODE_ENV=test DB_NAME=mmgis-test node scripts/server.js > "$LOGS/rb-new-$1.log" 2>&1 & PID=$!; wait_for $NEW "$LOGS/rb-new-$1.log"; sleep 4; }
stop(){ kill $PID; wait $PID 2>/dev/null || true; PID=; }
echo "== dev seed"; old 1; BASE_URL=http://127.0.0.1:$OLD node $S seed; stop
echo "== upgrade 1"; new 1; node $S bindings; stop
echo "== rollback edits on dev"; old 2; BASE_URL=http://127.0.0.1:$OLD node $S rollbackEdits; stop
echo "== re-upgrade"; new 2; VERIFY=1 node $S bindings; stop
echo "== third start (no changes)"; new 3; stop
echo "-- reconcile log, start 2:"; grep -o 'Accounts changed on the previous release[^"]*' "$LOGS/rb-new-2.log" | sed 's/ | /\n  /g' || echo none
n=$(grep -c "Accounts changed on the previous release" "$LOGS/rb-new-3.log" || true); [ "$n" = 0 ] || { echo "Unchanged restart reported changes"; exit 1; }; echo "unchanged restart: no changes reported"
