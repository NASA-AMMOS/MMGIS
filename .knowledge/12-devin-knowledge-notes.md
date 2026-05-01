# Devin Knowledge Notes

Lessons learned from past Devin sessions — gotchas not obvious from the codebase.

## CI

- `build-arm64` and `build-amd64` Docker build failures are **pre-existing** — ignore them. Required checks: `test (local)`, `test (off)`, `secret-detection`, `generate-tags`, `bump-version`.

## Child Sessions

- When parallelizing with child sessions, each child pushes to a named branch but does **NOT** create a PR. Only the parent session creates the consolidated PR.

## Error Handling

- Fatal startup errors must use `logger('error', msg, 'server', null, 'infrastructure_error')` — not `throw new Error(...)`.

## Path Security

- `../` in layer URLs is legitimate (cross-mission references) but must **never** escape `/Missions/`. Validate against `/Missions`, not per-mission subdirectories.
- Key files: `scripts/middleware.js` (`onlyExistingFilepaths`, `isPathInsideRoot`), `API/Backend/Utils/routes/utils.js`.
- Must work when MMGIS is served at a subpath.

## Database Init Sequence

1. `scripts/init-db.js` — creates DB, PostGIS, btree_gist, session table, spatial indexes
2. `scripts/server.js` — runs `sequelize.sync()` (no `alter: true`), creates tables but won't add columns
3. Schema migrations via `up()` in model files (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) — some are async and **not awaited** (race condition risk)
4. **Never write custom SQL** — use application APIs only

## Auth Gotchas

- `/api/configure/*` requires admin session (`"111"` or `"110"`) **even when `AUTH=off`**
- Read-only exceptions: `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`, `/api/geodatasets/search`
- First admin: start with `AUTH=local`, hit `/api/users/first_signup`
- Tests must handle auth even in `AUTH=off` mode
