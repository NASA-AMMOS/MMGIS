# MMGIS - AI Agent Context

**Project**: MMGIS (Multi-Mission Geographic Information System)
**Version**: 5.4.0
**Last Updated**: 2026-09-15

> **New to this repo?** See [.knowledge/AI-GETTING-STARTED.md](./.knowledge/AI-GETTING-STARTED.md) for setup guide, port map, and common pitfalls.
> **Development workflow?** See [.knowledge/AI-DEVELOPMENT.md](./.knowledge/AI-DEVELOPMENT.md) for the spec-kit workflow.

## Important Instructions

- Use MCP tools, such as serena and playwright, when possible for code analysis, symbol navigation, and code modifications.
- Local development uses hot-reloading — there is little reason to run `npm run build` during development.
- New development work that depends on a specific configuration and/or data should often be included in a Reference Mission blueprint under `/blueprints/Missions/`. Multiple variants exist (Earth, Lunar South Pole, etc.) — see [blueprints/README.md](./blueprints/README.md) for the full list and instructions on adding new variants. Site Admins can create a working Reference Mission in `/Missions` via the Configure Page, and developers can update the blueprint itself.
- For code pattern templates (Express routes, Sequelize models, Tool plugins, WebSocket handlers) and the detailed project structure, see [.knowledge/code-patterns.md](./.knowledge/code-patterns.md).

## Quick Start

```bash
cp sample.env .env          # Configure DB_NAME, DB_USER, DB_PASS, SECRET
npm install
npm start                   # Runs init-db.js then server.js
# Browse app at http://localhost:8889 (dev) or :8888 (prod)
# Configure at http://localhost:8888/configure
```

Docker: `docker build -t mmgis . && docker-compose up -d`

## Critical Rules

