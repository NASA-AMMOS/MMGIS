# MMGIS - AI Agent Context

**Project**: MMGIS (Multi-Mission Geographic Information System)
**Version**: 4.3.0
**Last Updated**: 2026-05-01

> **New to this repo?** See [.knowledge/AI-GETTING-STARTED.md](./.knowledge/AI-GETTING-STARTED.md) for setup guide, port map, and common pitfalls.
> **Development workflow?** See [.knowledge/AI-DEVELOPMENT.md](./.knowledge/AI-DEVELOPMENT.md) for the spec-kit workflow.

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
- **Reference Mission**: New features needing specific config/data should be added to `/blueprints/Missions/Reference-Mission`.
- **Design system placement**: Generic UI components → `src/design-system/`. MMGIS-specific UI → `src/essence/Basics/UserInterface_/`.
- **Spec-kit for features**: Significant new features follow: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` → `/speckit.checklist`.

## Architecture at a Glance

Express 5.2 backend (Node.js 22+) with PostgreSQL/PostGIS, Sequelize ORM, and WebSocket real-time collaboration. React + jQuery frontend built with Webpack 5. Tri-renderer: Leaflet (2D) + Cesium/LithoSphere (3D) + Viewer panel (OpenSeadragon, Photosphere, Model, PDF, Video). Playwright E2E tests, Jest unit tests, GitHub Actions CI/CD, Docker deployment.

## Key Patterns

- **Singletons**: `L_` (Layers), `Map_`, `Globe_`, `F_` (Formulae), `ToolController_`, `Viewer_` — global state controllers with trailing underscore
- **Tool lifecycle**: Each tool implements `make()` (open) and `destroy()` (close) in `src/essence/Tools/ToolName/`
- **Layer types**: vector, tile, data, model, image, vectortile, velocity, video, header, query
- **Backend pattern**: Routes → Controllers (`API/Backend/APIs/*.js`) → Models (`API/Backend/Databases/*.js`) → PostgreSQL
- **Plugin system**: `*Private-Tools*`, `*Plugin-Tools*`, `*Private-Backend*`, `*Plugin-Backend*`, `*Private-Components*`, `*Plugin-Components*` directories (auto-gitignored)

## Project Structure (Abbreviated)

```
MMGIS/
├── API/Backend/          # Express routes, Sequelize models, WebSocket
├── src/essence/          # Frontend: Basics/ (Map_, Layers_, UI), Tools/ (16 tools), Ancillary/
├── src/design-system/    # Generic reusable UI components & theming
├── configure/            # Separate React admin app (own npm install + build)
├── scripts/              # server.js, init-db.js, build.js
├── .knowledge/            # Deep documentation (this knowledge base)
├── specs/                # Feature specifications (spec-kit)
├── blueprints/           # Mission templates (Reference-Mission)
├── docs/                 # Jekyll documentation site
├── Missions/             # Mission data storage
├── adjacent-servers/     # TiTiler, STAC, TiPG, Veloserver proxy configs
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

## Constitution (Summary)

Seven principles in `.specify/memory/constitution.md`: Documentation-First Development, Clear Requirements, Incremental Delivery, Quality Standards (ESLint clean, 80% coverage), Node.js Best Practices, Geospatial Data Integrity, Real-time Collaboration Safety.

## Knowledge Base

For comprehensive documentation, explore the **[.knowledge/](./.knowledge/README.md)** directory:

| Tier | Location | What's There |
|------|----------|-------------|
| **Getting Started** | `.knowledge/AI-GETTING-STARTED.md` | Setup, ports, mission creation |
| **Development** | `.knowledge/AI-DEVELOPMENT.md` | Spec-kit workflow, constitution |
| **Deep Knowledge** | `.knowledge/*.md` | 25+ pages on architecture, tools, APIs, DB, infra |
| **Reference** | `.knowledge/reference/*.md` | Coding conventions, directory details, API reference, troubleshooting |

## References

- **Knowledge Base Index**: [.knowledge/README.md](./.knowledge/README.md)
- **Spec-Kit Workflow**: [.knowledge/AI-DEVELOPMENT.md](./.knowledge/AI-DEVELOPMENT.md)
- **Getting Started**: [.knowledge/AI-GETTING-STARTED.md](./.knowledge/AI-GETTING-STARTED.md)
- **Reference Material**: [.knowledge/reference/](./.knowledge/reference/)
- **Official Documentation**: https://nasa-ammos.github.io/MMGIS/
- **GitHub Repository**: https://github.com/NASA-AMMOS/MMGIS
- **Constitution**: `.specify/memory/constitution.md`
- **API Documentation**: Swagger UI at `/api-docs` when server running
