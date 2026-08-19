# Host Copilot Action Registry

**Feature**: 013
**Status**: Implemented; browser integration verification pending
**Created**: 2026-08-18

## Problem

External frontend plugins need a stable way to describe and invoke a limited
set of model-selectable actions. MMGIS has no host-owned contract for that
capability, so an integration would otherwise depend on private plugin
functions, DOM selectors, or an unreviewed application-specific registry.

The host contract must remain useful without shipping any Copilot provider,
chat UI, mission configuration, or Analysis implementation. It is a reusable
registration, discovery, validation, and invocation boundary only.

## Scope

This feature adds:

- an isolated frontend action registry and one default host instance;
- four `window.mmgisAPI` facade methods: register, unregister, list, execute;
- the bounded `setLayerOpacity` facade required by AgentChat's static layer
  action, without adding broader map/tool controller wrappers;
- bounded descriptor, schema, argument, discovery, and result handling;
- availability and execution timeouts;
- JSON Schema subset enforcement before handler invocation;
- deeply immutable discovery descriptors;
- backward-compatible lifecycle calls plus opaque HMR-safe handles;
- focused unit tests, a real browser facade-wiring test, and plugin-author docs.

It does not add core actions, provider logic, Agent/AgentChat code, Analysis
integration, authentication changes, mission data, FROZON setup, or generated
validation artifacts.

## User scenarios

### P1 - A plugin registers a capability

As a plugin developer, I can register a namespaced action with a description,
object argument schema, handler, and optional availability function. I receive
a portable action id (or an opt-in lifecycle handle), and existing plugin
behavior remains unchanged when the API is absent or unused.

**Acceptance criteria**:

- The action appears in discovery with its normalized id and current
  availability.
- Discovery contains no handler, availability function, accessor, or mutable
  schema reference.
- Another plugin cannot collide with the normalized id or unregister it through
  the legacy ownership check.

### P1 - A Copilot client executes a registered capability

As a Copilot client, I can execute only an id present in the host registry.
Arguments are copied, bounded, and validated against the exact advertised
schema before availability or handler execution.

**Acceptance criteria**:

- Missing required fields, wrong types, invalid enums/ranges, and disallowed
  properties return `INVALID_ACTION_ARGUMENTS` without invoking the handler.
- Unknown or malformed ids return a stable failure result.
- Successful and expected-failure handler values normalize to
  `{ ok, message, data, error }`.

### P1 - Failures stay safe and finite

As an operator, I retain raw thrown errors in local logs, while a Copilot client
receives no stack, path, token, endpoint, or exception message from an
unexpected failure.

**Acceptance criteria**:

- Availability and handler promises have finite time limits and receive an
  abort signal.
- Oversized/deep/circular/non-JSON inputs and results are rejected.
- Unexpected exceptions return stable public codes with redacted details.

### P2 - Hot reload does not remove a replacement

As a tool developer using hot module replacement, I can atomically replace my
own action and tear down using an opaque handle. Disposal from an older module
must not unregister the newer generation.

## Functional requirements

- **FR-001**: The host MUST expose exactly the action-registry lifecycle through
  `registerCopilotAction`, `unregisterCopilotAction`, `listCopilotActions`, and
  `executeCopilotAction` on `window.mmgisAPI`.
- **FR-002**: Registration MUST require bounded safe identifiers, a non-empty
  description, a root object parameter schema, and a handler function.
- **FR-003**: Normalized ids MUST be model-compatible, at most 64 characters,
  namespaced by plugin, and collision checked.
- **FR-004**: Discovery MUST return plain, deeply immutable serializable data
  without executable references.
- **FR-005**: The registry MUST reject unsupported schema keywords and validate
  execution arguments against every advertised validation keyword it accepts.
- **FR-006**: Availability MUST be checked at discovery and again immediately
  before execution; unavailable actions MUST NOT invoke their handler.
- **FR-007**: Availability and handler calls MUST time out and expose a
  cooperative abort signal.
- **FR-008**: Descriptors, registry cardinality/aggregate size, arguments, and
  results MUST have explicit size, depth, and value-count bounds.
- **FR-009**: Unexpected exception details MUST remain in operator logs and MUST
  be redacted from the public result.
- **FR-010**: The id-plus-plugin unregister contract MUST remain compatible;
  opt-in opaque handles MUST make replacement and stale teardown safe.
- **FR-011**: No action MAY invoke arbitrary global methods, DOM selectors, or
  unregistered plugin functions through this registry.
- **FR-012**: `setLayerOpacity` MUST resolve only configured layers, reject
  non-finite/out-of-range opacity values, use the normal layer-type pipeline,
  and return the observed host state.

## Non-functional requirements

- The feature is additive and requires no environment, database, mission, or
  backend changes.
- Default limits support at most 128 actions and 512 KiB of descriptors.
- Default availability and handler timeouts are 2 and 30 seconds respectively.
- Unit tests cover the security and lifecycle boundaries, and the real browser
  facade is exercised by an MMGIS API integration test.
- ESLint completes with no errors or warnings for the new registry and focused
  tests; any baseline warnings in the existing facade are reported separately.

## Success criteria

- Focused registry tests pass for discovery, invocation, schema enforcement,
  bounds, timeouts, redaction, collisions, immutability, and HMR teardown.
- The browser-level MMGIS API test registers, discovers, validates, executes,
  and unregisters an action through `window.mmgisAPI`.
- Plugin documentation is sufficient to implement both the simple and HMR-safe
  lifecycle without reading registry internals.
