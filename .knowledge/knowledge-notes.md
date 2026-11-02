# Knowledge Notes

Lessons learned from past sessions — gotchas not obvious from the codebase.

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

- **New login providers** go in `plugins/core/auth/<Name>/`; follow `docs/pages/Contributing/AuthProviders/AuthProviders.md` (worked examples, `ctx`, login buttons, group sync).

- **Every API route declares its permission** with `authorize(capability, resolver)` (or `authorize.public` / `authorize.inHandler`). Core routes without one stop the server at startup. How to pick the capability and resolver: `docs/pages/Contributing/Permissions/Permissions.md`
- `/api/configure/*` requires a session with the route's capability (SuperAdmin or a scoped mission admin) **even when `SITE_ACCESS=public`**
- Read-only exceptions: `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`, `/api/geodatasets/search`
- First admin: on an empty database, open `/configure` and create the SuperAdmin with the setup code printed in the server log (or `SETUP_CODE`)
- Tests must handle auth even when `SITE_ACCESS=public`
