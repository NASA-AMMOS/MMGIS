# `plugin.json` Field Reference

Every MMGIS plugin has a `plugin.json` manifest at the root of its directory. This document describes every recognized field, its type, default behavior, and which plugin types use it.

---

## Required Fields

### `name`

| | |
|---|---|
| **Type** | `string` |
| **Required** | Yes (all types) |
| **Validated** | Must be a non-empty string for tools and components. Recommended but optional for backends. |

The canonical name of the plugin. Used as the display name in the CLI, configure page, and internal lookups. Should match the directory name by convention.

```json
"name": "Draw"
```

### `paths`

| | |
|---|---|
| **Type** | `object` — `{ [entryName: string]: string }` |
| **Required** | Yes (tools and components only) |
| **Validated** | Must be a non-empty object with string values. |

Maps entry-point names to their file paths (relative to the project root, prefixed with `../plugins/`). For tools, the key is typically `<Name>Tool`. For components, it's the component name.

These paths are written into `src/pre/tools.js` and `src/pre/components.js` as webpack dynamic imports — they must resolve at build time.

```json
// Tool
"paths": {
    "DrawTool": "../plugins/core/tools/Draw/DrawTool"
}

// Component
"paths": {
    "TimeUI": "../plugins/core/components/TimeUI/TimeUI"
}
```

---

## Recommended Fields

### `type`

| | |
|---|---|
| **Type** | `string` — one of `"tool"`, `"component"`, `"backend"` |
| **Required** | No (inferred from directory structure) |
| **Validated** | If present, must be one of the three values above. |

Declares the plugin type. Uses **singular** form even though directory names are plural (`tools/`, `components/`). If omitted, the type is inferred from the parent directory name.

```json
"type": "tool"
```

### `version`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |
| **Validated** | Must be a string if present. |

Semantic version of the plugin. Core plugins use `"core"` which resolves to the MMGIS application version at runtime.

```json
"version": "1.2.0"
```

### `defaultIcon`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |
| **Default behavior** | Falls back to `"puzzle-outline"` in the toolbar and configure page if not set. |
| **Applies to** | Tools, Components |

