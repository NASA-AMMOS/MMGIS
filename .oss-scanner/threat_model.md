# Threat model

## What this project does and where untrusted input enters

MMGIS (Multi-Mission Geographic Information System) is a web mapping server for planetary and Earth science missions. It runs as a Node.js/Express 5 server (`scripts/server.js`) backed by PostgreSQL/PostGIS. It serves a jQuery/React web client (2D Leaflet, 3D Cesium/LithoSphere, image/model/PDF viewers) and a separate React admin app ("Configure", `configure/`). Deployments typically run behind a reverse proxy on mission networks, and missions often expose them to a wide group of internal or partner users.

Users and their trust levels:
- **Unauthenticated visitors.** With `AUTH=none` or `AUTH=off` they can read public missions. With `AUTH=local` they are only allowed the login and password-reset flows. They are untrusted.
- **Authenticated non-admin users** (permission `001`). They can draw and share features, upload and download their own files, and use collaboration features. They are untrusted with respect to other users' data and to anything admin-only.
- **Admins** (permission `111`/`110`). They configure missions, layers, users, datasets, geodatasets, webhooks and long-term API tokens through `/api/configure/*` and the Configure app. They are trusted to configure the server, but **not** to get OS command execution or to read files outside `/Missions`.
- **Long-term API tokens** (`Authorization: Bearer`, `plugins/core/backend/LongTermToken`). They act with the permission of the admin who created them, and some routes deny them (`denyLongTermTokens`).

Where untrusted input enters:
- **REST API under `/api/*`** (`plugins/core/backend/*/routes/`, mounted from `plugins/core/backend/*/plugin.js`). The main areas are Draw (user features and files), Datasets and Geodatasets (CSV/GeoJSON upload, search, tile and feature queries), Users (login, signup, password reset), Shortener, Webhooks, Stac, Sightline, Utils and Config.
- **Mission files at `/Missions/*`** (`scripts/middleware.js`, `API/validateMissionsPath.js`, `API/validateGdalDatasetPath.js`). Layer URLs may legitimately contain `../` to reference another mission, but nothing may resolve outside `/Missions`. `/Missions/shared` is readable by any authenticated user. `checkMissionFileViewingPermission` limits the rest.
- **Server-side processes.** `Utils`, `Sightline` and `Config` routes run Python/GDAL scripts in `private/api/` and `auxiliary/` through `child_process`, using request parameters such as file paths, coordinates and band numbers.
- **Outbound requests.** Webhooks, the TiTiler/STAC/TiPG/Veloserver proxies in `adjacent-servers/` (URL allow-list `TITILER_ALLOWED_URL_PATTERNS`), and any route that fetches a URL taken from configuration or a request.
- **WebSocket collaboration** (`API/websocket.js`, `plugins/core/backend/Broadcast`). Messages are relayed between connected clients.
- **Client-rendered content.** Feature properties, layer and mission config, drawn-feature names and descriptions, markdown/HTML in info panels, and KML/GeoJSON/CSV are all rendered in other users' browsers.
- **Plugins** under `plugins/` add routes and tools. Plugins under `plugins/core/` are in scope.

## Components that matter most / least

Most important:
- Authentication and session handling: `ensureUser`/`ensureAdmin` and `validateLongTermToken` in `scripts/server.js`, `plugins/core/backend/Users`, `plugins/core/backend/LongTermToken`, CSSO header handling, and session cookie flags.
- Authorization on `/api/configure/*`. It must require an admin session even when `AUTH=off`. The only read-only exceptions are `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get` and `/api/geodatasets/search`.
- Ownership checks in Draw (file owner, `public`, `hidden`, template and lead roles). One user must not be able to read private files, or edit or delete features, belonging to another user.
- Path handling for `/Missions`, uploads, dataset and geodataset names, and anything passed to GDAL or Python.
- Command or argument injection in `child_process` calls.
- SQL built by Sequelize `literal`/`query` with interpolated names. Table and column names must pass `Utils.forceAlphaNumUnder()`.
- SSRF through webhooks and adjacent-server proxies.
- Stored XSS that runs in an admin's browser, for example in the Configure app or in layer or mission config rendered on the map.

Less important, but still in scope:
- Rate limiting and denial of service, such as large uploads, heavy PostGIS queries or the compute-limited Utils routes.
- Reflected XSS that needs user interaction.
- Information disclosure in error messages or logs.

