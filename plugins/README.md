# MMGIS Plugin System

MMGIS uses a plugin-based architecture for tools, backend modules, and components. Plugins are organized under `/plugins/` in a three-level hierarchy: `<container>/<type>/<PluginName>/`.

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Key Files](#key-files)
3. [Quick Start](#quick-start)
4. [CLI Commands](#cli-commands)
5. [Plugin Types](#plugin-types)
6. [Installing Plugins](#installing-plugins)
7. [Creating Plugins](#creating-plugins)
8. [`plugin.json` Reference](#pluginjson-reference)
9. [Discovery & State](#discovery--state)
10. [Webpack Aliases](#webpack-aliases)
11. [Validation](#validation)
12. [Registries](#registries)
13. [Testing Plugins](#testing-plugins)
14. [Migrating from Legacy Formats](#migrating-from-legacy-formats)
15. [AI Agent Notes](#ai-agent-notes)

---

## Directory Structure

```
plugins/                       # containers only — the CLI lives in /plugin-cli
├── plugin-state.json          # Enable/disable state per plugin (gitignored)
├── README.md                  # This file
├── core/                      # Core plugins (committed, version-controlled)
│   ├── tools/                 # Frontend tools (Draw, Measure, Legend, etc.)
│   ├── backend/               # Server modules (Accounts, Config, Users, etc.)
│   ├── components/            # UI components (OperationsClock, etc.)
│   ├── interactions/          # Feature interaction handlers (Select, InfoOpen, etc.)
│   ├── layertypes/            # Layer renderers (Vector, Tile, Model, etc.)
│   └── layerattachments/      # Per-feature extras (Labels, PathGradient, etc.)
└── <org--repo>/               # Installed from git (org--repo naming, gitignored)
    ├── tools/
    ├── backend/
    ├── components/
    ├── interactions/
    ├── layertypes/
    └── layerattachments/
```

## Key Files

| File | Purpose |
|------|---------|
| `plugin-cli/cli.js` | CLI for plugin management (`npm run plugins -- <cmd>`) |
| `plugin-cli/scaffolds/<type>/` | What `create <type>` copies — the starting point for each family |
| `plugin-cli/registries.json` | Git URLs / local paths of known plugin sources |
| `plugins/plugin-state.json` | Enable/disable state (gitignored, instance-specific) |
| `API/pluginDiscovery.js` | Discovery logic — `discoverPlugins()` scans all containers |
| `API/pluginValidation.js` | Manifest validation — `validatePluginConfig()` |
| `API/updateTools.js` | Build-time tool/component discovery → generates `src/pre/tools.js` |
| `API/setups.js` | Runtime backend discovery → loads `plugin.js` lifecycle hooks |
| `scripts/resolve-plugin-deps.js` | Aggregates plugin dependencies for build |

## Quick Start

```bash
# List all plugins
npm run plugins -- list

# Create a new plugin
npm run plugins -- create tool MyTool --container my-plugins

# Install from a git repo (clones to plugins/org--mmgis-geo-plugins/)
npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git

# Enable/disable a specific plugin
npm run plugins -- enable my-plugins/tools/SpectralTool
npm run plugins -- disable SpectralTool

# Validate all plugin manifests
npm run plugins -- validate

# Show dependency graph
npm run plugins -- deps

# Plugin details
npm run plugins -- info Draw

# Machine-readable output (works with all commands)
npm run plugins -- list --json
npm run plugins -- validate --json
```

## CLI Commands

All commands support `--json` for machine-readable output. Use `npm run plugin` or `npm run plugins` interchangeably.

| Command | Description |
|---------|-------------|
| `list` | List all plugins with enabled/disabled status |
| `info <plugin-id>` | Show detailed metadata for a plugin |
| `validate` | Validate all `plugin.json` manifests |
| `deps` | Show aggregated npm/pip/conda dependencies with conflict detection |
| `install <git-url\|path\|name>` | Install a plugin repo (git clone, local copy, or registry name) |
| `uninstall <repo-name>` | Uninstall an installed plugin repo (cannot uninstall `core`) |
| `enable <plugin-id>` | Mark a plugin as active in `plugin-state.json` |
| `disable <plugin-id>` | Mark a plugin as inactive (cannot disable `required` plugins) |
| `enable-all` | Enable all plugins (use `--container` to scope) |
| `disable-all` | Disable all non-required plugins (use `--container` to scope) |
| `create <type> <Name>` | Scaffold a new plugin (tool, backend, component, interaction) |
| `destroy <plugin-id>` | Delete a plugin (prompts confirmation, `--force` to skip) |
| `activate` | Regenerate frontend plugin imports without a full build |
| `update [repo-name]` | `git pull` latest for one or all installed repos |
| `registry add\|remove\|list` | Manage plugin source URLs |
| `help` | Show CLI help |

### Flags

| Flag | Applies to | Description |
|------|-----------|-------------|
| `--json` | all | Output machine-readable JSON. Errors also emit JSON: `{"error":"..."}` |
| `--no-color` | all | Disable colored output (also respects `NO_COLOR` env) |
| `--link` | `install` | Symlink local paths instead of copy (falls back to junction on Windows) |
| `--container <name>` | `create`, `enable-all`, `disable-all` | Target container |
| `--only <names>` | `install` | Comma-separated plugin names to keep enabled (disables the rest) |
| `--force` | `create`, `destroy` | Allow scaffolding into `core`; skip destroy confirmation prompt |
| `--tier <tier>` | `registry add` | Set tier (`core`, `official`, `community`, `private`, `experimental`, `deprecated`) |
| `--description <text>` | `registry add` | Set description |
| `--license <spdx>` | `registry add` | Set license (e.g. `Apache-2.0`) |
| `--author <name>` | `registry add` | Set author |

### Plugin IDs

Plugins are identified as `<container>/<type>/<name>` (e.g. `core/tools/Draw`). For convenience, the CLI also accepts just `<name>` and matches the first plugin found.

## Plugin Types

### Tools

Frontend UI tools that appear in the MMGIS toolbar. Directory name is plural (`tools/`) but manifest type is singular (`"type": "tool"`).

Must implement `make()` and `destroy()` lifecycle methods.

**Required manifest fields**: `name`, `paths` (mapping of tool name → entry point).

### Backend

Server-side Express modules. Have `plugin.json` (metadata) + `plugin.js` (lifecycle hooks: `onceInit`, `onceStarted`, `onceSynced`). Routes go in `routes/`, models in `models/`.

**Required manifest fields**: `name` (recommended but optional — backends are keyed by directory name).

### Components

UI components loaded into the MMGIS interface. Directory name is plural (`components/`) but manifest type is singular (`"type": "component"`).

**Required manifest fields**: `name`, `paths`.

### Interactions

Composable handlers that run when a user interacts with a map feature (click, hover, mouseout). Directory name is plural (`interactions/`) but manifest type is singular (`"type": "interaction"`). They replace the legacy `Kinds` system — instead of one hardcoded "kind" per layer, a layer's behavior is a **pipeline** of small, single-purpose interactions.

**Required manifest fields**: `name`, `interactionId`, `paths`.

#### The `use(ctx)` handler

Each interaction exports an object with a `use(ctx)` method. `use` may be `async`; the runner awaits it. The `ctx` object carries everything the handler needs:

| `ctx` field | Description |
|-------------|-------------|
| `Map_` | The `Map_` singleton |
| `feature` | The clicked/hovered GeoJSON feature |
| `layer` | The Leaflet layer |
| `layerName` | Name of the layer |
| `layerData` | The layer's config object (`L_.layers.data[layerName]`) |
| `layerVar` | Shorthand for `layerData.variables` |
| `event` | The originating Leaflet event |
| `eventType` | `"click"`, `"hover"`, or `"mouseout"` |
| `additional` | Event-specific extra data (or `null`) |
| `stop` | Set to `true` to halt the rest of the pipeline |
| `state` | Shared object interactions can read/write to pass data down the pipeline |

```js
const FeatureGlow = {
    use(ctx) {
        if (!ctx.feature) return
        // do something with ctx.feature / ctx.layer ...
        // ctx.state can carry data to later interactions
        // set ctx.stop = true to halt the pipeline
    },
}

export default FeatureGlow
```

#### Phases & pipeline order

Every interaction declares a `phase`. A layer's effective click pipeline is built as **preamble → main → postamble**, so infrastructure behavior runs consistently around whatever the layer is configured to do:

| Phase | Runs | Example interactions |
|-------|------|----------------------|
| `preamble` | Always, before the main behavior | `select` (order 0) |
| `main` | The layer's configured behavior | `info:open`, `waypoint:image`, `viewer:open_panel` |
| `postamble` | Always, after the main behavior | `info:silent`, `viewer:update`, `search:url`, `event:notify` |

Within a phase, interactions are ordered by their `order` field. A layer chooses its `main`-phase interactions either explicitly via `layerData.interactions.<event>` or implicitly via the legacy `kind` string (mapped through `kindAlias` — see below). The preamble/postamble are always applied by the runner.

Mission administrators configure these behaviors in the layer modal's **Interactions** tab. The default Kind picker is populated from enabled plugins' `kindAlias` values and previews the effective pipeline. **Customize pipeline** converts that preset into an ordered list of `main` click interactions, which can be added, removed, and rearranged. Preamble and postamble interactions are shown as locked infrastructure, including any active suppression rules. Returning to **Kind preset** removes only the explicit click pipeline and preserves any separately configured pointer-event pipelines.

An interaction can declare `suppresses` to replace a default when present — e.g. `info:open` (main) suppresses `info:silent` (postamble) so the panel isn't populated twice.

#### Generated file & runtime

At build time, `updateInteractions()` (`API/updateTools.js`) discovers all enabled interactions, enforces `pluginDependencies` (an interaction whose dependency is missing/disabled is excluded), and generates `src/pre/interactions.js` with static imports plus the phase arrays, suppression map, and kind-alias map. The runtime executor `src/essence/Basics/InteractionRunner/InteractionRunner.js` reads that generated data — it contains **no hardcoded interaction IDs**. All orchestration lives in the manifests.

### Layer Types

How a layer of a given `layer.type` (`vector`, `tile`, `model`, …) is drawn and managed on each rendering surface. Directory name is plural (`layertypes/`), manifest type is singular (`"type": "layertype"`).

**Required manifest fields**: `name`, `typeId` (the value a mission config's `layer.type` names), `capabilities.renderers`, and `modules` (or `module`) unless the type inherits everything through `extends`.

The renderer contract — surfaces, the seven operations, phases, `extends` — is documented in [`core/layertypes/README.md`](./core/layertypes/README.md).

### Layer Attachments

Extra renderables and decorations built onto a host layer's features: labels, uncertainty ellipses, path gradients, bearing-oriented markers. Directory name is plural (`layerattachments/`), manifest type is singular (`"type": "layerattachment"`).

**Required manifest fields**: `name`, `attachmentId`, `configPath` (the layer-config subtree the attachment owns, e.g. `variables.markerAttachments.image`), `applicableLayerTypes`, and `module`.

## Installing Plugins

### From a Git Repository

```bash
npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git
```

This clones the repository into `plugins/org--mmgis-geo-plugins/`. The container directory uses `org--repo` naming (double-hyphen separator) so that repos with the same name under different organizations don't collide. The repo must follow the standard directory structure with `tools/`, `backend/`, and/or `components/` subdirectories.

### By Registry Name

If the argument isn't a URL or existing path, the CLI looks it up in `plugin-registries.json` by name:

```bash
# First, register a source (or use a pre-populated registries file)
npm run plugins -- registry add https://github.com/org/mmgis-geo-plugins.git --tier official

# Then install by name
npm run plugins -- install mmgis-geo-plugins
```

This resolves the name to its registered URL and clones/copies from there.

### Selective Install with `--only`

When installing a repo with many plugins but you only need a few:

```bash
npm run plugins -- install mmgis-geo-plugins --only SpectralTool,ElevationTool
```

This installs the full repo (so `update` works later) but immediately disables all plugins except the ones listed. Disabled plugins are excluded from the build and server — no code or dependencies are bundled.

You can also use `disable-all` / `enable` for the same effect after install:

```bash
npm run plugins -- install mmgis-geo-plugins
npm run plugins -- disable-all --container mmgis-geo-plugins
npm run plugins -- enable mmgis-geo-plugins/tools/SpectralTool
npm run plugins -- enable mmgis-geo-plugins/tools/ElevationTool
```

### From a Local Path

```bash
npm run plugins -- install /path/to/my-plugin-repo
```

This copies the directory into `plugins/<dirname>/` (local paths use the directory basename as-is since there is no org to infer). To create a symlink instead (useful during active development so changes are reflected immediately), use the `--link` flag:

```bash
npm run plugins -- install --link /path/to/my-plugin-repo
```

On Windows, if symlink creation fails due to permissions, `--link` falls back to a directory junction automatically.

### After Installing

- Frontend plugins are auto-activated by the CLI (regenerates `src/pre/tools.js`, `src/pre/components.js`, and `src/pre/interactions.js`). In dev mode, webpack-dev-server hot-reloads automatically. For production, run `npm run build`.
- Restart the server to activate backend plugins.
- Run `npm run plugins:install` to install any new npm/pip dependencies declared by the plugins.

## Creating Plugins

The fastest way to create a new plugin is with the `create` command:

```bash
# Create a tool
npm run plugins -- create tool MyTool --container my-plugins

# Create a backend module
npm run plugins -- create backend MyModule --container my-plugins

# Create a component
npm run plugins -- create component MyWidget --container my-plugins

# Container is auto-created if it doesn't exist
npm run plugins -- create tool AnotherTool --container my-plugins

# Core scaffolding requires explicit confirmation
npm run plugins -- create interaction CoreInteraction --container core --force
```

This scaffolds the directory structure, `plugin.json`, entry point, CSS, and a test spec. Frontend plugins are auto-activated.

### Tool Template

Directory structure (scaffolded by `create tool`):
```
plugins/<container>/tools/MyTool/
├── plugin.json
├── MyToolTool.js
├── MyToolTool.css
└── tests/
    └── myToolTool.spec.js
```

**`plugin.json`** (minimal required):
```json
{
    "name": "MyTool",
    "type": "tool",
    "defaultIcon": "puzzle-outline",
    "description": "Short description of what this tool does.",
    "paths": {
        "MyToolTool": "./MyToolTool"
    }
}
```

**`MyToolTool.js`**:
```js
import React from 'react'
import { createRoot } from 'react-dom/client'

import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

import './MyToolTool.css'

let MyToolTool = {
    height: 0,
    width: 300,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        MyToolTool._root = createRoot(toolPanel)
        MyToolTool._root.render(
            <div className='myToolTool'>
                MyTool
            </div>
        )
    },

    destroy: function () {
        if (MyToolTool._root) {
            MyToolTool._root.unmount()
            MyToolTool._root = null
        }
    },
}

export default MyToolTool
```

### Backend Template

Directory structure:
```
plugins/<container>/backend/MyModule/
├── plugin.json
├── plugin.js
├── routes/
│   └── myModule.js
└── tests/
    └── myModule.spec.js
```

**`plugin.json`**:
```json
{
    "name": "MyModule",
    "type": "backend",
    "version": "1.0.0",
    "description": "A custom backend module."
}
```

**`plugin.js`**:
```js
const router = require("./routes/myModule");

let setup = {
    // Once the app initializes — register routes
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + "/api/mymodule",
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        );
    },
    // Once the server starts
    onceStarted: (s) => {},
    // Once all database tables sync
    onceSynced: (s) => {},
};

module.exports = setup;
```

### Component Template

Directory structure:
```
plugins/<container>/components/MyComponent/
├── plugin.json
├── MyComponent.js
├── MyComponent.css
└── tests/
    └── myComponent.spec.js
```

**`plugin.json`**:
```json
{
    "name": "MyComponent",
    "type": "component",
    "defaultIcon": "puzzle-outline",
    "description": "A custom UI component.",
    "paths": {
        "MyComponent": "./MyComponent"
    }
}
```

### Interaction Template

Directory structure (scaffolded by `create interaction`):
```
plugins/<container>/interactions/FeatureGlow/
├── plugin.json
├── FeatureGlow.js
└── tests/
    └── featureGlow.spec.js
```

**`plugin.json`** (scaffolded — `interactionId` is auto-derived from the name, e.g. `FeatureGlow` → `feature:glow`):
```json
{
    "name": "FeatureGlow",
    "type": "interaction",
    "interactionId": "feature:glow",
    "description": "",
    "applicableLayerTypes": ["vector", "vectortile", "query"],
    "applicableEvents": ["click"],
    "phase": "main",
    "paths": {
        "FeatureGlow": "./FeatureGlow"
    }
}
```

**`FeatureGlow.js`**:
```js
const FeatureGlow = {
    use(ctx) {
        // ctx.feature   — the clicked GeoJSON feature
        // ctx.layer     — the Leaflet layer
        // ctx.layerName — name of the layer
        // ctx.state     — shared state between interactions
        // ctx.stop      — set to true to halt the pipeline
    },
}

export default FeatureGlow
```

After editing, set `interactionId`, `phase`, and `order`, then run `npm run build` (or `npm run plugins -- activate`) to regenerate `src/pre/interactions.js`. If the interaction depends on a tool, declare it in `pluginDependencies` (e.g. `["core/tools/Info"]`) — it will be excluded from the generated file if that dependency isn't enabled.

---

## `plugin.json` Reference

Every MMGIS plugin has a `plugin.json` manifest at the root of its directory. This section describes every recognized field.

### Required Fields

#### `name`

**Type:** `string` · **Required:** Yes (all types)

The canonical name of the plugin. Used as the display name in the CLI, configure page, and internal lookups. Should match the directory name by convention.

#### `paths`

**Type:** `object` — `{ [entryName: string]: string }` · **Required:** Yes (tools, components, and interactions)

Maps entry-point names to their file paths relative to the plugin's own directory. For tools, the key is typically `<Name>Tool`. For components, it's the component name. A key here is an **export name** — it is what a mission config names in `"js"` — which is why layer types and layer attachments declare their implementation with `modules`/`module` instead: their keys are render surfaces, not identifiers.

These paths are resolved at build time and written into `src/pre/tools.js` and `src/pre/components.js` as webpack imports. Use `./` prefix for paths relative to the plugin directory.

```json
"paths": {
    "DrawTool": "./DrawTool"
}
```

Plugins with multiple entry points:

```json
"paths": {
    "SightlineTool": "./SightlineTool",
    "SightlineTool_Algorithm": "./SightlineTool_Algorithm"
}
```

#### `modules`

**Type:** `object` — `{ [surface: string]: string | { [engine: string]: string } }` · **Applies to:** Layer types

Maps the **render surfaces** a layer type implements to their modules, relative to the plugin's directory. Surfaces are `map`, `globe.<engine>`, `config`, `filter`, `time` and `capture`; all are optional, and startup validation cross-checks them against `capabilities.renderers`.

```json
"modules": {
    "map": "./map/tile",
    "globe": { "cesium": "./globe/cesium/tile" }
}
```

#### `module`

**Type:** `string` · **Required:** Yes (layer attachments) · **Applies to:** Layer attachments, layer types

One module implementing the whole plugin. An attachment is a single renderable even when it spans both engines, so it always uses this. A layer type may use it instead of `modules` when it is small enough not to want a file per surface — the module then exports the surface keys (`{ map, globe, config, … }`).

```json
"module": "./labels"
```

### Recommended Fields

#### `type`

**Type:** `string` — one of `"tool"`, `"component"`, `"backend"`, `"interaction"`, `"layertype"`, `"layerattachment"` · **Required:** No (inferred from directory structure)

Uses **singular** form even though directory names are plural (`tools/`, `components/`).

#### `version`

**Type:** `string`

Either a semantic version or the sentinel `"core"`, which resolves to the MMGIS application version at runtime and is what every plugin shipped in this repository uses. Any other value is a validation error.

#### `defaultIcon`

**Type:** `string` · **Default:** `"puzzle-outline"` · **Applies to:** Tools, Components

Icon displayed in the toolbar and configure page. Uses [Ionicons](https://ionic.io/ionicons) icon names.

### Identity Fields

#### `id`

**Type:** `string`

A short human-friendly identifier, typically `<container>-<name>` in lowercase. Not used for lookups — the runtime ID is computed as `<container>/<type>/<name>`.

#### `uuid`

**Type:** `string`

Currently informational — not used in any lookup or logic. May become relevant if a plugin marketplace is added.

#### `display_name`

**Type:** `string`

A human-friendly display name, potentially different from `name`.

#### `aliases`

**Type:** `string[]`

Alternative names for the plugin. Currently informational — may be used in future CLI lookup resolution.

### Protection & Behavior Fields

#### `required`

**Type:** `boolean` · **Default:** `false`

When `true`, the plugin cannot be disabled (`disable`) or destroyed (`destroy`). Used for critical infrastructure plugins (e.g., Users, Config, Accounts). Also implied by `overridable: false`.

#### `overridable`

**Type:** `boolean` · **Default:** `true`

When `false`: (1) no other plugin can override this one, and (2) the plugin is treated as **required** — it cannot be disabled or destroyed.

#### `tier`

**Type:** `string` — one of `"core"`, `"community"`, `"private"`, `"official"`, `"experimental"`, `"deprecated"`

A classification tag displayed in CLI output.

| Value | Meaning |
|-------|---------|
| `core` | Ships with MMGIS |
| `official` | Maintained by the MMGIS team, distributed separately |
| `community` | Third-party contributed |
| `private` | Internal/organization-specific |
| `experimental` | Unstable, API may change |
| `deprecated` | Scheduled for removal |

### Metadata Fields

#### `description`

**Type:** `string`

A one-line summary. Shown in `list --json` and `info` output.

#### `descriptionFull`

**Type:** `object` — `{ title: string, example: object }`

Extended description with a long-form `title` and an `example` object showing all available configuration variables.

#### `author` / `license` / `repository` / `keywords`

Standard package metadata. `author` can be a string or `{ name, email, url }`. `license` is an SPDX identifier. `keywords` is a `string[]`.

### Tool-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `toolbarPriority` | `number` | Position in toolbar (lower = first). Core tools range ~1001–1020 |
| `expandable` | `boolean` | Whether the tool panel can expand to full width |
| `separatedTool` | `boolean\|string` | Renders the tool separately from the main tool panel. `true` gives a standard framed floating panel (header + close). `"custom"` renders a chrome-less panel and lets the tool manage its own DOM inside `#toolContentSeparated_<Name>` — use this when the tool draws its own window/overlay (e.g. Identifier) |
| `hasVars` | `boolean` | Plugin reads per-mission config variables from `config.rows` |
| `config` | `object` | Defines the configuration UI shown in the configure page. Has `rows[]` with form field definitions |
| `kinds` | `object` | Sub-types or modes for the tool (used by Kinds tool) |

#### Opening and closing a tool programmatically

A `"custom"` separated tool owns its own UI, so its close button must tell MMGIS to tear the tool down — otherwise the toolbar button stays highlighted. Use the type-agnostic API on the global `ToolController_` (keyed by tool name); both calls no-op if the tool is already in the requested state:

```js
window.ToolController_.openTool('AgentChat')   // open (separated or regular)
window.ToolController_.closeTool('AgentChat')  // close and clear the toolbar highlight
```

### Backend-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `priority` | `number` | Initialization order (lower = first, default 1000) |
| `routes` | `object` | Informational: `{ prefix, auth }` documenting the API surface |
| `envs` | `object` | Documents environment variables the plugin reads |

### Interaction-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `interactionId` | `string` | **Required.** The ID used in layer pipelines and to reference the interaction (e.g. `select`, `info:open`, `waypoint:image`). |
| `phase` | `string` | One of `"preamble"`, `"main"`, `"postamble"`. Determines pipeline position. Defaults to `"main"`. |
| `order` | `number` | Sort key within a phase (lower = first). Used to order multiple interactions in the same phase. |
| `suppresses` | `string[]` | Interaction IDs this one replaces when present in the pipeline (e.g. `info:open` suppresses `["info:silent"]`). |
| `kindAlias` | `string[]` | Legacy `kind` strings this interaction maps to for backward compatibility (e.g. `["waypoint"]`). Multiple interactions may share a `kindAlias` — all of them run, ordered by `order`. |
| `applicableEvents` | `string[]` | Event types this interaction handles: `"click"`, `"hover"`, `"mouseout"`. |
| `applicableLayerTypes` | `string[]` | Layer types this interaction applies to (e.g. `["vector", "vectortile", "query"]`). |

Interactions also commonly set `overridable: false` (infrastructure interactions like `select` can't be overridden or disabled) and `pluginDependencies` (see below) to declare a required tool.

**How `kindAlias` maps a `kind` to a pipeline:** at build time the `kindAlias` arrays across all interactions are inverted into a kind→interactions map. So `kind: "waypoint"` resolves to every interaction declaring `kindAlias: ["waypoint"]` (e.g. `waypoint:image` then `waypoint:model`), sorted by `order`. A layer can bypass this entirely by specifying `interactions.<event>` explicitly in its config.

### Dependency Fields

#### `dependencies`

Declares runtime dependencies. Aggregated by the `deps` command and `scripts/resolve-plugin-deps.js`.

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

#### `pluginDependencies`

Array of plugin IDs that this plugin depends on at runtime. Primarily used by tools to declare which backends they need.

**Type:** `string[]` · **Required:** No · **Default:** `[]`

```json
"pluginDependencies": ["core/backend/Draw", "core/backend/Utils"]
```

The CLI uses this field to:
- **`deps`**: Show an inter-plugin dependency graph and warn if a dependency is missing or disabled.
- **`disable`**: Warn when disabling a plugin that other enabled plugins depend on.
- **`info`**: Show "Depends on" and "Depended on by" relationships.

#### `peerDependencies`

Other MMGIS plugins that must be present (version-range checked). The `deps` command checks for peer warnings.

```json
"peerDependencies": { "core/backend/Draw": ">=1.0.0" }
```

#### `engines`

Required runtime versions. Enforced at registration time — if the current MMGIS version does not satisfy the declared range, the plugin is skipped with an error log.

```json
"engines": { "mmgis": ">=5.0.0", "node": ">=22.0.0" }
```

---

## Discovery & State

### Discovery Order

1. `core` container is always scanned first.
2. External containers scanned alphabetically.
3. Last-discovered plugin wins when names collide (allows overrides).
4. Plugins marked `"overridable": false` in their manifest block overrides.
5. Disabled plugins in `plugin-state.json` are skipped during discovery.

### Core & Required Protection

- Core plugins (`plugins/core/`) cannot be **uninstalled**, **destroyed**, or **disabled** via the CLI.
- `enable-all`/`disable-all` reject `--container core`.
- `create --container core` requires `--force`; without it, the CLI refuses to modify the repository-owned core container.
- Plugins with `"required": true` or `"overridable": false` cannot be **disabled** or **destroyed** regardless of container.

### Core Plugins

Core plugins ship with MMGIS and live in `plugins/core/`. They:

- Cannot be uninstalled or destroyed via the CLI.
- Use `"version": "core"` which auto-resolves to the MMGIS version.
- Are version-controlled with the main repository.
- Can be overridden by external plugins if `"overridable": true`.

### State File

`plugin-state.json` tracks which plugins are enabled or disabled. This file is:

- **Gitignored** — it is instance-specific configuration.
- **Optional** — if absent, all installed plugins are enabled by default.
- **Required-protected** — plugins with `required: true` or `overridable: false` are always enabled regardless of state.

```json
{
    "plugins": {
        "my-plugins/tools/SpectralTool": { "enabled": true },
        "my-plugins/tools/ExperimentalViewer": { "enabled": false }
    }
}
```

Disabled plugins are skipped during discovery — they won't be loaded by the build system or the server.

## Webpack Aliases

Frontend plugins can use these aliases instead of fragile relative paths:

| Alias | Resolves to |
|-------|-------------|
| `@basics` | `src/essence/Basics/` |
| `@essence` | `src/essence/` |
| `@design` | `src/design-system/` |
| `@pre` | `src/pre/` |
| `@external` | `src/external/` |

Backend plugins use Node.js `require()` with relative paths — aliases do not apply.

## Validation

Run `npm run plugins -- validate` to check all manifests. The validator:
- **Errors** on missing required fields, wrong types, invalid enum values.
- **Warns** on unrecognized top-level fields (forward compatibility — the field is preserved).
- Unknown fields do **not** cause validation failure.

```bash
npm run plugins -- validate          # Human-readable
npm run plugins -- validate --json   # Structured output with per-plugin results
```

See `API/pluginValidation.js` for the implementation.

## Registries

`plugin-registries.json` tracks known plugin sources. When you `install` a git-based plugin repo, it is automatically added. Local paths are validated on `registry add`.

```bash
npm run plugins -- registry add https://github.com/org/mmgis-plugins.git
npm run plugins -- registry add /local/path/to/plugins
npm run plugins -- registry list
npm run plugins -- registry remove mmgis-plugins

# Add with metadata
npm run plugins -- registry add https://github.com/NASA-AMMOS/mmgis-plugins.git \
    --tier official \
    --description "Official MMGIS plugin collection" \
    --license "Apache-2.0" \
    --author "NASA-AMMOS"
```

Registry entries can include optional metadata (`tier`, `description`, `license`, `author`) which is displayed in `registry list` and included in `--json` output. This metadata is set at add-time by the MMGIS administrator, not by the external repo.

## Testing Plugins

Plugin-specific tests live in `plugins/<container>/<type>/<Name>/tests/`.
Playwright config scans both `tests/` and `plugins/**/tests/`.

```bash
npx playwright test plugins/core/tools/Draw/tests/  # Specific plugin
npm run test:unit                                     # All unit tests
npm test                                              # All tests
```

## Migrating from Legacy Formats

If you have plugins using the old `config.json` (tools) or `setup.js` (backends) format, the discovery system will log a deprecation warning.

### Tools: `config.json` → `plugin.json`

Rename `config.json` to `plugin.json` and add the recommended fields (`version`, `type`, `id`, `author`, etc.). The existing fields (`name`, `paths`, `description`, etc.) are unchanged.

### Backends: `setup.js` → `plugin.json` + `plugin.js`

1. Create a `plugin.json` with the backend's metadata (name, version, type, etc.)
2. Rename `setup.js` to `plugin.js` — the lifecycle hooks (`onceInit`, `onceStarted`, `onceSynced`) are the same.

---

## AI Agent Notes

Compact reference for agents working with the plugin CLI programmatically.

- All commands support `--json`. Error paths also emit JSON when `--json` is set: `{"error": "message"}`.
- The `enable` command returns `{"noop": true, "reason": "required"}` for required plugins (exit 0, not an error).
- The `type` field in JSON output is always **singular** (`tool`, `backend`, `component`, `interaction`) — never the plural directory name.
- `list --json` includes: `id`, `name`, `type`, `container`, `enabled`, `core`, `required`, `version`, `tier`, `author`, `description`, `path`.
- `info --json` includes the full `manifest` object plus computed fields (`enabled`, `core`, `required`, `path`).
- `validate --json` returns `{ valid, total, passed, errors, warnings, results: [{ plugin, valid, errors }] }`.
- `activate --json` returns `{ added: [], removed: [], error }`.
- `install --json` returns `{ command, repo, discovered: [{ id, type, name }], activated: { added, removed } }`.
- Discovery processes `core` first, then external containers alphabetically. `overridable: false` blocks overrides.
- `plugin-state.json` is optional. Missing = all enabled. `required`/`overridable: false` plugins ignore state.
