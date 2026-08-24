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
| `ensureUserForApi(options)` | session/long-term-token gate for machine-consumed APIs; typed HTTP errors and public `off`/`none` behavior (see below) |
| `ensureUserForAdjacentServers()` | the adjacent-server variant: `GET` is open when `AUTH` is `off`/`none`, everything else needs admin |
| `ensureGroup(...groups)` | membership in a CSSO group |
| `stopGuests` | rejects guest sessions — put it *after* an `ensure*`, and mount it on the write route rather than the whole mount (see below) |
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

Four things surprise people:

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

3. **`stopGuests` knows nothing about your route.** It rejects when the user is
   the guest user **or `AUTH` is `off`** — the method is irrelevant, so putting it
   on the whole mount blocks your reads too, and blocks everything in a dev
   instance. Core's Draw mounts it on the whole `/api/draw` mount because every
   one of those routes is a user write; if any of yours is a read you want a dev
   instance to answer, put it on the write handlers instead
   (`router.post('/save', s.stopGuests, handler)`).

4. **Legacy gates reject with an HTTP 200 failure body.** `stopGuests` and most
   existing core handlers answer `{ status: 'failure', message: … }` with a 200,
   so clients of those routes must check `body.status !== 'failure'`.

   Machine-consumed endpoints that need HTTP authentication semantics should use
   the additive typed gate instead. Its failure codes/messages are per-mount:

   ```js
   s.app.use(
       s.ROOT_PATH + '/api/mything',
       s.ensureUserForApi({
           code: 'MyThingAuthenticationRequired',
           message: 'Sign in to use MyThing.',
           unavailableCode: 'MyThingAuthenticationUnavailable',
           unavailableMessage: 'Authentication is temporarily unavailable.',
       }),
       s.checkHeadersCodeInjection,
       s.setContentType,
       router
   )
   ```

   In protected modes it accepts an authenticated local/CSSO request or a valid
   long-term token in exactly `Authorization: Bearer <token>` or the documented
   legacy `Authorization: Bearer: <token>` form. Missing, malformed, invalid,
   expired and guest credentials return HTTP 401 JSON as
   `{ error: message, code }`; a token-store failure returns typed HTTP 503 JSON.
   A valid token preserves the same `req.user`, `req.isLongTermToken`,
   `req.tokenUserPermission` and `req.tokenUserMissions` hydration as
   `ensureUser()`. Typed token requests also receive a stable internal
   `req.apiAuthIdentity` in the form `long-term-token:sha256:<hex>`, derived from
   the strictly parsed token so stateless requests can be correlated without
   retaining or logging the raw credential. Session requests continue to use
   `req.sessionID`. In public `AUTH=off`/`AUTH=none` modes, the gate hashes the
   available session ID into `session:sha256:<hex>`, assigns it to
   `req.apiAuthIdentity`, and persists the same nonsecret value in `req.session`.
   This initializes an otherwise fresh `saveUninitialized:false` session so the
   browser receives a cookie for a later continuation request; the raw session
   ID is never used as the API identity. Public mounts remain permissive even if
   an unrelated or malformed `Authorization` header is present. Blank or
   unrecognized `AUTH` values fail closed and do not inherit CSSO session
   semantics.

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

## Calling it from the frontend

A tool, interaction or layer type in the same container reaches your routes over
plain HTTP, and must build the url the same way you mounted it — MMGIS may be
served under a subpath, and the frontend's copy of it is
`window.mmgisglobal.ROOT_PATH`:

```js
const root = window.mmgisglobal.ROOT_PATH ? `${window.mmgisglobal.ROOT_PATH}/` : ''
const res = await fetch(`${root}api/mything/list`, {
    // A route behind ensureUser/ensureAdmin needs the session cookie.
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
})
```

Note there is no leading slash on `api/…`: the trailing slash comes from
`ROOT_PATH`, so concatenating gives `/mmgis/api/…` under a subpath and `api/…` at
the root, both correct. A hardcoded `/api/mything` works only at the root.

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
