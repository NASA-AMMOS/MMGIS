# MMGIS Plugin System — AI Agent Context

## Overview

MMGIS plugins are organized under `/plugins/` in a three-level hierarchy:
`<container>/<type>/<PluginName>/`. Each plugin has a `plugin.json` manifest.

## Key Files

| File | Purpose |
|------|---------|
| `plugins/plugin-cli.js` | CLI for plugin management (`npm run plugins -- <cmd>`) |
| `plugins/plugin-registries.json` | Git URLs / local paths of known plugin sources |
| `plugins/plugin-state.json` | Enable/disable state (gitignored, instance-specific) |
| `plugins/PLUGIN-JSON.md` | Comprehensive `plugin.json` field reference |
| `API/pluginDiscovery.js` | Discovery logic — `discoverPlugins()` scans all containers |
| `API/pluginValidation.js` | Manifest validation — `validatePluginConfig()` |
| `API/updateTools.js` | Build-time tool/component discovery → generates `src/pre/tools.js` |
| `API/setups.js` | Runtime backend discovery → loads `plugin.js` lifecycle hooks |
| `scripts/resolve-plugin-deps.js` | Aggregates plugin dependencies for build |

## CLI Commands

All commands support `--json` for machine-readable output. Use `npm run plugin` or `npm run plugins` interchangeably.

```bash
npm run plugins -- list                          # List all plugins with status
npm run plugins -- info <plugin-id>              # Show detailed plugin metadata
npm run plugins -- validate                      # Validate all plugin.json manifests
npm run plugins -- deps                          # Show aggregated dependencies + conflicts
npm run plugins -- install <git-url|local-path>  # Install a plugin repo
npm run plugins -- remove <repo-name>            # Remove an installed plugin repo
npm run plugins -- enable <plugin-id>            # Enable a disabled plugin
npm run plugins -- disable <plugin-id>           # Disable a plugin
npm run plugins -- create <type> <Name> --container <name>  # Scaffold a new plugin
npm run plugins -- destroy <plugin-id>           # Delete a plugin (prompts confirmation)
npm run plugins -- activate                      # Regenerate frontend imports (no full build)
npm run plugins -- update [repo-name]            # Pull latest for git repos
npm run plugins -- registry add|remove|list      # Manage plugin source URLs
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output machine-readable JSON (all commands). Errors also emit JSON: `{"error":"..."}` |
| `--no-color` | Disable colored output (also respects `NO_COLOR` env) |
| `--link` | Symlink local paths instead of copy (junction fallback on Windows) |
| `--container <name>` | Target container for `create` command |
| `--force` | Skip confirmation prompts (`destroy`) |

### Plugin IDs

Commands accept full IDs (`core/tools/Draw`) or short names (`Draw`). Short names match the first plugin found.

## Plugin Types

- **tool** — Frontend UI tools in `plugins/<container>/tools/<Name>/`. Must have `plugin.json` with `name` and `paths`. Implement `make()` and `destroy()` static methods. Directory name is plural (`tools/`) but manifest type is singular (`"type": "tool"`).
- **backend** — Server modules in `plugins/<container>/backend/<Name>/`. Have `plugin.json` (metadata) + `plugin.js` (lifecycle: `onceInit`, `onceStarted`, `onceSynced`). Routes in `routes/`, models in `models/`.
- **component** — UI components in `plugins/<container>/components/<Name>/`. Have `plugin.json` with `paths`. Directory name is plural (`components/`) but manifest type is singular (`"type": "component"`).

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
5. Disabled plugins in `plugin-state.json` are skipped (including core plugins without `required: true`).

## Core & Required Protection

- Core plugins (`plugins/core/`) cannot be **removed** (`remove`) or **destroyed** (`destroy`).
- Plugins with `"required": true` or `"overridable": false` cannot be **disabled** or **destroyed**.
- Core plugins **without** `required: true` **can** be disabled via `disable`.
- Protection is manifest-driven (`required`/`overridable`), not container-driven.

## Plugin Manifest Schema

See `plugins/PLUGIN-JSON.md` for the full field-by-field reference.

**Required:** `name` (all types), `paths` (tools and components only).
**Recommended:** `type`, `version`, `defaultIcon`.
**Optional:** `id`, `uuid`, `display_name`, `tier`, `overridable`, `required`, `description`, `descriptionFull`, `engines`, `dependencies`, `peerDependencies`, `author`, `license`, `repository`, `keywords`, `aliases`, `config`, `hasVars`, `toolbarPriority`, `expandable`, `separatedTool`, `kinds`, `priority`, `envs`, `routes`.

## State File Format

```json
{
    "plugins": {
        "<container>/<type>/<name>": { "enabled": true }
    }
}
```

State file is optional. Missing file = all plugins enabled. Plugins with `required: true` or `overridable: false` are always enabled regardless of state.

## Testing Plugins

Plugin-specific tests live in `plugins/<container>/<type>/<Name>/tests/`.
Playwright config scans both `tests/` and `plugins/**/tests/`.

```bash
npx playwright test plugins/core/tools/Draw/tests/  # Specific plugin
npm run test:unit                                     # All unit tests
npm test                                              # All tests
```
