# MMGIS Plugin System

MMGIS uses a plugin-based architecture for tools, backend modules, and components. Plugins are organized under `/plugins/` in a three-level hierarchy: `<container>/<type>/<PluginName>/`.

## Directory Structure

```
plugins/
├── plugin-cli.js              # CLI tool for plugin management
├── plugin-registries.json     # Registered git-based plugin sources
├── plugin-state.json          # Enable/disable state per plugin (gitignored)
├── README.md                  # This file
├── core/                      # Core plugins (always enabled, committed)
│   ├── tools/                 # Frontend tools (Draw, Measure, Legend, etc.)
│   ├── backend/               # Server modules (Accounts, Config, etc.)
│   └── components/            # UI components (OperationsClock, etc.)
└── <external-repo>/           # Cloned from git (gitignored)
    ├── tools/
    ├── backend/
    └── components/
```

## Key Files

| File | Purpose |
|------|---------|
| `plugins/plugin-cli.js` | CLI for plugin management (`npm run plugins -- <cmd>`) |
| `plugins/plugin-registries.json` | Git URLs of known plugin sources |
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

# Install from a git repo
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
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `list` | List all plugins with enabled/disabled status |
| `install <git-url\|local-path>` | Clone a git repo or copy a local directory into `plugins/` |
| `remove <repo-name>` | Remove an installed plugin repo (cannot remove `core`) |
| `enable <plugin-id>` | Mark a plugin as active in `plugin-state.json` |
| `disable <plugin-id>` | Mark a plugin as inactive (cannot disable `core` plugins) |
| `update [repo-name]` | `git pull` latest for one or all installed repos |
| `validate` | Validate all `plugin.json` manifests |
| `deps` | Show aggregated npm/pip/conda dependencies with conflict detection |
| `info <plugin-id>` | Show detailed metadata for a plugin |
| `registry add <git-url>` | Register a plugin source URL |
| `registry remove <name>` | Unregister a plugin source |
| `registry list` | Show all registered sources |
| `help` | Show CLI help |

### Flags

| Flag | Description |
|------|-------------|
| `--no-color` | Disable colored output (also respects `NO_COLOR` env) |
| `--json` | Output machine-readable JSON (`list`, `info`) |
| `--link` | Symlink local paths instead of copy (falls back to junction on Windows) |

### Plugin IDs

Plugins are identified as `<container>/<type>/<name>` (e.g. `core/tools/Draw`). For convenience, the CLI also accepts just `<name>` and matches the first plugin found.

## Installing Plugins

### From a Git Repository

```bash
npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git
```

This clones the repository into `plugins/mmgis-geo-plugins/`. The repo must follow the standard directory structure with `tools/`, `backend/`, and/or `components/` subdirectories.

### From a Local Path

```bash
npm run plugins -- install /path/to/my-plugin-repo
```

This copies the directory into `plugins/<dirname>/`. To create a symlink instead (useful during active development so changes are reflected immediately), use the `--link` flag:

```bash
npm run plugins -- install --link /path/to/my-plugin-repo
```

On Windows, if symlink creation fails due to permissions, `--link` falls back to a directory junction automatically.

### After Installing

- Run `npm run build` to activate frontend plugins (tools, components).
- Restart the server to activate backend plugins.
- Run `npm run plugins:install` to install any new npm/pip dependencies declared by the plugins.

## Plugin Types

### Tools

Frontend UI tools that appear in the MMGIS toolbar. Must implement `make()` and `destroy()` lifecycle methods.

**Required manifest fields**: `name`, `paths` (mapping of tool name → entry point).

### Backend

Server-side Express modules. Have `plugin.json` (metadata) + `plugin.js` (lifecycle hooks: `onceInit`, `onceStarted`, `onceSynced`). Routes go in `routes/`, models in `models/`.

**Required manifest fields**: `name`.

### Components

UI components loaded into the MMGIS interface. Have `plugin.json` with component metadata.

**Required manifest fields**: `name`, `paths`.

## Plugin Manifest (`plugin.json`)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Plugin name (must match directory name) |
| `display_name` | No | Human-readable display name |
| `type` | Recommended | `tool`, `backend`, or `component` |
| `version` | Recommended | Semver string, or `"core"` (auto-resolves to MMGIS version) |
| `id` | Recommended | Unique identifier (e.g. `core-draw`) |
| `uuid` | Recommended | UUID v4 for global uniqueness |
| `author` | Recommended | Author name (string) or `{ "name": "...", "email": "...", "url": "..." }` |
| `license` | Recommended | SPDX license identifier (e.g. `"Apache-2.0"`) |
| `repository` | Recommended | URL to the plugin's source repository |
| `keywords` | No | Array of tags for discovery (e.g. `["terrain", "analysis"]`) |
| `tier` | No | `core`, `community`, or `private` |
| `overridable` | No | Whether external plugins can override this (default `true`) |
| `description` | No | Short description |
| `engines` | No | `{ "mmgis": ">=5.0.0" }` — MMGIS version compatibility |
| `peerDependencies` | No | Other plugins this depends on (by plugin ID + semver range) |
| `dependencies` | No | `{ "npm": {}, "python": { "pip": [], "conda": [] } }` |
| `aliases` | No | Alternative names for backward compatibility |
| `paths` | Tools/Components | Map of tool name → entry point path |

