# Implementation Plan: Typed API Authentication

## Technical context

- **Runtime**: Node.js 22+, Express 5, CommonJS server modules
- **Public surface**: backend plugin setup object `s.ensureUserForApi(options)`
- **Persistence**: existing Sequelize `long_term_tokens`/`users` join; no schema
  changes
- **Tests**: Playwright unit specs using an isolated Express server
- **Dependencies**: none added

## Architecture

```text
plugin API request
    |
    +-- AUTH=off/none -> persist hashed session identity -> next()
    |
    +-- explicit local/CSSO authenticated identity -> next()
    |
    +-- strict Bearer parser
            |
            +-- missing/malformed -----------------> typed 401
            |
            +-- callback validator -> Promise resolver
                    |
                    +-- invalid/expired/guest ------> typed 401
                    +-- query failure --------------> typed 503
                    +-- valid record -> hydrate + SHA-256 identity -> next()
```

## Components

### `scripts/apiAuthentication.js`

- Normalize the four documented auth modes while treating only `off` and
  `none` as public.
- Accept sessions only through explicit `local` and `csso` branches; unknown
  modes fail closed.
- Strictly parse the two supported bearer header forms.
- Provide a deterministic pure token-record validity helper.
- Adapt the callback validator to a Promise, mapping invalid records to `null`
  and storage failures to rejection.
- Build per-mount typed 401/503 responses and preserve legacy token hydration.
- Derive a stable `req.apiAuthIdentity` from the strict-parsed token for
  stateless request correlation; leave session identity on `req.sessionID`.
- In public mode, hash an available session ID and persist the nonsecret result
  in `req.session`, causing a fresh `saveUninitialized:false` session to emit a
  reusable cookie without making the raw ID the API identity.

### `scripts/server.js`

- Keep the existing Sequelize query and callback validator as the single source
  of token lookup behavior.
- Delegate record validity to the shared helper.
- Construct the typed resolver with the shared callback adapter and expose the
  middleware factory through the plugin setup object.
- Keep `ensureUser()`'s no-argument signature and its legacy responses intact.

### Tests and documentation

- Exercise the middleware through a local Express mount.
- Use deterministic token records to distinguish active, expired, malformed,
  creatorless, and never-expiring cases.
- Route valid, invalid/expired, and query-error cases through the same validity
  and resolver helpers used by the server.
- Verify two cookie-free requests share an identity only when their parsed token
  matches, and verify response serialization never includes either raw token.
- Use real `express-session` middleware to verify a public request initializes a
  cookie, a second request reloads the persisted identity, and bogus bearer
  headers never invoke token resolution in either request.
- Document the plugin-facing contract in `plugins/core/backend/README.md`.

## Risks and mitigations

- **Misconfigured AUTH values**: explicit mode branches prevent accidental CSSO
  inference.
- **Unstable public continuation identity**: persisting a derived session value
  ensures `saveUninitialized:false` writes the first public session cookie.
- **Legacy regressions**: typed behavior is additive; legacy middleware retains
  its factory signature and response contract.
- **Credential disclosure**: typed errors use configured public strings only;
  raw bearer tokens are not logged in legacy rejection messages or retained as
  the API identity.
- **False-positive tests**: expiry and storage tests traverse the shared helpers
  instead of labeling arbitrary mocked `null` values as expired records.

## Verification

Run the focused Playwright auth spec, ESLint on the new auth module/spec, Node
syntax checks on the auth module and server, and `git diff --check` for all auth
and spec files. Full server-file lint findings that predate this feature are
reported separately rather than attributed to this change.