The icon displayed in the toolbar and configure page. Uses [Ionicons](https://ionic.io/ionicons) icon names.

```json
"defaultIcon": "pencil"
```

---

## Identity Fields

### `id`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

A short human-friendly identifier, typically `<container>-<name>` in lowercase. Not used for lookups — the runtime ID is computed as `<container>/<type>/<name>`.

```json
"id": "core-draw"
```

### `uuid`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

A UUID for the plugin. Currently informational — not used in any lookup or logic. May become relevant if a plugin registry/marketplace is added in the future.

```json
"uuid": "36d8748f-7a3a-4a13-86e5-9d7ed863a182"
```

### `display_name`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

A human-friendly display name, potentially different from `name`. Used in the `info` command output when present.

```json
"display_name": "User Management"
```

### `aliases`

| | |
|---|---|
| **Type** | `string[]` |
| **Required** | No |

Alternative names for the plugin. Currently informational — may be used in future CLI lookup resolution.

```json
"aliases": ["users", "auth"]
```

---

## Protection & Behavior Fields

### `required`

| | |
|---|---|
| **Type** | `boolean` |
| **Required** | No |
| **Default behavior** | `false` — plugin can be disabled and destroyed. |

When `true`, the plugin cannot be disabled (`disable`) or destroyed (`destroy`). Used for critical infrastructure plugins that must always be active (e.g., Users, Config, Accounts backends).

Also implied by `overridable: false` — a plugin with `overridable: false` is treated as required even without explicitly setting `required: true`.

```json
"required": true
```

### `overridable`

| | |
|---|---|
| **Type** | `boolean` |
| **Required** | No |
| **Default behavior** | `true` — another plugin with the same name from a later container can replace this one. |

When `false`:
1. No other plugin can override this one (discovery rejects duplicates).
2. The plugin is treated as **required** — it cannot be disabled or destroyed.

```json
"overridable": false
```

### `tier`

| | |
|---|---|
| **Type** | `string` — one of `"core"`, `"community"`, `"private"`, `"official"`, `"experimental"`, `"deprecated"` |
| **Required** | No |
| **Validated** | If present, must be one of the six values above. |

A classification tag displayed in the CLI's `list` and `info` output. Helps users understand the provenance and stability of a plugin.

| Value | Intended meaning |
|-------|-----------------|
| `core` | Ships with MMGIS |
| `official` | Maintained by the MMGIS team but distributed separately |
| `community` | Third-party contributed |
| `private` | Internal/organization-specific |
| `experimental` | Unstable, API may change |
| `deprecated` | Scheduled for removal, not recommended for new use |

```json
"tier": "community"
```

---

## Metadata Fields

### `description`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

A one-line summary of the plugin's purpose. Shown in `list --json` and `info` output.

```json
"description": "Advanced and collaborative map drawing."
```

### `descriptionFull`

| | |
|---|---|
| **Type** | `object` |
| **Required** | No |
| **Applies to** | Tools, Components |

An extended description object. Typically has a `title` (long description string) and an `example` (sample configuration object showing all available variables).

```json
"descriptionFull": {
    "title": "The Draw tool is an advanced vector data creation and editing tool...",
    "example": {
        "intents": ["Polygon_1", "Line_1"],
        "defaultDrawClipping": "over"
    }
}
```

### `author`

| | |
|---|---|
| **Type** | `string` or `object` |
| **Required** | No |

Plugin author. Can be a simple string or an object with `name`, `email`, `url` fields.

```json
"author": "NASA-AMMOS/MMGIS"
```

### `license`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

SPDX license identifier.

```json
"license": "Apache-2.0"
```

### `repository`

| | |
|---|---|
| **Type** | `string` |
| **Required** | No |

URL of the plugin's source repository.

```json
"repository": "https://github.com/NASA-AMMOS/MMGIS"
```

### `keywords`

| | |
|---|---|
| **Type** | `string[]` |
| **Required** | No |

Tags for categorization and search.

```json
"keywords": ["drawing", "annotation", "collaboration"]
```

---

## Tool-Specific Fields

### `toolbarPriority`

| | |
|---|---|
| **Type** | `number` |
| **Required** | No |
| **Applies to** | Tools |

Controls the tool's position in the toolbar. Lower numbers appear first. Core tools range from ~1001–1020.

```json
"toolbarPriority": 1001
```

### `expandable`

| | |
|---|---|
| **Type** | `boolean` |
| **Required** | No |
| **Applies to** | Tools |

Whether the tool panel can be expanded to full width.

```json
"expandable": true
```

### `separatedTool`

| | |
|---|---|
| **Type** | `boolean` or `string` |
| **Required** | No |
| **Applies to** | Tools |

When set, the tool is rendered separately from the main tool panel. Used for tools that need a different layout context.

### `hasVars`

| | |
|---|---|
| **Type** | `boolean` |
| **Required** | No |
| **Applies to** | Tools, Components |

Indicates that the plugin reads per-mission configuration variables from `config.rows`. When `true`, the configure page shows the configuration UI defined in the `config` field.

```json
"hasVars": true
```

### `config`

| | |
|---|---|
| **Type** | `object` — `{ rows: ConfigRow[] }` |
| **Required** | No |
| **Applies to** | Tools, Components |

Defines the configuration UI shown in the MMGIS configure page. Each row has a `name`, `description`, and array of `components` (form fields like text inputs, dropdowns, checkboxes, etc.).

```json
"config": {
    "rows": [
        {
            "name": "Intent Aliases",
            "description": "Names for the five group-editable files.",
            "components": [
                {
                    "field": "variables.intents.0",
                    "name": "Polygon 1 Alias",
                    "type": "text",
                    "width": 2
                }
            ]
        }
    ]
}
```

### `kinds`

| | |
|---|---|
| **Type** | `object` |
| **Required** | No |
| **Applies to** | Tools |

Defines sub-types or modes for the tool. Used by the Kinds tool for layer-type-specific behavior.

---

## Backend-Specific Fields

### `priority`

| | |
|---|---|
| **Type** | `number` |
| **Required** | No |
| **Default behavior** | `1000` |
| **Applies to** | Backend |

Controls the order in which backend plugins are initialized. Lower numbers initialize first. Useful when one backend depends on another being set up first.

```json
"priority": 500
```

### `routes`

| | |
|---|---|
| **Type** | `object` — `{ prefix: string, auth?: string }` |
| **Required** | No |
| **Applies to** | Backend |

Informational metadata about the plugin's Express routes. Not used by the runtime (routes are registered in `plugin.js`), but documents the API surface.

```json
"routes": {
    "prefix": "/api/users",
    "auth": "public"
}
```

### `envs`

| | |
|---|---|
| **Type** | `object` |
| **Required** | No |
| **Applies to** | Backend |

Documents environment variables that the backend plugin reads. Informational — not validated at runtime.

```json
"envs": {
    "SIGHTLINE_API_KEY": "API key for external sightline service"
}
```

---

## Dependency Fields

### `dependencies`

| | |
|---|---|
| **Type** | `object` |
| **Required** | No |
| **Validated** | Structure is validated if present. |

Declares runtime dependencies that the plugin needs installed. Aggregated by the `deps` CLI command and `scripts/resolve-plugin-deps.js`.

```json
"dependencies": {
    "npm": {
        "@ffmpeg/ffmpeg": "^0.12.10",
        "gifshot": "^0.4.5"
    },
    "python": {
        "pip": ["numpy>=1.21", "scipy"],
        "conda": ["gdal>=3.0"]
    }
}
```

**Sub-fields:**
- `npm` — Object mapping npm package names to semver ranges.
- `python.pip` — Array of pip requirement strings.
- `python.conda` — Array of conda package strings.

### `peerDependencies`

| | |
|---|---|
| **Type** | `object` — `{ [pluginId: string]: string }` |
| **Required** | No |

Declares other MMGIS plugins that must be present for this plugin to work. The `deps` command checks for peer warnings.

```json
"peerDependencies": {
    "core/backend/Draw": ">=1.0.0"
}
```

### `engines`

| | |
|---|---|
| **Type** | `object` — `{ [runtime: string]: string }` |
| **Required** | No |
| **Validated** | Must be an object if present. |

Declares required runtime versions (e.g., MMGIS version, Node.js version). Currently informational — not enforced at runtime.

```json
"engines": {
    "mmgis": ">=5.0.0",
    "node": ">=22.0.0"
}
```

---

## Minimal Examples

### Tool

```json
{
    "name": "SpectralAnalysis",
    "type": "tool",
    "defaultIcon": "puzzle-outline",
    "description": "Spectral data analysis and visualization.",
    "paths": {
        "SpectralAnalysisTool": "../plugins/my-plugins/tools/SpectralAnalysis/SpectralAnalysisTool"
    }
}
```

### Backend

```json
{
    "name": "DataIngest",
    "type": "backend",
    "description": "Ingests external data feeds into MMGIS."
}
```

### Component

```json
{
    "name": "TimeSlider",
    "type": "component",
    "defaultIcon": "puzzle-outline",
    "description": "A temporal navigation slider.",
    "paths": {
        "TimeSlider": "../plugins/my-plugins/components/TimeSlider/TimeSlider"
    }
}
```

---

## Validation

Run `npm run plugins -- validate` to check all manifests. The validator:
- **Errors** on missing required fields, wrong types, invalid enum values.
- **Warns** on unrecognized top-level fields (forward compatibility — the field is preserved).
- Unknown fields do **not** cause validation failure.

See `API/pluginValidation.js` for the implementation.
