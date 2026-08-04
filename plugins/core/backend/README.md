# Backend plugins — the server contract

A backend plugin is an Express feature module: it mounts its own routes, owns its
own Sequelize models, and declares whatever environment variables it needs. Core
discovers it, orders it, and calls it at three moments — it never routes for you,
so **your middleware chain is your security boundary**.

```
plugins/<container>/backend/<Name>/
  plugin.json      # manifest — identity, priority, routes (descriptive)
  plugin.js        # the lifecycle module: mounts routes, runs migrations
  routes/<x>.js    # express.Router()s
  models/<x>.js    # sequelize.define(…) + an optional up() migration
  tests/
```

Nothing is generated for this family: there is no registry to regenerate and no
`activate` step. Discovery happens on server start, so **restart the server** to
pick up a new plugin.

---

## `plugin.js` — the lifecycle

```js
const router = require('./routes/mything')
const mythings = require('./models/mythings')

module.exports = {
    onceInit:    (s) => { /* mount routes */ },
    onceStarted: (s) => { /* the HTTP server is listening */ },
    onceSynced:  (s) => { /* tables exist — safe to migrate/seed */ },
}
```

| hook | when | what belongs here |
|---|---|---|
| `onceInit(s)` | during app setup, before the server listens | `s.app.use(…)` — mounting routes is the whole point of this hook |
| `onceStarted(s)` | after `listen` | anything needing a live server (websockets, self-calls, schedulers) |
| `onceSynced(s)` | after `sequelize.sync()` | `model.up()` migrations, seeding, backfills |

All three are optional and are called **in `priority` order** across plugins
(from `plugin.json`, ascending, default `1000`) — that is the only ordering
guarantee you get, and it is how you mount ahead of or behind another plugin.

