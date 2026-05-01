# MMGIS Overview

MMGIS (Multi-Mission Geographic Information System) is a web-based mapping and localization solution for science operations on planetary missions, developed by NASA-AMMOS.

## Features

- Web-based mapping interface with 2D slippy map (Leaflet) and 3D globe (Cesium/LithoSphere)
- Image viewer capable of showing mosaics with targets (OpenSeadragon, Photosphere, Model, PDF, Video)
- 10 fully customizable layer types (vector, tile, data, model, image, vectortile, velocity, video, header, query)
- Easy to use CMS (Configure page) for mission setup
- Multi-user collaborative vector drawing with history
- Elevation profiler and distance measurement
- Custom projections for any planetary body
- Tiling scripts for raster data processing
- Cloud Optimized GeoTIFFs (COGs) support
- STAC catalog integration
- TiTiler dynamic tile serving
- Time-enabled layers with temporal controls
- Plugin system for custom tools and backends

## Primary Use Case

Planetary science missions (Mars rovers, lunar operations, etc.) requiring accurate geospatial data visualization, annotation, and team collaboration.

## Architecture Summary

- **Backend**: Express 5.2 on Node.js 22+, PostgreSQL with PostGIS, Sequelize ORM
- **Frontend**: React + jQuery hybrid, Webpack 5, Leaflet (2D) + Cesium/LithoSphere (3D)
- **Real-time**: WebSocket-based collaboration
- **Testing**: Playwright for E2E, Jest for unit tests
- **Deployment**: Docker with docker-compose, GitHub Actions CI/CD

## Contacts

- Dr. Fred J. Calef III - fred.calef@jpl.nasa.gov
- Tariq K. Soliman - tariq.k.soliman@jpl.nasa.gov
- [Slack](https://nasa-ammos.slack.com/archives/C076L0Q1P4H)

## Links

- **Official Documentation**: https://nasa-ammos.github.io/MMGIS/
- **GitHub Repository**: https://github.com/NASA-AMMOS/MMGIS
