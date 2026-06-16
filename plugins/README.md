# MMGIS Plugin System

MMGIS uses a plugin-based architecture for tools, backend modules, and components. Plugins are organized under the `/plugins/` directory, grouped into **containers** (repositories).

## Directory Structure

```
plugins/
├── plugin-cli.js              # CLI tool for plugin management
├── plugin-registries.json     # Registered git-based plugin sources
├── plugin-state.json          # Enable/disable state per plugin (gitignored, instance-specific)
├── README.md                  # This file
├── AGENTS.md                  # AI agent context
├── core/                      # Core plugins (always enabled, committed to the repo)
│   ├── tools/                 # Frontend tool plugins (Draw, Measure, Legend, etc.)
│   ├── backend/               # Backend modules (Accounts, Config, Datasets, etc.)
│   └── components/            # UI component plugins (OperationsClock, etc.)
└── <external-repo>/           # Cloned from git (gitignored)
    ├── tools/
    ├── backend/
    └── components/
```

Each plugin lives in its own directory under `<container>/<type>/<PluginName>/` and contains a `plugin.json` manifest.

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
| `deps` | Show aggregated npm/pip dependencies with conflict detection |
| `info <plugin-id>` | Show detailed metadata for a plugin |
| `registry add <git-url>` | Register a plugin source URL |
| `registry remove <name>` | Unregister a plugin source |
| `registry list` | Show all registered sources |
| `help` | Show CLI help |

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

## Plugin State

`plugin-state.json` tracks which plugins are enabled or disabled. This file is:

- **Gitignored** — it is instance-specific configuration.
- **Optional** — if absent, all installed plugins are enabled by default.
- **Core-protected** — core plugins are always enabled regardless of state.

Example:

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

`plugin-registries.json` tracks known plugin sources (git repositories). When you `install` a git-based plugin repo, it is automatically added to the registries file. You can also manage registries directly:

```bash
npm run plugins -- registry add https://github.com/org/mmgis-plugins.git
npm run plugins -- registry list
npm run plugins -- registry remove mmgis-plugins
```

## Creating a Plugin

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide. In brief:

1. Create a directory under a container: `plugins/<your-repo>/<type>/<PluginName>/`
2. Add a `plugin.json` manifest with required fields:

```json
{
    "name": "MyTool",
    "display_name": "My Tool",
    "type": "tool",
    "version": "1.0.0",
    "description": "A custom MMGIS tool."
}
```

3. Implement the plugin code following the conventions for its type:
   - **Tools**: Export `make()` and `destroy()` lifecycle methods.
   - **Backends**: Create `plugin.js` with lifecycle hooks and a `routes/` directory.
   - **Components**: Export a component module.

4. Validate: `npm run plugins -- validate`

## Plugin Manifest (`plugin.json`)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Plugin name (must match directory name) |
| `display_name` | No | Human-readable display name |
| `type` | Recommended | `tool`, `backend`, or `component` |
| `version` | Recommended | Semver version string, or `"core"` (auto-resolves to MMGIS version) |
| `id` | Recommended | Unique identifier (e.g. `mmgis.core.draw`) |
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

## Core Plugins

Core plugins ship with MMGIS and live in `plugins/core/`. They:

- Are always enabled (cannot be disabled via the CLI or state file).
- Cannot be removed via the CLI.
- Are version-controlled with the main repository.

External plugins can override core plugins if the core plugin's manifest has `"overridable": true`. Discovery order ensures core is scanned first, then external containers alphabetically — the last-discovered plugin wins when names collide.
