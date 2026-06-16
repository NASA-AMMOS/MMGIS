# MMGIS Plugin System — AI Agent Context

## Overview

MMGIS plugins are organized under `/plugins/` in a three-level hierarchy:
`<container>/<type>/<PluginName>/`. Each plugin has a `plugin.json` manifest.

## Key Files

| File | Purpose |
|------|---------|
| `plugins/plugin-cli.js` | CLI for plugin management (`npm run plugins -- <cmd>`) |
| `plugins/plugin-registries.json` | Git URLs of known plugin sources |
| `plugins/plugin-state.json` | Enable/disable state (gitignored, instance-specific) |
| `API/pluginDiscovery.js` | Discovery logic — `discoverPluginsUnified()` scans all containers |
| `API/pluginValidation.js` | Manifest validation — `validatePluginConfig()` |
| `API/updateTools.js` | Build-time tool/component discovery → generates `src/pre/tools.js` |
| `API/setups.js` | Runtime backend discovery → loads `plugin.js` lifecycle hooks |
| `scripts/resolve-plugin-deps.js` | Aggregates plugin dependencies for build |

## Plugin Types

- **tools** — Frontend UI tools in `plugins/<container>/tools/<Name>/`. Must have `plugin.json` with `name` and `paths`. Implement `make()` and `destroy()`.
- **backend** — Server modules in `plugins/<container>/backend/<Name>/`. Have `plugin.json` (metadata) + `plugin.js` (lifecycle: `getRoutes`, `setup`). Routes in `routes/`, models in `models/`.
- **components** — UI components in `plugins/<container>/components/<Name>/`. Have `plugin.json` with component metadata.

## Discovery Order

1. `core` container is always scanned first.
2. External containers scanned alphabetically.
3. Last-discovered plugin wins when names collide (allows overrides).
4. Plugins marked `"overridable": false` in their manifest block overrides.
5. Disabled plugins in `plugin-state.json` are skipped entirely.

## Core Protection

Core plugins (`plugins/core/`) cannot be:
- Removed via `plugin-cli.js remove`
- Disabled via `plugin-cli.js disable`
- Disabled via `plugin-state.json`

## Common Tasks

```bash
# Install external plugins from git
npm run plugins -- install https://github.com/org/plugins.git

# Check all manifests are valid
npm run plugins -- validate

# See what dependencies all plugins need
npm run plugins -- deps

# After installing/enabling plugins:
npm run plugins:install    # Install npm/pip deps
npm run build              # Rebuild frontend
# Restart server for backend changes
```

## Plugin Manifest Schema

Required fields: `name`. Tools/components also require `paths` (mapping of tool name → entry point path).
Recommended fields: `type`, `version`. Core plugins use `"version": "core"` which auto-resolves to the MMGIS version.

Optional: `id`, `uuid`, `tier`, `overridable`, `description`, `engines`, `peerDependencies`, `dependencies`, `aliases`.

See `API/pluginValidation.js` for the full validation logic.

## State File Format

```json
{
    "plugins": {
        "<container>/<type>/<name>": { "enabled": true|false }
    }
}
```

State file is optional. Missing file = all plugins enabled. Core plugins ignore state.

## Testing Plugins

Plugin-specific tests live in `plugins/<container>/<type>/<Name>/tests/`.
Playwright config scans both `tests/` and `plugins/**/tests/`.

Run plugin tests: `npx playwright test plugins/core/tools/Draw/tests/`
Run all tests: `npm test`
