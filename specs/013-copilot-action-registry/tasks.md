# Tasks: Host Copilot Action Registry

## Phase 1 - Contract and isolation

- [x] Define the narrow host-only scope and explicit exclusions.
- [x] Document the four public facade methods and normalized result contract.
- [x] Select and document the enforced JSON Schema subset.
- [x] Record limits, timeout behavior, redaction, and lifecycle semantics.

## Phase 2 - Registry implementation

- [x] Add isolated/default action registries and portable namespaced ids.
- [x] Validate descriptors, analytics metadata, and collision ownership.
- [x] Add bounded JSON copying for schema, args, discovery, and results.
- [x] Deep-freeze registered/discovered descriptors.
- [x] Validate execution args against all accepted schema keywords.
- [x] Add availability and handler timeouts with cooperative abort signals.
- [x] Normalize handler output and redact unexpected error details.
- [x] Enforce action-count and aggregate-descriptor limits.
- [x] Preserve legacy unregister and add opaque HMR-safe registration handles.

## Phase 3 - Facade and documentation

- [x] Wire register/unregister/list/execute to `window.mmgisAPI`.
- [x] Add and browser-test the bounded `setLayerOpacity` facade dependency.
- [x] Add plugin-author examples for simple and HMR-safe lifecycles.
- [x] Document schema support, limits, availability, results, and exclusions.

## Phase 4 - Verification

- [x] Add focused registry unit tests.
- [x] Add an actual browser `window.mmgisAPI` lifecycle test.
- [x] Run focused registry unit tests.
- [x] Run focused ESLint on the new registry/tests with zero errors and warnings.
- [x] Record the existing facade file's unrelated baseline lint warnings.
- [x] Run syntax and whitespace checks.
- [ ] Execute the browser facade test against a built Reference Mission.

The final browser item is intentionally distinct from test implementation: the
suite requires the production bundle and test server/database prerequisites and
must not be marked complete when those prerequisites are absent.
