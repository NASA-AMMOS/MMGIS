# Conventions & Gotchas

Quick-reference for patterns and common issues. For full docs see `docs/pages/`.

## Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Singletons | Trailing `_` | `L_`, `Map_`, `Globe_`, `F_`, `ToolController_`, `Viewer_` |
| Files | PascalCase | `User.js`, `Map_.js` |
| CSS Classes | kebab-case | `.tool-panel`, `.map-container` |
| Constants/ENVs | UPPER_SNAKE | `DB_HOST`, `AUTH` |

## Code Style

- 4-space indent, single quotes, async/await over callbacks
- Prettier defaults (VSCode extension)

## Component Placement

- **Generic UI** → `src/design-system/components/`
- **MMGIS-specific UI** → `src/essence/Basics/UserInterface_/`
- **Tool UI** → `src/essence/Tools/ToolName/`

## Tool Plugin Rules

- Must implement `make()` and `destroy()` in `src/essence/Tools/ToolName/`
- Use `interfaceWithMMGIS()` for event handling and cleanup
- Register in config via `config.json`
- Tools should only modify `#tools` div, viewer, map, or globe

## Git

- Branches: `master` (production), `development` (active), `feature/NNN-name`, `hotfix/desc`
- Commits: imperative mood, prefix with feature number if applicable

## Common Issues

**Configure page blank** → Build it: `cd configure && npm install && npm run build && cd ..`

**Wrong port in dev** → Browse at **8889** (PORT+1), not 8888. API is on 8888, webpack dev server proxies to it.

**DB connection fails** → Check `.env` creds, verify PostgreSQL + PostGIS running, `DB_HOST=db` in Docker.

**WebSocket not working** → Set `ENABLE_MMGIS_WEBSOCKETS=true`, ensure proxy supports WS upgrade.

**SECRET too short** → Must be ≥24 characters.

**ENV not taking effect** → Remember triple-update: `.env`, `sample.env`, `docs/pages/Setup/ENVs/ENVs.md`.

**SPICE errors** → Check `SPICE_SCHEDULED_KERNEL_DOWNLOAD=true` and `/Missions/spice-kernels-conf.json`.
