# Tasks: Typed API Authentication

## Phase 1 - Contract

- [x] Define typed 401 and 503 response contracts.
- [x] Preserve explicit public `AUTH=off` and `AUTH=none` behavior.
- [x] Define explicit local/CSSO session handling and fail-closed unknown modes.
- [x] Record legacy middleware compatibility and non-goals.

## Phase 2 - Implementation

- [x] Add strict bearer parsing and per-mount typed failures.
- [x] Add shared request hydration for legacy and typed gates.
- [x] Extract deterministic long-term-token record validity.
- [x] Extract the callback-to-Promise token resolver.
- [x] Reuse both helpers from the host server token path.
- [x] Add a stable SHA-256-derived identity for typed token requests.
- [x] Persist a SHA-256-derived identity for public Express sessions.
- [x] Expose `ensureUserForApi` through the backend plugin setup object.
- [x] Remove raw bearer values from legacy rejection log messages.

## Phase 3 - Tests and documentation

- [x] Cover public, local, CSSO, guest, blank, and unknown auth modes.
- [x] Cover strict missing/malformed bearer failures.
- [x] Cover active, invalid, expired, creatorless, and never-expiring records.
- [x] Cover valid token hydration through both supported header forms.
- [x] Cover callback query failure to customized typed HTTP 503 mapping.
- [x] Cover stable/different token identities across cookie-free requests.
- [x] Cover public `saveUninitialized:false` cookie issuance and identity reuse.
- [x] Assert success and failure responses do not contain raw token values.
- [x] Document the backend plugin API and legacy/typed distinction.

## Phase 4 - Verification

- [x] Run the focused typed-auth Playwright spec.
- [x] Run focused ESLint on the new auth implementation and tests.
- [x] Run Node syntax checks on the auth module and server.
- [x] Run auth/spec whitespace and diff checks.

The focused suite passed 13 tests. New auth code/tests are ESLint-clean. The
whole legacy `server.js` file retains its pre-existing hook-name lint error and
unrelated warnings, so whole-file lint is recorded separately rather than
claimed clean by this feature.
