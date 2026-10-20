#!/usr/bin/env bash
# Start PostgreSQL and MMGIS (production mode, AUTH=local) inside the OSS Scanner image, then seed:
#   admin      scanner_admin / ScannerAdmin1!   (permission 111)
#   non-admin  scanner_user  / ScannerUser1!    (permission 001)
#   the Reference Mission (configured from /src/blueprints)
# Server log: /tmp/mmgis.log. Stop with: pkill -f scripts/server.js; pg_ctlcluster 15 main stop
#
# The Playwright suites start their own server on :18888 against the mmgis-test database:
#   npm run test:unit        (no database)
#   npm run test:e2e:api     (needs PostgreSQL running: pg_ctlcluster 15 main start)
set -euo pipefail
cd /src

URL="http://localhost:${PORT:-8888}"
ADMIN_USER=scanner_admin
ADMIN_PASS='ScannerAdmin1!' # pragma: allowlist secret
USER_USER=scanner_user
USER_PASS='ScannerUser1!' # pragma: allowlist secret
JAR=/tmp/mmgis-admin.cookies

pg_ctlcluster 15 main start 2>/dev/null || true

# Any HTTP response means the server is listening (AUTH=local answers unauthenticated requests with a redirect)
up() { curl -s -o /dev/null "$URL/"; }

if ! up; then
  nohup npm run start:prod > /tmp/mmgis.log 2>&1 &
  for _ in $(seq 1 90); do
    up && break
    sleep 2
  done
fi
up || { echo "MMGIS did not start; see /tmp/mmgis.log"; exit 1; }

post() { curl -s -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -X POST "$URL$1" -d "$2"; echo; }

post /api/users/first_signup "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" || true
post /api/users/login "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}"
post /api/configure/add '{"setupReferenceMission":true}' || true
post /api/users/signup "{\"username\":\"$USER_USER\",\"password\":\"$USER_PASS\",\"email\":\"user@example.com\"}" || true

echo "MMGIS is running at $URL (admin session cookies in $JAR)"
