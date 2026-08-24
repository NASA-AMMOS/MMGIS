# Implementation Plan: Host Copilot Action Registry

## Technical context

- **Runtime**: existing MMGIS browser bundle (JavaScript, Webpack)
- **Public surface**: `src/essence/mmgisAPI/mmgisAPI.js`
- **Tests**: Playwright unit imports plus existing browser MMGIS API suite
- **Dependencies**: none added
- **Persistence/database**: none

## Architecture

```text
trusted frontend plugin
        │ register(descriptor, handler, availability)
        ▼
CopilotActionRegistry
  ├─ validates/freezes bounded descriptor + schema
  ├─ checks namespace, count, and aggregate size
  ├─ discovers descriptor + bounded availability
  └─ validates args → rechecks availability → invokes handler → normalizes result
        │
        ▼
window.mmgisAPI (four-method facade) ← Copilot client / AgentChat
```

The handler remains private in the registry. Only frozen descriptor data crosses
discovery. The registry is transport/provider agnostic: the eventual Copilot
client decides how descriptors reach a model and supplies execution context.

## Components

### `CopilotActionRegistry.js`

- Generates portable namespaced ids and rejects normalization collisions.
- Copies JSON with depth, node, string, collection, and byte bounds.
- Accepts a documented JSON Schema subset and rejects unsupported validation
  claims.
- Validates safe copied arguments before calling plugin code.
- Runs availability concurrently during discovery and rechecks it at execution.
- Races async availability/handler work against fixed timeouts and provides an
  abort signal for cooperative cancellation.
- Normalizes results while preserving only an intentional public error code;
  unexpected errors are logged and redacted.
- Supports isolated registries for tests/embedded hosts and a default singleton.

### `mmgisAPI.js`

Adds the one validated layer-opacity operation required by AgentChat, then
imports the default registry and assigns its four bound closure methods directly
to the existing public facade. No core actions or controller wrappers are
registered by this feature.

### Lifecycle compatibility

Default registration returns the existing string id and supports
`unregister(id, plugin)`. With `returnHandle`, the registry returns a frozen
object whose identity maps to an internal generation token. Same-owner
`replaceExisting` swaps the entry atomically. A stale handle then fails closed
instead of deleting the replacement.

## JSON Schema decision

Adding a general-purpose validator dependency would expand this narrowly scoped
host change and its browser bundle. Instead, the registry implements a safe,
documented subset needed by tool descriptors: primitive types/values, object
properties and required/additional-property rules, homogeneous arrays, string
length, and numeric range/multiple rules. Unsupported keywords are rejected at
registration so discovery never overstates enforcement.

## Limits and failure behavior

| Boundary | Default |
|---|---:|
| Registry actions | 128 |
| Registry descriptor bytes | 512 KiB |
| One schema | 32 KiB / depth 12 / 2,048 nodes |
| Arguments | 64 KiB / depth 16 / 4,096 nodes |
| Result | 256 KiB / depth 16 / 8,192 nodes |
| Availability | 2 seconds |
| Handler | 30 seconds |

Developer contract errors throw during registration. Model/client execution
errors return a frozen normalized failure. Thrown handler/availability details
are provided only to the configured logger.

## Testing strategy

- Direct unit tests create isolated registries and cover positive behavior plus
  schema mismatch, unsupported schema, all major bounds, circular/non-JSON
  values, timeout signals, redaction, collisions, ownership, result
  normalization, immutable descriptors, and stale HMR handles.
- The existing browser MMGIS API suite checks the actual `window.mmgisAPI`
  wiring across a complete register/list/invalid execute/valid execute/unregister
  lifecycle.
- Focused ESLint and `git diff --check` cover changed source/tests/docs.

## Constitution check

- **I Documentation-First**: This narrow spec, plan, tasks, and plugin API
  contract accompany the implementation for independent review.
- **II Clear Requirements**: Functional requirements map to observable unit or
  browser assertions.
- **III Incremental Delivery**: The host registry is additive and independently
  mergeable before any AgentChat or Analysis integration.
- **IV Quality Standards**: Focused automated tests cover every trust boundary;
  lint and whitespace checks are part of handoff.
- **V Node.js Best Practices**: Async work uses promises, finite timeouts,
  explicit errors, and no new dependencies or blocking I/O.
- **VI Geospatial Data Integrity**: The registry does not interpret or mutate
  geospatial data; action implementations retain responsibility for CRS and
  data-integrity rules.
- **VII Real-time Collaboration Safety**: No WebSocket, shared editing, or
  collaboration state changes are introduced.

## Rollback

Remove the four facade properties/import and registry module. No persisted data,
configuration, migration, or generated artifact requires cleanup.