## Creating a Plugin

### Tool Template

Directory structure:
```
plugins/<your-repo>/tools/MyTool/
├── plugin.json
└── MyTool.js
```

**`plugin.json`**:
```json
{
    "name": "MyTool",
    "display_name": "My Tool",
    "type": "tool",
    "version": "1.0.0",
    "description": "A custom MMGIS tool.",
    "author": "Your Name",
    "license": "Apache-2.0",
    "paths": {
        "MyTool": "MyTool"
    }
}
```

**`MyTool.js`**:
```js
import $ from 'jquery'
import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

// prettier-ignore
const markup = [
    `<div id='myTool'>`,
    `</div>`
].join('\n')

const MyTool = {
    height: 0,
    width: 300,
    MMGISInterface: null,
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    const toolsContainer = $('#toolPanel')
    toolsContainer.css('background', 'transparent')
    toolsContainer.empty()

    const tools = $('<div>').css('height', '100%').html(markup)
    toolsContainer.append(tools)

    function separateFromMMGIS() {}
}

export default MyTool
```

**Webpack aliases** available for imports (no fragile relative paths needed):

| Alias | Resolves to |
|-------|-------------|
| `@basics` | `src/essence/Basics/` |
| `@essence` | `src/essence/` |
| `@design` | `src/design-system/` |
| `@pre` | `src/pre/` |
| `@external` | `src/external/` |

### Backend Template

Directory structure:
```
plugins/<your-repo>/backend/MyModule/
├── plugin.json
├── plugin.js
└── routes/
    └── my_routes.js
```

**`plugin.json`**:
```json
{
    "name": "MyModule",
    "display_name": "My Backend Module",
    "type": "backend",
    "version": "1.0.0",
    "description": "A custom backend module.",
    "author": "Your Name",
    "license": "Apache-2.0"
}
```

**`plugin.js`**:
```js
const router = require("./routes/my_routes");

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
    // Environment variables this module needs
    envs: [
        { name: "MY_ENV_VAR", description: "Description", required: false, private: false }
    ],
};

module.exports = setup;
```

### Component Template

Directory structure:
```
plugins/<your-repo>/components/MyComponent/
├── plugin.json
└── MyComponent.js
```

**`plugin.json`**:
```json
{
    "name": "MyComponent",
    "display_name": "My Component",
    "type": "component",
    "version": "1.0.0",
    "description": "A custom UI component.",
    "author": "Your Name",
    "license": "Apache-2.0",
    "paths": {
        "MyComponent": "MyComponent"
    }
}
```

### Validate Your Plugin

```bash
npm run plugins -- validate
npm run plugins -- info MyTool
```

## Migrating from Legacy Formats

If you have plugins using the old `config.json` (tools) or `setup.js` (backends) format, the discovery system will log a deprecation warning:

> Plugin "container/type/Name" has a deprecated config.json. Please migrate to plugin.json.

### Tools: `config.json` → `plugin.json`

Rename `config.json` to `plugin.json` and add the recommended fields (`version`, `type`, `id`, `author`, etc.). The existing fields (`name`, `paths`, `description`, etc.) are unchanged.

### Backends: `setup.js` → `plugin.json` + `plugin.js`

1. Create a `plugin.json` with the backend's metadata (name, version, type, etc.)
2. Rename `setup.js` to `plugin.js` — the lifecycle hooks (`onceInit`, `onceStarted`, `onceSynced`, `envs`) are the same

## Discovery Order

1. `core` container is always scanned first.
2. External containers scanned alphabetically.
3. Last-discovered plugin wins when names collide (allows overrides).
4. Plugins marked `"overridable": false` block overrides.
5. Disabled plugins in `plugin-state.json` are skipped entirely.

## Plugin State

`plugin-state.json` tracks which plugins are enabled or disabled. This file is:

- **Gitignored** — it is instance-specific configuration.
- **Optional** — if absent, all installed plugins are enabled by default.
- **Core-protected** — core plugins are always enabled regardless of state.

```json
{
    "plugins": {
        "my-plugins/tools/SpectralTool": { "enabled": true },
        "my-plugins/tools/ExperimentalViewer": { "enabled": false }
    }
}
```

Disabled plugins are skipped during discovery — they won't be loaded by the build system or the server.

## Registries

`plugin-registries.json` tracks known plugin sources (git repositories). When you `install` a git-based plugin repo, it is automatically added to the registries file.

```bash
npm run plugins -- registry add https://github.com/org/mmgis-plugins.git
npm run plugins -- registry list
npm run plugins -- registry remove mmgis-plugins
```

## Core Plugins

Core plugins ship with MMGIS and live in `plugins/core/`. They:

- Are always enabled (cannot be disabled via the CLI or state file).
- Cannot be removed via the CLI.
- Use `"version": "core"` which auto-resolves to the MMGIS version.
- Are version-controlled with the main repository.

External plugins can override core plugins if the core plugin's manifest has `"overridable": true`.

## Testing Plugins

Plugin-specific tests live in `plugins/<container>/<type>/<Name>/tests/`. Playwright config scans both `tests/` and `plugins/**/tests/`.

```bash
# Run a specific plugin's tests
npx playwright test plugins/core/tools/Draw/tests/

# Run all tests
npm test
```