> `sequelize.sync()` runs **without** `alter: true`: it creates missing tables but
> never adds a column to an existing one. Schema changes go in an exported `up()`
> on the model (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`) called from
> `onceSynced`. Note that core does not await `up()`, so don't assume another
> plugin's migration has finished when yours runs.

### The setup object `s`

The same `s` is passed to every hook of every plugin.

| field | what it is |
|---|---|
| `app` | the Express app. `s.app.use(…)` is how you exist |
| `ROOT_PATH` | the subpath MMGIS is served under. **Always** prefix your mount with it — `s.ROOT_PATH + '/api/mything'` — or your plugin breaks on any non-root deployment |
| `ensureAdmin(toLoginPage, denyLongTermTokens, allowGets, allowPosts, disallow)` | admin-only gate (see below) |
| `ensureUser()` | any logged-in user; the usual gate for user-facing data |
| `ensureUserForAdjacentServers()` | the adjacent-server variant: `GET` is open when `AUTH` is `off`/`none`, everything else needs admin |
| `ensureGroup(...groups)` | membership in a CSSO group |
| `stopGuests` | rejects guest sessions — put it *after* an `ensure*` on any write route |
| `checkHeadersCodeInjection` | header sanitation; include it on every mount |
| `setContentType` | response content-type normalization; include it on every mount |
| `permissions` | the permission-string constants (`'111'` site admin, …) |
| `cssoHandler` | the CSSO auth handler, for plugins doing their own auth flows |
| `swaggerUi`, `useSwaggerSchema` | serve your routes' OpenAPI schema into `/api-docs` |

A conventional mount:

```js
s.app.use(
    s.ROOT_PATH + '/api/mything',
    s.ensureUser(),                  // who
    s.checkHeadersCodeInjection,     // hygiene
    s.setContentType,
    router                           // what
)
```

Middleware order is Express order: the gate must come before the router, and
`stopGuests` after the gate.

---

## Authentication — read this before you pick a gate

**Auth is per-mount, chosen by you.** A router mounted with no `ensure*` is open
to the world regardless of the `AUTH` env, so the omission in the scaffold is a
starting point, not a default policy.

Two things surprise people:

1. **`ensureAdmin()` is not purely "admin".** Before checking the session it
   allows a hardcoded whitelist of read-only core endpoints
   (`/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`,
   `/api/geodatasets/search`, …) so the unauthenticated app can boot. Your
   routes are **not** on that list and cannot be added from a plugin — if you
   need a public read, mount with `s.ensureAdmin(false, false, true)`
   (`allowGets`), optionally passing `disallow` as a list of path suffixes that
   stay admin-only:

   ```js
   // GETs are public; POSTs still require admin; /api/mything/purge never is
   s.app.use(
       s.ROOT_PATH + '/api/mything',
       s.ensureAdmin(false, false, true, false, ['/purge']),
       s.checkHeadersCodeInjection,
       s.setContentType,
       router
   )
   ```

2. **`AUTH=off` does not mean "no auth".** With `AUTH=off` there is no way to log
   in, so an `ensureAdmin()` route is unreachable in a dev instance — which is
   why hitting your own new endpoint in a fresh checkout returns the
   unauthorized page rather than your JSON. Test such routes with a long-term
   token, or gate them so the paths you want to exercise are `allowGets`.

`ensureAdmin` parameters, in order: `toLoginPage` (render the admin login page
instead of rejecting), `denyLongTermTokens` (refuse `Authorization`-header
tokens), `allowGets`, `allowPosts`, `disallow` (path suffixes exempted from the
two `allow*` relaxations).

---

## `plugin.json`

```jsonc
{
  "name": "MyThing",              // required; the plugin's identity
  "type": "backend",              // required
  "version": "1.0.0",
  "priority": 1000,               // lifecycle ordering, ascending
  "overridable": true,            // may a later container replace this plugin?
  "routes": {                     // DESCRIPTIVE ONLY — see below
    "prefix": "/api/mything",
    "auth": "user"
  },
  "envs": [],
  "engines": { "mmgis": ">=4.3.0" },
  "pluginDependencies": ["core/backend/Users"]
}
```

`routes` documents what the plugin mounts; **core does not enforce it** — the
mount in `onceInit` is the truth, and `routes.auth` is a label for humans and
tooling, not a gate. Keep them in sync anyway: it is what a reviewer reads first.

A `name` collision means the later-discovered container **overrides** the earlier
plugin (that is how you replace a core backend), unless the earlier one declares
`"overridable": false`. `engines.mmgis` is checked with semver and a mismatch
skips the plugin with an error.

### Environment variables

Export `envs` from `plugin.js` (not the manifest) to have core validate and log
them at startup:

```js
module.exports = {
    envs: [
        { name: 'MYTHING_HOST', required: true },
        { name: 'MYTHING_TOKEN', required: true, private: true },  // redacted in logs
    ],
    onceInit: (s) => { … },
}
```

`required` makes a missing value a startup warning; `private` redacts it from the
startup log. A name already used by core, or by another plugin, warns rather than
overrides. If your plugin ships with MMGIS itself, the ENV triple-update rule
applies: `.env`, `sample.env`, and `docs/pages/Setup/ENVs/ENVs.md`.

---

## Models

```js
const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')

const MyThings = sequelize.define('mythings', { … }, { timestamps: true })

MyThings.up = async () => {
    await sequelize.query(
        'ALTER TABLE mythings ADD COLUMN IF NOT EXISTS note TEXT'
    )
}

module.exports = MyThings
```

Use the shared `API/connection` — never a second connection pool. PostGIS is
available (`init-db.js` creates the extension). Never `DROP DATABASE` or
`TRUNCATE` from a plugin, and always sanitize identifiers you interpolate
(`API/Backend/Utils` has helpers).

---

## Testing

Backend tests are Playwright specs like everything else. A unit-only spec
(manifest shape, a pure helper, a router built in isolation) needs no database:

```bash
npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/core/backend/MyThing/tests/
```

Anything hitting a live route needs the full harness (`npm test`), which brings
up the test database. Remember the auth note above: an `ensureAdmin()` route in
an `AUTH=off` test instance returns the unauthorized page, so either use a
long-term token or `test.skip()` with a reason rather than weakening the gate.

---

## Checklist for a new backend plugin

1. `npm run plugins -- create backend MyThing --container my-plugins`
2. Mount with `s.ROOT_PATH + …` and a deliberate `ensure*` gate.
3. `checkHeadersCodeInjection` + `setContentType` on every mount.
4. Models through `API/connection`; schema changes in `up()`, called from
   `onceSynced`.
5. Declare `envs` in `plugin.js` if you read any.
6. Keep `plugin.json`'s `routes` honest, and set `priority` if you care where you
   sit in the order.
7. `npm run plugins -- validate`, then **restart the server** — there is nothing
   to regenerate, and nothing will pick your plugin up until you do.
