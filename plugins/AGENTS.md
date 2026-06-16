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
| `API/pluginDiscovery.js` | Discovery logic — `discoverPlugins()` scans all containers |
| `API/pluginValidation.js` | Manifest validation — `validatePluginConfig()` |
| `API/updateTools.js` | Build-time tool/component discovery → generates `src/pre/tools.js` |
| `API/setups.js` | Runtime backend discovery → loads `plugin.js` lifecycle hooks |
| `scripts/resolve-plugin-deps.js` | Aggregates plugin dependencies for build |

## CLI Commands

All commands support `--json` for machine-readable output.

```bash
npm run plugins -- list                          # List all plugins
npm run plugins -- create tool MyTool --container my-plugins  # Scaffold a new plugin
npm run plugins -- install <git-url|local-path>  # Install plugins
npm run plugins -- remove <repo-name>            # Remove a plugin repo
npm run plugins -- enable <plugin-id>            # Enable a plugin
npm run plugins -- disable <plugin-id>           # Disable a plugin
npm run plugins -- update [repo-name]            # Pull latest for git repos
npm run plugins -- activate                      # Regenerate frontend imports (no full build)
npm run plugins -- validate                      # Validate all plugin.json manifests
npm run plugins -- deps                          # Show aggregated dependencies + conflicts
npm run plugins -- info <plugin-id>              # Show detailed plugin metadata
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output machine-readable JSON (all commands) |
| `--no-color` | Disable colored output (also respects `NO_COLOR` env) |
| `--link` | Symlink local paths instead of copy (junction fallback on Windows) |
| `--container <name>` | Target container for `create` command |

## Plugin Types

- **tools** — Frontend UI tools in `plugins/<container>/tools/<Name>/`. Must have `plugin.json` with `name` and `paths`. Implement `make()` and `destroy()`.
- **backend** — Server modules in `plugins/<container>/backend/<Name>/`. Have `plugin.json` (metadata) + `plugin.js` (lifecycle: `onceInit`, `onceStarted`, `onceSynced`). Routes in `routes/`.
- **components** — UI components in `plugins/<container>/components/<Name>/`. Have `plugin.json` with component metadata and `paths`.

## Webpack Aliases (Frontend Only)

| Alias | Resolves to |
|-------|-------------|
| `@basics` | `src/essence/Basics/` |
| `@essence` | `src/essence/` |
| `@design` | `src/design-system/` |
| `@pre` | `src/pre/` |
| `@external` | `src/external/` |

Backend plugins use Node.js `require()` with relative paths — aliases do not apply.

## Discovery Order

1. `core` container is always scanned first.
2. External containers scanned alphabetically.
3. Last-discovered plugin wins when names collide (allows overrides).
4. Plugins marked `"overridable": false` in their manifest block overrides.
5. Disabled plugins in `plugin-state.json` are skipped entirely.

## Core Protection

Core plugins (`plugins/core/`) cannot be removed, disabled, or overridden (unless `"overridable": true`).

## Plugin Manifest Schema

Required: `name`. Tools/components also require `paths`.
Recommended: `type`, `version`, `defaultIcon`.
Optional: `id`, `uuid`, `tier`, `overridable`, `description`, `engines`, `peerDependencies`, `dependencies`, `aliases`, `author`, `license`, `repository`, `keywords`.

## State File Format

```json
{
    "plugins": {
        "<container>/<type>/<name>": { "enabled": true }
    }
}
```

State file is optional. Missing file = all plugins enabled. Core plugins ignore state.

## Testing Plugins

Plugin-specific tests live in `plugins/<container>/<type>/<Name>/tests/`.
Playwright config scans both `tests/` and `plugins/**/tests/`.

```bash
npx playwright test plugins/core/tools/Draw/tests/  # Specific plugin
npm test                                              # All tests
```
