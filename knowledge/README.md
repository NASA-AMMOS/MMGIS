# MMGIS Knowledge Base

Comprehensive documentation for the MMGIS project, organized for progressive discovery.

## Getting Started

- [AI Getting Started Guide](AI-GETTING-STARTED.md) — Setup, ports, mission creation, common pitfalls
- [AI Development Guide](AI-DEVELOPMENT.md) — Spec-kit workflow, constitution, development patterns

## Overview & Setup

- [01 — Overview](01-overview.md) — Project description, features, architecture summary
- [01.1 — Installation](01.1-installation.md) — Docker and non-Docker setup instructions
- [01.2 — Environment Configuration](01.2-environment-configuration.md) — All environment variables

## Configure Page

- [02 — Configure Page](02-configure-page.md) — Admin CMS overview
- [02.1 — Configure Tabs](02.1-configure-tabs.md) — Detailed tab reference

## Layer Types

- [03 — Layer Types Overview](03-layer-types.md) — All 10 layer types summarized
- [03.1 — Vector Layers](03.1-vector-layers.md) — GeoJSON/KML feature layers
- [03.2 — Tile Layers](03.2-tile-layers.md) — Raster tile imagery (TMS/WMTS/WMS)
- [03.3 — Data Layers](03.3-data-layers.md) — WebGL shader-based DEM visualization
- [03.4 — Model Layers](03.4-model-layers.md) — 3D models on the globe
- [03.5 — Image Layers](03.5-image-layers.md) — GeoTIFF/COG layers
- [03.6 — Query Layers](03.6-query-layers.md) — ElasticSearch-backed query layers
- [03.7 — Other Layer Types](03.7-other-layer-types.md) — Vector Tile, Velocity, Video, Header

## Data Formats

- [04 — Data Formats](04-data-formats.md) — Enhanced GeoJSON, URLs, styling, time tiles

## Tools

- [05 — Tools Overview](05-tools-overview.md) — All 16 interactive tools
- [05.1 — Draw Tool](05.1-draw-tool.md) — Collaborative vector editing
- [05.2 — Measure Tool](05.2-measure-tool.md) — Distance and elevation profiling
- [05.3 — Shade Tool](05.3-shade-tool.md) — SPICE-based illumination simulation
- [05.4 — Identifier Tool](05.4-identifier-tool.md) — Pixel value queries

## APIs

- [06 — API Overview](06-api-overview.md) — REST and WebSocket endpoint summary
- [06.1 — Configure REST API](06.1-configure-rest-api.md) — Admin configuration endpoints
- [06.2 — JavaScript API](06.2-javascript-api.md) — Client-side mmgisAPI

## Database

- [07 — Database Persistence](07-database-persistence.md) — Schema overview, initialization, safety rules
- [07.1 — Database Schema Reference](07.1-database-schema-reference.md) — Column-level table reference

## Advanced Features

- [08 — Adjacent Servers](08-adjacent-servers.md) — STAC, TiTiler, TiPG, Veloserver
- [08.1 — Data Processing](08.1-data-processing.md) — Tiling scripts, COGs, STAC
- [08.2 — Deep Linking](08.2-deep-linking.md) — URL state sharing
- [08.3 — SPICE Integration](08.3-spice-integration.md) — Kernel configuration
- [08.4 — AR/VR Support](08.4-ar-vr.md) — Augmented reality viewing

## Infrastructure

- [09 — Infrastructure & CI/CD](09-infrastructure-cicd.md) — GitHub Actions, Docker, environments
- [09.1 — Docker Deployment](09.1-docker-deployment.md) — Step-by-step Docker guide

## Contributing

- [10 — Contributing](10-contributing.md) — Plugin system, development guidelines, spec-kit

## Migration

- [11 — Migration](11-migration.md) — v3 to v4 migration guide

## Reference Material

For quick-reference guides and detailed lookup tables, see the **[reference/](./reference/README.md)** directory.
