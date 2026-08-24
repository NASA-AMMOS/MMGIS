# Feature Specification: Typed API Authentication

## Problem

MMGIS's existing `ensureUser()` middleware is a browser-era compatibility
contract: rejected long-term tokens can produce an HTTP 200 legacy failure
envelope or an HTML login page. Machine-consumed plugin APIs need stable HTTP
status codes and error codes without duplicating the host's token validation.

## Scope

This feature adds an additive `s.ensureUserForApi(options)` middleware factory
for backend plugins. It reuses the host long-term-token query and validity rules,
preserves legacy request hydration, and leaves `ensureUser()`, `ensureAdmin()`,
and `stopGuests` as compatibility APIs.

It does not change login/signup flows, session storage, token persistence, token
creation, CSSO proxy trust, database schemas, Agent routes, the Copilot action
registry, or existing legacy response envelopes.

## User scenarios and requirements

### P1 - A machine endpoint returns a typed authentication failure

As a plugin author, I can protect a mount with `ensureUserForApi()` so clients
can distinguish authentication failures from successful application responses.

- Missing or malformed credentials in a protected mode return HTTP 401 JSON.
- Invalid, expired, creatorless, or guest-user token records return the same 401.
- A 401 includes `WWW-Authenticate: Bearer`.
- The response is `{ error: <message>, code: <code> }` and may be customized per
  mount with `code` and `message`.
- Credential values and internal validation errors are not included in the
  public response.

### P1 - Existing authenticated requests continue

- `AUTH=local` accepts a non-guest session only when its permission is `111`,
  `110`, or `001`.
- `AUTH=csso` accepts a non-guest identity hydrated by the existing
  `cssoHandler`.
- Blank, misspelled, and unknown protected modes do not inherit CSSO behavior;
  they fail closed unless a valid long-term token is supplied.
- `AUTH=off` and `AUTH=none` are explicitly public and continue even when an
  incidental `Authorization` header is malformed.
- When a public request has an Express session and session ID, the gate assigns
  `req.apiAuthIdentity` as `session:sha256:<hex>` and persists that nonsecret
  value in `req.session`. This marks a fresh `saveUninitialized:false` session
  for saving so the browser can reuse its cookie on a continuation request.
- The raw session ID is not exposed as the API identity. Public requests without
  session middleware remain permitted and simply omit the identity.

### P1 - Long-term tokens use host validation

- Exactly `Authorization: Bearer <token>` and the documented legacy
  `Authorization: Bearer: <token>` form are accepted.
- The host token record must match the parsed token, have a creator, and be
  unexpired (or have period `never`).
- A valid record hydrates `req.user`, `req.isLongTermToken`,
  `req.tokenUserPermission`, and `req.tokenUserMissions` exactly as the legacy
  gates do.
- A typed token request receives a stable, nonsecret `req.apiAuthIdentity`
  derived as `long-term-token:sha256:<hex>` from the strictly parsed token. The
  same token has the same identity across requests, different tokens differ,
  and the raw token is never exposed or logged. Session requests continue to
  use the existing `req.sessionID`; only the derived public correlation value is
  stored in `req.session`.
- A token-store/query failure returns customizable HTTP 503 JSON rather than
  being confused with invalid credentials.

### P2 - Legacy middleware remains compatible

- `ensureUser()` remains a no-argument middleware factory.
- Existing `ensureUser()` and `ensureAdmin()` success/failure shapes and status
  behavior are unchanged.
- Both legacy gates reuse the same token hydration and record-validity helpers
  without acquiring the new typed response contract.

## Acceptance criteria

1. Focused tests cover public `off`/`none`, explicit local and CSSO sessions,
   unknown-mode fail-closed behavior, strict header parsing, valid hydration,
   invalid and expired records, guest identities, and token-store failure.
2. Invalid/expired and store-error middleware tests traverse the reusable token
   validity and callback-to-Promise resolver helpers used by `server.js`.
3. Two cookie-free requests with the same token receive the same hashed API
   identity; a different token receives a different identity, and successful
   and failure responses do not contain raw token values.
4. With `saveUninitialized:false`, a first public request receives a session
   cookie and a second request carrying it receives the same hashed identity;
   both requests remain public with malformed authorization headers.
5. New auth implementation and tests are ESLint-clean and Node syntax checks
   pass.
