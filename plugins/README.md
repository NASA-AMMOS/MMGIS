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
9. [Time](#time)
10. [Discovery & State](#discovery--state)
11. [Webpack Aliases](#webpack-aliases)
12. [Validation](#validation)
13. [Registries](#registries)
14. [Testing Plugins](#testing-plugins)
15. [Migrating from Legacy Formats](#migrating-from-legacy-formats)
16. [AI Agent Notes](#ai-agent-notes)

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
| `create <type> <Name>` | Scaffold a new plugin (tool, backend, component, interaction, layertype, layerattachment) |
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

The server contract — the `s` setup object, lifecycle ordering, choosing an auth gate, `envs`, models and migrations — is documented in [`core/backend/README.md`](./core/backend/README.md).

### Components

UI components loaded into the MMGIS interface. Directory name is plural (`components/`) but manifest type is singular (`"type": "component"`).

**Required manifest fields**: `name`, `paths`.

A component is page-level UI with no panel and no toolbar entry: one `init(vars)`, called once after the UI is finalized, and no `destroy`. [`core/components/README.md`](./core/components/README.md) is the family reference — when `init` runs and what exists by then, where to mount and the z-index bands to mount between, the subscriptions it can use, and why there is no core channel from an interaction to a component.

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

Before running the pipeline, the runner drops any interaction whose `applicableLayerTypes` doesn't include the layer's type, so a mission config (or a `kind` preset, or a layer type's `defaultInteractions`) can't hand a vector-feature interaction a tile layer. A type that `extends` another counts as its parent here, so a custom vector-derived type keeps vector's interactions without redeclaring anything.

#### Generated file & runtime

At build time, `updateInteractions()` (`API/updateTools.js`) discovers all enabled interactions, enforces `pluginDependencies` (an interaction whose dependency is missing/disabled is excluded), and generates `src/pre/interactions.js` with static imports plus the phase arrays, suppression map, and kind-alias map. The runtime executor `src/essence/Basics/InteractionRunner/InteractionRunner.js` reads that generated data — it contains **no hardcoded interaction IDs**. All orchestration lives in the manifests.

### Layer Types

How a layer of a given `layer.type` (`vector`, `tile`, `model`, …) is drawn and managed on each rendering surface. Directory name is plural (`layertypes/`), manifest type is singular (`"type": "layertype"`).

**Required manifest fields**: `name`, `typeId` (the value a mission config's `layer.type` names), `capabilities.renderers`, and `modules` (or `module`) unless the type inherits everything through `extends`.

The renderer contract — surfaces, the operations, `extends` — is documented in [`core/layertypes/README.md`](./core/layertypes/README.md).

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

If the argument isn't a URL or existing path, the CLI looks it up in `plugin-cli/registries.json` by name:

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

This copies the directory into `plugins/<dirname>/`, minus any `.git` (a copy, not a clone — `install <git-url>` is the clone). Local paths use the directory basename as the container name, and **a plugin's id embeds its container**, so installing the same work from a differently-named directory renames every plugin in it and breaks any `pluginDependencies` between them. Pin it:

```bash
npm run plugins -- install /path/to/my-plugin-repo --container my-plugins
```

To create a symlink instead (useful during active development so changes are reflected immediately), use the `--link` flag:

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

This scaffolds the directory structure, `plugin.json`, entry point, CSS, and a test spec. Frontend plugins are auto-activated. The scaffolds themselves are real files under `plugin-cli/scaffolds/<type>/`, so reading one is the same as reading what you will get.

### Where your plugin lives

**Everything but `core/` is gitignored** (`.gitignore`: `/plugins/*`, `!/plugins/core/`). This is deliberate — a container is a *separate* repository checked out inside this one, so MMGIS must not track its files — but it means a plugin you scaffold is invisible to `git status` in this repo. Pick a home before you start writing:

| your plugin is | where it goes | how it gets here |
|---|---|---|
| a change to MMGIS itself | `plugins/core/<type>/` | `create <type> <Name> --container core --force`, committed to MMGIS |
| generally useful, sharable | [NASA-AMMOS/MMGIS-Plugins](https://github.com/NASA-AMMOS/MMGIS-Plugins) | contribute there; `install MMGIS-Plugins` |
| yours / your mission's | its own git repo | `install https://…` (or `install --link /local/path` while writing it) |

So the normal flow for a third-party plugin is: `create … --container my-plugins`, develop in place, then `git init` **that container** as its own repo — not MMGIS. `git add -f` also works if you deliberately want it on an MMGIS branch (to share a work in progress, say), but it is the exception, not the path.

### You're not done when `validate` passes

`validate` checks manifests and module exports. It cannot see whether your plugin is *registered* or whether anything is *configured to use it* — so a green validate plus an app that does nothing is the expected result of stopping early. The remaining two steps, per family:

| family | register | then make something use it |
|---|---|---|
| tool, component | `plugins -- activate` (regenerates `src/pre/tools.js` / `components.js`) | the mission's config must place it (Configure → the mission's tools) |
| interaction | `activate` (regenerates `src/pre/interactions.js`) | a layer must name it in `interactions.<event>`, or it must carry a `kindAlias` the layer's kind preset selects — Configure's layer modal → Interactions |
| layertype | `activate` (regenerates `src/pre/layertypes.js`) | a layer's `type` must be your `typeId` |
| layerattachment | `activate` (regenerates `src/pre/layerattachments.js`) | a layer must fill in your `configPath` — the Configure tab your manifest's `config.tab` names, which should be an **existing** tab (`Attachment - Markers`, `Attachment - Paths`, …) unless you mean to add one |
| backend | nothing to generate | restart the server; `plugin.js` mounts your routes |

`create` runs `activate` for you, so this bites on the *second* change — adding a module key, renaming a path — not the first.

### One feature, several plugins

A real feature is often a layer type *and* an attachment *and* an interaction — a new data source, something drawn beside its features, something that happens when you click one. Put them in **one container**, which is then the unit you install, version and uninstall:

```
plugins/hazard-zones/
├── layertypes/HazardZone/
├── layerattachments/HazardBuffer/
├── interactions/HazardReport/
└── lib/hazardGeometry.js        # shared, imported relatively
```

Code they all need goes in a plain module anywhere in the container — `lib/` by convention — and is imported relatively (`import { bufferOf } from '../../lib/hazardGeometry'`). Webpack resolves it like any other import. Keep it free of `src/essence` imports and it is also the part you can unit test.

How the families reach each other — all declarative, none of it a lookup:

| seam | how |
|---|---|
| type → attachment | the attachment's `applicableLayerTypes: ["<typeId>"]`, which also hides it from every other type |
| type ships an attachment | the type's `capabilities.defaultAttachments`, which also carries the attachment's settings — see below |
| type ships an interaction | the type's `capabilities.defaultInteractions.<event>` — `["<interactionId>"]` for ids alone, or `{ "<interactionId>": { …settings } }` to configure it too, the mirror of the row above |
| either → an admin | each plugin's own `configPath` + `config.rows`; a plugin owns its subtree and should not write another's |
| plugin → plugin, at runtime | share a module, or leave something on the layer: an attachment's own object is at `L_.layers.attachments[<host>][<sublayerKey>]` and is yours verbatim, and interactions pass state along the pipeline in `ctx.state`. `<host>` is the host's name as `L_.layers.data` keys it (`L_.asLayerUUID(name)` for a display name), and `<sublayerKey>` is the `attachmentId` unless the attachment declared `capabilities.host.sublayerKey` |

The settings problem the last two rows solve is worth spelling out, because the obvious workaround is wrong. A feature's three plugins often need the *same* facts — the property holding an azimuth, say — and each family owns a different subtree, so an admin would type it three times and they would have to agree. Do **not** have your layer type write into the attachment's `configPath`; declare what the attachment should be instead:

```json
"capabilities": {
    "defaultAttachments": {
        "look_direction": { "azimuthProp": "emission_azimuth", "scale": 200 }
    }
}
```

Core then hands that to the attachment under the attachment's own `configPath`, as if an admin had filled it in. A layer of your type gets the attachment turned on with those settings; its own settings, if an admin gives it any, sit on top **field by field**, so changing one thing does not lose the rest, and `enabled: false` on the layer opts out. `{}` means "on, with the attachment's own defaults".

A declared value can be a **reference to a field of the layer** rather than a constant, for the fact that isn't yours to hardcode — which property an admin picked on *this* layer:

```json
"defaultAttachments": {
    "look_direction": { "azimuthProp": "$variables.stereo.azimuthProp", "scale": 200 }
}
```

`$` followed by a dotted path reads that path off the layer, so the property is answered once — on your own config rows — and you still choose which of your fields the attachment is handed. A path the layer cannot answer drops its key, so the plugin's own default still applies; `$$` escapes a value that really begins with a `$`. It works anywhere in a declaration, including nested objects and arrays, and in `defaultInteractions` settings too.

`defaultInteractions` takes the same two shapes per event, so a type that ships an interaction configures it the same way:

```json
"capabilities": {
    "defaultInteractions": {
        "click": { "stereo:pairs": { "azimuthProp": "emission_azimuth" } },
        "hover": ["cursor:show"]
    }
}
```

Object key order is the pipeline order, as the array's is, and the settings are resolved into the interaction's own `configPath` on the way to `ctx.config` — so an interaction is written once and works whether a type configured it or an admin did.

So the property names live once, in the manifest of the plugin that knows them, and neither plugin reads the other's config. Two caveats: the attachment's `applicableLayerTypes` still decides whether it can host your type at all (`validate` warns when a declared default can never apply), and the Configure form for that attachment shows *empty* fields on such a layer — empty means "as the type declared", and typing a value overrides it. Emptiness is what an untouched form field looks like, so a blank or missing field leaves the type's value standing; `false` and `0` are answers and do override.

There is deliberately no registry lookup by `attachmentId`/`interactionId` for plugins, and no way to *call* another plugin's operations: core dispatches them, so a plugin that needs another's work should read what it left behind rather than invoke it. Two plugins that must run in a fixed order are one plugin.

#### Composing across *layers* is not supported

The seams above are all within one layer. Reaching into a **different** layer — reading `L_.layers.layer['Other Layer']` for its features to intersect, buffer or join against — is not a supported composition API, and a plugin that does it is depending on things core does not promise:

- **the data may not be there.** A layer that is off has no Leaflet layer at all, and one that is on may still be mid-make; a dynamic-extent layer holds only what the current viewport asked for; a vector tile layer never has a feature collection to read, only the tiles currently drawn; and a `source` type's features exist only after its `fetch` resolved.
- **nothing tells you when it changes.** There is no invalidation: the other layer is refetched on a time change, a refresh interval, a view settle or a filter edit, and your derived product is simply stale afterwards. `subscribeOnSpecificLayerToggle` and `subscribeTimeChange` tell you about two of those, not the rest.
- **it is not the same shape everywhere.** What `L_.layers.layer[name]` holds is the render, and the render is the layer type's business — a Leaflet `GeoJSON` group for one type, a tile layer for another, something else for a plugin type. Reading it couples your plugin to another type's renderer.

If a feature genuinely needs two layers' data, the supportable shape is to make it **one layer**: a layer type whose `source.fetch` acquires both inputs and returns the combined GeoJSON, which is then a normal layer with a normal lifecycle — it refetches when core says to, it filters, it draws through an inherited renderer, and nothing depends on what an unrelated layer happens to be holding. Where the join belongs on the server, a backend plugin route that returns the joined result and a thin `source.fetch` in front of it is the same shape.

When one of those inputs is *itself a configured layer* of the mission, `ctx.acquire(layerName)` is how you get it:

```js
const stations = await ctx.acquire('Wind Stations')
```

It resolves with that layer's GeoJSON — going through whatever its own type does to acquire, including its `source.fetch` — or `null` if it can't be acquired (no such layer, or a type with no feature collection to give, like a tiled raster). It is available on a `source.fetch` `ctx`, and on an interaction's and attachment's.

It is **acquisition, not access**: the layer is not turned on, nothing of it is drawn, its own live acquisition is left alone, and what you get is a snapshot rather than a handle on its render — which is what makes it safe where reading `L_.layers.layer[name]` is not. A dynamic-extent layer is acquired whole rather than bound to your viewport, so acquire deliberately (it is a fetch, not a lookup) and hold the result yourself, remembering that it is a snapshot: re-acquire when you need it fresh.

`L_.layers.data` — the *configuration* of every layer — is a different matter and is fine to read; it is declarative, always present, and what core itself reads.

Declaring `pluginDependencies` between them is worth doing — it makes `disable` warn, and `deps` draw the graph — but get the ids right, container included: an unresolved dependency silently keeps the plugin out of the generated registry (see [`pluginDependencies`](#plugindependencies)).

`uninstall <container>` removes the directory *and* that container's entries in `plugin-cli/plugin-state.json`, so a deliberate `disable` inside it does not survive a reinstall — everything comes back enabled.

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
            s.ensureUser(), // pick a gate deliberately — see the backend README
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

Backends have no registry to regenerate and no `activate` step — but they also
get no auth by default: **the middleware chain in your own `onceInit` is the
security boundary**. The full contract — every field of `s`, the three lifecycle
hooks and their ordering, `ensureAdmin`'s built-in whitelist and its
`allowGets`/`disallow` parameters, why an `AUTH=off` instance can't reach an
admin route, `envs`, and models/migrations — is in
**[`core/backend/README.md`](./core/backend/README.md)**.

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

**[`core/interactions/README.md`](./core/interactions/README.md)** is the family reference: the full `ctx` table, phase/order and suppression, admin-editable settings via `configPath` + `config.rows`, and what can and cannot be unit tested.

### Layer Type and Layer Attachment Templates

`create layertype` and `create layerattachment` scaffold these two families, but their contracts are large enough to have their own documents, and each is written against the scaffold it hands you:

- **[`core/layertypes/README.md`](./core/layertypes/README.md)** — the render surfaces (`map`, `globe.<engine>`) and their operation vocabulary, the `config`/`filter`/`time` surfaces, `extends`, single-file types, and the capability table.
- **[`core/layerattachments/README.md`](./core/layerattachments/README.md)** — `configPath`, `applicableLayerTypes`, the attachment operations and the core default each replaces, host capabilities, and a worked example.

The other families' references: **[`core/interactions/README.md`](./core/interactions/README.md)** and **[`core/backend/README.md`](./core/backend/README.md)**.

The layertype scaffold is deliberately map-only (`"globe": false`, `"modules": {"map": "./map"}`). A globe-capable type adds `globe/<engine>.js` and declares it under `modules.globe`; `core/layertypes/ThreeDTiles` is the smallest example of one.

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

Maps the **render surfaces** a layer type implements to their modules, relative to the plugin's directory. Surfaces are `map`, `globe.<engine>`, `config`, `filter`, `time`, `source` and `legend`; all are optional, and startup validation cross-checks them against `capabilities.renderers`. A type that implements few enough surfaces to fit in one file declares a single `module` instead, whose *keys* are those surface names — see [`core/layertypes/README.md`](./core/layertypes/README.md).

```json
"modules": {
    "map": "./map",
    "globe": { "cesium": "./globe/cesium" }
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

**Type:** `string` · **Default:** `"puzzle-outline"` · **Applies to:** Tools, Components, Layer types

Icon displayed in the toolbar and configure page. A [Material Design Icons](https://pictogrammers.com/library/mdi/) name without the `mdi-` prefix (`layers`, `map-marker`, `clock-outline`) — MMGIS renders it as `<i className='mdi mdi-<name>'>`.

Layer types are the exception: Configure draws them with **MUI** icons (`Polyline`, `Storage`, `TravelExplore`), resolved against the map in `configure/src/core/layerTypeVisuals.js`, so a name that isn't in that map — including any MDI name — silently falls back to the generic layers icon. A third-party type either picks a name already imported there or accepts the fallback; adding one means a core change.

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
| `toolbarPriority` | `number` | Position in toolbar (lower = first). Core tools use 1–4 for the ones that lead the bar, then 101–102, then 1001–1002 — the gaps are room to insert, so pick a band rather than a number near one you want to sit beside |
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

### `config` — the Configure form a plugin declares

Tools, layer types, layer attachments and interactions can all declare a `config`
metaconfig, and Configure's Maker (`configure/src/core/Maker.js`) builds the form from
it. Nothing about it is per-family: a row is a horizontal band, `components` are the
controls in it laid out on a 12-column grid, and each control writes to the `field`
path it names.

```json
"config": {
  "tab": "Attachment - Markers",
  "rows": [
    { "name": "Radius Rings" },
    { "components": [
        { "type": "switch", "field": "variables.layerAttachments.radiusRings.enabled",
          "name": "Enabled", "width": 3 },
        { "type": "number", "field": "variables.layerAttachments.radiusRings.radiusMeters",
          "name": "Radius (m)", "width": 3, "description": "Shown as a tooltip" }
    ] }
  ]
}
```

| component field | what it does |
|---|---|
| `type` | which control to render, from the table below. A type Maker doesn't know renders **nothing** — the row appears with a hole in it — which is why `plugins -- validate` treats an unknown type as an error |
| `field` | the config path the control reads and writes. Required for everything but the display-only types; an attachment's or interaction's must sit inside its `configPath`, or the setting is written where core never reads it |
| `name` | the control's label |
| `description` | help text — a tooltip, or inline text under the control depending on where it is rendered |
| `width` | columns out of 12. Omitted means full width, so a row of three unwidthed controls stacks |
| `default` | the value shown before the mission has one. It is a **form** default, not a runtime one: nothing is written until an admin touches the field, so the plugin still receives a partial (or absent) config and defaults its own values — `const { hz = 440 } = ctx.config \|\| {}`. `checkbox`/`switch` read `defaultChecked` instead |
| `options` | required by the dropdown types; an array, or a string Maker parses |
| `optionsFrom` | `dropdown`/`searchdropdown` only: the name of a provider Maker asks for the options instead (below), for a list a manifest can't know |
| `freeSolo` | `searchdropdown` only: the options are suggestions rather than the only answers, so a value none of them covers can still be typed — a `layerProperties` list, for one, can only offer top-level names while `meta.reading.value` is just as valid |
| `disableSwitch` | a config path to a boolean: the control is greyed out until that field is on — how a settings block hangs off its own `enabled` switch |
| `enableWhenField` | an **object**, `{ "field": "…", "value": "…" }` (plus an optional `default` for when the field is unset): the control is greyed out until that field equals that value |
| `object` | `objectarray` only: the components one item is made of (below) |
| `rows` | `textarea` only: visible lines (default 4) |

**`optionsFrom`** is for the list you can't write down in a manifest — above all
"a property of this layer's data", which is otherwise an unchecked text field in
every plugin that reads feature properties:

```json
{ "type": "dropdown", "name": "Azimuth property", "width": 4,
  "field": "variables.layerAttachments.lookDirection.azimuthProp",
  "optionsFrom": "layerProperties" }
```

| provider | what it offers |
|---|---|
| `layerProperties` | the property names of the layer's own features — from the geodataset's schema for a `geodatasets:` layer, or by sampling the file for a `.geojson`/`.json` one. A layer whose data core can't see (a tile layer, a `source` type fetching from elsewhere) offers nothing |
| `layers` | every layer in the mission being configured, by name |
| `layerTypes` | the registered layer type ids, plugin types included |

The provider is asked once per layer and cached for the session. Until it
answers — and if it answers with nothing — the control shows whatever `options`
the component declared, so declaring both gives a sane fallback. An
`optionsFrom` naming a provider that doesn't exist is a validation error.

A value an admin clears is written as an empty string rather than removed, so a
`number` field can reach a plugin as `""`. Read config defensively —
`const hz = parseFloat(ctx.config?.hz) || 440` — rather than assuming a missing
setting is `undefined`.

**`objectarray`** is the one component whose inner fields are *not* config paths.
`field` is the path of the array; `object` lists the components of one item, and each
item component's `field` is **relative** to it, so Maker writes
`${field}.${index}.${innerField}`:

```json
{ "type": "objectarray",
  "field": "variables.layerAttachments.rangeRings.rings",
  "name": "Rings",
  "object": [
    { "type": "number", "field": "radius", "name": "Radius (m)", "width": 6 },
    { "type": "colorpicker", "field": "color", "name": "Colour", "width": 6 }
  ]
}
```

The plugin then reads `ctx.config.rings` as
`[{ radius: 500, color: '#f00' }, …]`. Because item fields are relative, they are the
only `field`s exempt from the "must sit inside `configPath`" rule.

An item field may itself be a path (`"field": "domain.min"`, `"field": "range.0"`),
which nests inside the item — a numeric last step makes an array. An item component
may also be another `objectarray`, for a list of lists (a styling rule's
value→colour mappings, say).

| `type` | control |
|---|---|
| `text` | single-line text, trimmed on blur |
| `textnotrim` | the same, keeping surrounding whitespace |
| `textarea` | multiline monospace text, for a value written in another language — a query, a template, a shader snippet — where newlines and alignment are part of the meaning. `rows` sets its initial height |
| `number` | numeric text field |
| `checkbox`, `switch` | boolean |
| `slider` | bounded number with `min`/`max`/`step` |
| `dropdown` | select over `options` |
| `searchdropdown` | the same with a filter box, for long lists; `freeSolo` also lets a value be typed |
| `colordropdown` | select over `options` with a colour swatch per entry |
| `colorpicker` | full colour picker |
| `textarray` | comma-separated text stored as an array |
| `objectarray` | a repeatable group of fields, each item shaped by `object` |
| `json` | raw JSON editor, for a subtree with no schema |
| `markdown` | markdown editor with preview |
| `layerMultiSelect` | pick layers from the mission, narrowable with `layerTypes` |
| `defaulttooldropdown` | pick one of the mission's non-separated tools |
| `interactions` | the interaction editor for a layer |
| `gap` | no control — a `description` used as a note between rows |
| `button` | runs a named `action` (populate-from-XML and friends); actions are core's, not a plugin's |
| `map`, `videopreview`, `themepreview` | previews, sized by `height` |

`tab` names the Configure tab the rows join. For an attachment it should be an
**existing** tab (`Attachment - Markers`, `Attachment - Paths`, …) unless you mean
to add one — a typo silently creates a new tab holding your rows alone.

**A layer type declares the tabs themselves**, since its `config` is the whole layer
modal rather than an addition to someone else's: `config.tabs[]`, each with a `name`
and its own `rows[]` (this is what `create layertype` scaffolds). Tools, attachments
and interactions add rows to a form that already exists, so they take `rows` at the
top level.

**An interaction takes `rows` and nothing else.** Its settings render on its own card
in a layer's Interactions tab — beside where the interaction was chosen — so there is
no `tab` to name, and no `enabled` control to add either: an interaction is enabled by
being in the layer's pipeline, which is what the editor above the card manipulates.
Rows without a `configPath` are an error, since the runner would have nowhere to read
them back from.

```json
"configPath": "variables.interactions.sonify",
"config": {
  "rows": [
    { "components": [
        { "type": "text", "field": "variables.interactions.sonify.property",
          "name": "Property", "width": 6 },
        { "type": "number", "field": "variables.interactions.sonify.hz",
          "name": "Base Hz", "width": 3, "default": 440 }
    ] }
  ]
}
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
| `config` | `object` | `rows` only — the settings form Configure renders on this interaction's card in a layer's Interactions tab. Requires `configPath`, and every `field` must sit inside it. See [`config`](#config--the-configure-form-a-plugin-declares). |
| `applicableLayerTypes` | `string[]` | Layer types this interaction applies to (e.g. `["vector", "vectortile", "query"]`). **Enforced** at runtime: the runner drops the interaction — preamble and postamble included — on a layer whose type (or the type it `extends`) isn't listed, and warns. Omit the field to apply to every type. |
| `configPath` | `string` | Where in a layer's config this interaction is configured (e.g. `variables.interactions.sonify`). The runner reads that subtree and hands it over as `ctx.config`, so the plugin never spells out where its own settings live. Omit it if the interaction has no per-layer settings — the runner then hands that interaction `ctx.config = null`, since one interaction's settings are never another's. A layer that has never been configured also yields `null`, so default in the plugin (`const { hz = 440 } = ctx.config || {}`). |

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

Array of plugin IDs that this plugin depends on at runtime, in any family: a tool naming the backend it calls, an interaction naming the layer type whose features it understands, an attachment naming the type it draws beside.

It is not only advisory. A frontend plugin whose dependency is missing or disabled is **left out of the generated registry** — `list` still shows it enabled and `validate` still reports the manifest valid, so the only sign is `validate`'s dependency warning and the plugin never loading. So an id here has to be exactly right, and an id is `<container>/<family>/<Name>` — note the **container**, which for a locally installed container is the directory it was installed under (pin it with `install <path> --container <name>`, or a plugin's own siblings become unreachable when the directory is renamed).

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

## Time

A mission's time window is one piece of shared state (`TimeControl`), and a
plugin of any family reads or moves it through the same surface:
`import TimeControl from '@basics/TimeControl_/TimeControl'`.

| what | how |
|---|---|
| is time on at all | `TimeControl.enabled` — false unless the mission enables it, so guard everything below |
| the window | `getStartTime()`, `getEndTime()`, `getTime()` (the playhead) |
| a layer's own window | `getLayerStartTime(layerOrName)`, `getLayerEndTime(layerOrName)` — a layer may be pinned off the global window |
| react to a change | `subscribe(id, func)` / `unsubscribe(id)`. `id` is yours (use the plugin's name); subscribing again with the same `id` replaces the callback, and a tool **must** unsubscribe in `destroy` |
| move the window | `setTime(startTime, endTime, isRelative, timeOffset, currentTime, customTimes)` — ISO strings, `isRelative` for a window that follows now, `timeOffset` as `'HH:MM:SS'` or seconds. It returns `false` and does nothing when time is disabled |
| move one layer | `setLayerTime(layerOrName, startTime, endTime)` |

A **feature's** own timestamps are not held anywhere central: the layer's config
names the properties they live in, so read them off the feature —
`F_.getIn(feature.properties, layerData.time.startProp)` and `…time.endProp`
(`startProp` may be absent, meaning the feature is a single point in time). Never
reach for a `_`-prefixed field of core's; those are caches, and they move.

A layer *type* that needs to re-request or re-stamp its data when time changes
declares the [`time` surface](./core/layertypes/README.md) instead of
subscribing — core dispatches it for every layer of that type.

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

It checks manifests and the shape of the modules they declare — statically, without loading them — plus the things that fail quietly at runtime: a module a manifest declares but the plugin no longer has, an `applicableLayerTypes`, `defaultInteractions` or `defaultAttachments` id no enabled plugin provides (or a declared default attachment that refuses your type as a host), a `pluginDependencies` id that cannot be resolved (which keeps the plugin out of the generated registry), two plugins claiming one `typeId`, `attachmentId` or `interactionId` (activation leaves *all* the claimants out of the generated registry rather than aborting, so the rest of your plugins still regenerate — the omission is printed, but `validate` is where you're meant to see it), and a generated registry that is stale relative to what is on disk. See `API/pluginValidation.js` for the implementation.

Linting a plugin needs `NODE_ENV` set — the repo's Babel preset refuses to run without it, with an error that looks unrelated to your code:

```bash
NODE_ENV=test npx eslint plugins/my-plugins/interactions/MyThing
```

## Registries

`plugin-cli/registries.json` tracks known plugin sources. When you `install` a git-based plugin repo, it is automatically added. Local paths are validated on `registry add`.

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
npm run test:plugins:unit                             # Every plugin's @unit tests
npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/core/tools/Draw/tests/
npm run test:unit                                     # MMGIS's own unit tests
npm test                                              # All tests
```

The `@unit` tag in a test's title is what `test:plugins:unit` selects, and the
scaffolds tag theirs, so an untagged test of yours runs only when you name its
path.

`PLAYWRIGHT_TEST_UNIT_ONLY=true` is what keeps a pure-logic test from bringing up
the Postgres test database global setup otherwise requires (`npm run test:unit`
sets it for you). Note that `test:unit` runs `tests/unit` only, so a plugin's own
`tests/` directory is not in it — run it by path, as above, or `npm test`.

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