Out of scope:
- `docs/` (Jekyll site), `specs/`, `blueprints/`, `examples/`, and `tests/` themselves.
- The adjacent servers' own code (TiTiler, stac-fastapi, TiPG, Veloserver). We run them as upstream images. Only MMGIS's proxying and URL validation in front of them is in scope.
- Vulnerable third-party dependencies, unless MMGIS reaches the vulnerable path in a way you can show.
- The production `/Dockerfile` and `docker-compose*.yml`, except where they make the default deployment insecure.

## How to exercise it

The image builds everything in `/src`:
- `node_modules` are installed, and the web client and Configure app are built.
- A local PostgreSQL 15 + PostGIS cluster is initialised. The DB user is `mmgis` (superuser, local only).
- `/src/.env` sets `AUTH=local`, port 8888, a generated `SECRET`, and all adjacent servers off.

Ways to run it:
- `.oss-scanner/start-mmgis.sh` starts PostgreSQL and MMGIS in production mode on `http://localhost:8888`. It seeds:
  - an admin, `scanner_admin` / `ScannerAdmin1!`;
  - a non-admin user, `scanner_user` / `ScannerUser1!`;
  - the Reference Mission (`/?mission=Reference-Mission`, data under `/src/Missions/Reference-Mission`).

  The admin session cookie is left in `/tmp/mmgis-admin.cookies` and the server log is in `/tmp/mmgis.log`. To try another auth mode, edit `AUTH=` in `/src/.env` and restart with `pkill -f scripts/server.js` and then the script.
- `npm run test:unit` runs unit tests that need no database.
- With PostgreSQL running (`pg_ctlcluster 15 main start`), `npm run test:e2e:api` and `npm run test:e2e:security` run the Playwright API and security suites. They start their own server on port 18888 against the `mmgis-test` database. Chromium is installed for UI suites.
- Swagger/OpenAPI: `docs/mmgis-openapi.json`, served at `/api/docs` while the server runs.

## How you rate severity

- **Critical:**
  - OS command execution or arbitrary file write by an unauthenticated user or a non-admin user.
  - Authentication bypass that gives admin.
  - SQL injection reachable without admin.
- **High:**
  - Privilege escalation from non-admin to admin.
  - Reaching any `/api/configure/*` write endpoint without an admin session (including under `AUTH=off`).
  - Reading files outside `/Missions` (path traversal), or reading another user's private Draw files or features.
  - Stored XSS that a non-admin can plant and that runs for admins or other users without unusual interaction.
  - SSRF that reaches internal services.
  - Command or SQL injection that needs an admin session. Admins are not meant to have OS access.
- **Medium:**
  - Changing or deleting another user's Draw features without their permission.
  - Reflected XSS.
  - CSRF on state-changing routes.
  - Session fixation or weak cookie flags under default configuration.
  - Open redirects.
  - Bypasses of the TiTiler URL allow-list that stay limited to public URLs.
- **Low:**
  - Denial of service, unless one small unauthenticated request can take the server down. That is medium.
  - Information disclosure that has no direct exploit, such as version strings or stack traces.
  - Issues that need a non-default, already-insecure configuration (`TITILER_ALLOWED_URL_PATTERNS=` empty, `AUTH=off` on a public network).

Things we do not count as vulnerabilities:
- Admins configuring layers that load arbitrary external URLs in users' browsers. Admins also edit mission and layer config, which may contain HTML for info panels. This is admin-to-user content by design. It becomes a finding only if a non-admin can inject it.
- `AUTH=off` or `AUTH=none` allowing anonymous read access to missions.

## How we would like reports

- Give the affected route or file and line, the auth mode (`off`, `none`, `local` or `csso`), and the minimum role needed.
- Include a `curl` reproducer against the image above where possible.
- Patches should follow the existing patterns:
  - path checks via `isPathInsideRoot` and `validateMissionsPath`;
  - identifiers via `Utils.forceAlphaNumUnder()`;
  - `execFile`-style argument arrays, not shell strings;
  - `ensureAdmin()` on admin routes.
- Include a Playwright test in `tests/e2e/security/` or a co-located plugin test.

## Anything to leave alone

- The fixed test credentials in `tests/` and `.oss-scanner/` (`test_admin`, `scanner_admin`, and so on). They exist only for local test databases.
- `sample.env` placeholder values.
- Missing HTTPS. We expect production to run behind a TLS-terminating proxy, or with `HTTPS=true`.
- `../` in layer URLs that still resolves inside `/Missions`. It is intended.