- **Hot-reloading**: Dev mode uses webpack-dev-server on PORT+1 (8889). No need to run `npm run build` during development.
- **Configure page**: Separate React app — must be built independently: `cd configure && npm install && npm run build && cd ..`
- **PostGIS required**: PostgreSQL must have PostGIS extension installed. `init-db.js` creates it.
- **ENV triple-update**: When modifying environment variables, update `.env`, `sample.env`, AND `docs/pages/Setup/ENVs/ENVs.md`.
- **No raw SQL for data**: Use application APIs and UI workflows — never bypass the application layer with direct SQL.
- **Admin auth always required**: CMS endpoints (`/api/configure/*`) require admin session even when `AUTH=off`.
- **Database safety**: Never `DROP DATABASE` in app code. Test DBs only: `mmgis-test`, `mmgis-stac-test`.
- **Reference Mission**: New features needing specific config/data should be added to a Reference Mission blueprint. See [blueprints/README.md](./blueprints/README.md).
- **Design system placement**: Generic UI components → `src/design-system/`. MMGIS-specific UI → `src/essence/Basics/UserInterface_/`.
- **Categorized tests required**: Every code change ships with tests tagged to a capability in `tests/capabilities.yml` and lists the impacted feature areas in the PR. See [Testing & Feature-Area Tracking](#testing--feature-area-tracking).
- **Spec-kit for features**: Significant new features follow: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` → `/speckit.checklist`.

## Architecture at a Glance

Express 5.2 backend (Node.js 22+) with PostgreSQL/PostGIS, Sequelize ORM, and WebSocket real-time collaboration. React + jQuery frontend built with Webpack 5. Tri-renderer: Leaflet (2D) + Cesium/LithoSphere (3D) + Viewer panel (OpenSeadragon, Photosphere, Model, PDF, Video). Playwright tests (unit, API and functional flow levels), GitHub Actions CI/CD, Docker deployment.

## Key Patterns

- **Singletons**: `L_` (Layers), `Map_`, `Globe_`, `F_` (Formulae), `ToolController_`, `Viewer_` — global state controllers with trailing underscore
- **Tool lifecycle**: Each tool implements `make()` (open) and `destroy()` (close) in `plugins/core/tools/ToolName/`
- **Layer types**: vector, tile, data, model, image, vectortile, velocity, video, header, query
- **Backend pattern**: Each feature is a module in `plugins/core/backend/FeatureName/` with `plugin.json` (metadata/manifest), `plugin.js` (lifecycle hooks, registers routes), `routes/` (Express handlers), `models/` (Sequelize definitions)
- **Plugin system**: Unified `/plugins/` directory. Core plugins live in `plugins/core/{tools,backend,components}/`. External plugins go in `plugins/<container>/` (auto-gitignored).

## Project Structure (Abbreviated)

```
MMGIS/
├── plugins/core/         # Core plugins: tools/, backend/, components/
├── src/essence/          # Frontend: Basics/ (singletons), Helpers/, services/
├── src/design-system/    # Generic reusable UI components & theming
├── configure/            # Separate React admin app (own npm install + build)
├── scripts/              # server.js, init-db.js, build.js, middleware.js
├── tests/                # Playwright unit/API/flow tests + capabilities.yml
├── .knowledge/           # Agent context: setup, conventions, gotchas, code patterns
├── .specify/             # Spec-kit infrastructure + constitution
├── specs/                # Feature specifications (spec-kit)
├── blueprints/           # Mission templates and variants (see blueprints/README.md)
├── docs/                 # Jekyll documentation site (docs/pages/)
├── Missions/             # Mission data storage
├── adjacent-servers/     # TiTiler, STAC, TiPG, Veloserver proxy configs
├── views/                # Pug templates (login, admin, error pages)
├── private/              # Private API scripts (Python GDAL)
├── spice/                # SPICE kernel management
└── auxiliary/            # GDAL tiling and data processing scripts
```

## Active Features

| # | Feature | Status |
|---|---------|--------|
| 001 | Authentication & User Management | Implemented |
| 002 | Geodata Management & Tile Serving | Implemented |
| 003 | Real-time Collaboration (WebSocket) | Implemented |
| 004 | Mission/Project Configuration | Implemented |
| 005 | Tri-Rendering (Leaflet + Cesium + Viewer) | Implemented |
| 006 | Interactive Mapping Tools (16 tools) | Implemented |
| 007 | Layer & Map Configuration | Implemented |
| 008 | Configure Page (Admin CMS) | Implemented |
| 009 | Data Formats & Layer Types | Implemented |
| 012 | Reference Mission Demo | Implemented |

See `specs/NNN-feature-name/` for individual spec and plan documents.

## Testing & Feature-Area Tracking

Every change that touches behaviour must include tests, and those tests must be **categorized** so we can track which feature areas a change impacts. Full guide: [tests/README.md](./tests/README.md#test-levels-and-capabilities).

**Test levels** (all run by Playwright):

| Level | What it covers | Where | Must |
|-------|----------------|-------|------|
| `unit` | Pure functions, modules, config validation. No server, no browser. | `tests/unit/`, `tests/ci/`, or `@unit`-tagged plugin tests | Always pass |
| `api` | HTTP routes, backend plugins, security, startup, against the test server | `tests/e2e/api|security|startup/`, `plugins/*/backend/*/tests/` | Pass in CI for both `AUTH` modes |
| `flow` | User-visible behaviour driven through the browser, incl. corner cases | `tests/e2e/<area>/`, `plugins/*/tools|layertypes/*/tests/` | Cover every user-visible change |

**Capability catalog**: `tests/capabilities.yml` defines feature areas (`MAP`, `LYR`, `UIF`, `CFG`, `AUTH`, `API`, `COL`, `PLT`), the capabilities inside them (e.g. `UIF-LAYERS-FILTER`), the levels each capability `requires`, the source `paths` it owns, and user-level `scenarios` (e.g. `UIF-LAYERS-FILTER-02`).

**When you change code, you MUST:**

1. **Identify impacted capabilities** — match changed files against `paths` in `tests/capabilities.yml`. If nothing matches, add the paths to the right capability, or add a new capability (and area only if truly new).
2. **Add/update low-level tests** (`unit` and/or `api`) for the logic you changed.
3. **Add/update `flow` tests** for anything user-visible, including at least one corner case (empty data, invalid input, permission denied, missing service, etc.). Add a scenario to the capability for each new user-visible behaviour.
4. **Tag new tests** with the capability or scenario ID (and level if it is not implied by the directory):
   ```js
   test('clearing a filter restores all features', { tag: ['@UIF-LAYERS-FILTER-02'] }, async ({ page }) => { ... })
   ```
   New test files must be matched by a capability's `tests` globs; `tests/ci/capability-catalog.spec.js` fails on unmapped spec files and unknown tags.
5. **Skip only for missing infrastructure** (`test.skip(cond, 'SKIP: needs TiTiler')`). Never skip because a UI element or mission is missing — that hides regressions; fail instead.
6. **List impacted feature areas in the PR** — fill in the "Feature areas impacted" table in `.github/PULL_REQUEST_TEMPLATE.md` with capability IDs, test levels and test files.

**Coverage report**: `npm run test:capabilities` builds `capability-report/index.html` (plus `.md`/`.json`) from `playwright-report/results.json`. CI publishes it as the `capability-coverage-report` artifact on every run of `playwright-tests.yml` (also runnable via **Run workflow**).

## Constitution (Summary)

Seven principles in `.specify/memory/constitution.md`: Documentation-First Development, Clear Requirements, Incremental Delivery, Quality Standards (ESLint clean, 80% coverage), Node.js Best Practices, Geospatial Data Integrity, Real-time Collaboration Safety.

## Knowledge Base

Agent-optimized context in **[.knowledge/](./.knowledge/README.md)**. Full docs in `docs/pages/`.

| File | What's There |
|------|-------------|
| `.knowledge/AI-GETTING-STARTED.md` | Setup, ports, key commands, mission creation |
| `.knowledge/AI-DEVELOPMENT.md` | Spec-kit workflow, constitution |
| `.knowledge/code-patterns.md` | Full project tree, key directories, code templates |
| `.knowledge/conventions-and-gotchas.md` | Naming, code style, component placement, common issues |
| `.knowledge/knowledge-notes.md` | Auth, DB init, path security, error handling gotchas |

## Database Safety Rules for AI Agents

When writing or modifying code that interacts with the database, AI agents MUST follow these rules:

1. **NEVER use `DROP DATABASE` in application code.** The only place `DROP DATABASE` is permitted is in `tests/test-db-clean.js`, and only against the hardcoded `mmgis-test` and `mmgis-stac-test` databases.
2. **NEVER use `DROP TABLE` or `TRUNCATE TABLE` without proper authorization checks** and input sanitization via `Utils.forceAlphaNumUnder()`.
3. **NEVER hardcode production database names, hosts, or credentials** in test files or scripts.
4. **ALWAYS use the dedicated test databases** (`mmgis-test` and `mmgis-stac-test`) for any test-related database operations. Never modify the test database name constants.
5. **ALWAYS use `DB_USER_TEST` / `DB_PASS_TEST`** environment variables for test database credentials when available, to maintain least-privilege separation.
6. **NEVER remove or weaken** the `NODE_ENV === 'production'` safety checks in test setup files (`tests/global-setup.js`, `tests/test-db-clean.js`).
7. When writing database-related tests, **never use destructive commands** like `DROP` or `TRUNCATE` on the main schema. Always target the `mmgis-test` (or `mmgis-stac-test` for STAC) database and implement environment safety checks.

## References

- **Full Documentation**: `docs/pages/` or https://nasa-ammos.github.io/MMGIS/
- **GitHub Repository**: https://github.com/NASA-AMMOS/MMGIS
- **Constitution**: `.specify/memory/constitution.md`
- **API Docs**: Swagger UI at `/api-docs` when server running
