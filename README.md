<hr>
<div align="center">
  <h1 align="center">
      MMGIS (Multi-Mission Geographic Information System)
  </h1>
</div>

<pre align="center">Web-based Mapping for Earth, Lunar and Planetary Visualization, Research, Science, Planning and Operations.</pre>

<div align="center">
  <a href="https://ammos.nasa.gov/media/NASA-AMMOS-MMGIS.mp4" target="_blank">
    <img src="/docs/assets/images/NASA-AMMOS-MMGIS-frame0.png" alt="MMGIS Demo Video" width="100%" />
  </a>
  <p><i>Click to watch the demo video.</i></p>
</div>

<div align="center">

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15237385.svg)](https://doi.org/10.5281/zenodo.15237385)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-336791.svg)](https://www.postgresql.org/)
[![GitHub Issues](https://img.shields.io/github/issues/NASA-AMMOS/MMGIS)](https://github.com/NASA-AMMOS/MMGIS/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/NASA-AMMOS/MMGIS)](https://github.com/NASA-AMMOS/MMGIS/commits/master)
[![GitHub Stars](https://img.shields.io/github/stars/NASA-AMMOS/MMGIS?style=social)](https://github.com/NASA-AMMOS/MMGIS/stargazers)

</div>

<div align="center">A free, open source and easily configurable solution for GIS on the web. Run MMGIS via a prebuilt docker image on your server and use the Configure page to setup a new mission map to get started. You completely own your data too but are responsible for any data processing (though provided are a variety of scripts and organization methods to help do so and jump off from)</div>

</br>

<div align="center"><b>Mapping Together</b></div>

<div align="center">
  MSL Curiosity Rover &nbsp;·&nbsp; InSight &nbsp;·&nbsp; Mars 2020 Perseverance Rover &nbsp;·&nbsp; Mars Helicopter (Ingenuity) &nbsp;·&nbsp; EMIT &nbsp;·&nbsp; MAIA &nbsp;·&nbsp; BioSCape &nbsp;·&nbsp; FireSense &nbsp;·&nbsp; Lunar VIPER &nbsp;·&nbsp; MGViz &nbsp;·&nbsp; SHIFT &nbsp;·&nbsp; FROZON &nbsp;·&nbsp; Where is the Rover &nbsp;·&nbsp; and more!
</div>

<div align="center"><img src="/docs/assets/images/divider.png" alt="---" width="100%" /></div>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Plugins](#plugins)
- [License](#license-apache-20)
- [Contacts](#contacts)

## Features

### Map Visualization

- **2D/3D rendering** - Leaflet-based 2D maps and Cesium/Lithosphere-powered 3D globes with synchronized views
- **Immersive viewers** - High-resolution imagery viewer, photospheres, 3D models, PDFs, and videos
- **Custom projections** - Support for planetary projections and custom coordinate systems
- **Terrain visualization** - Tiled height data generation

### Data & Layers

- **10 layer types** - Vector, Tile, Image, Model, Vectortile, Velocity, Video, Data, Header, and Query layers
- **Rich data formats** - GeoJSON, Shapefiles, GeoTIFF, COG, OBJ, GLTF, and more
- **Vector/raster tile serving** - MVT tile generation with PostGIS backend
- **TiTiler integration** - Serve Cloud-Optimized GeoTIFFs (COGs) on-the-fly with dynamic styling and band combinations
- **TiTiler STAC mosaicking** - Automatically mosaic multiple COGs from STAC catalogs into seamless, queryable layers
- **STAC catalogs** - Spatiotemporal Asset Catalog integration for discovering geospatial data
- **Dynamic styling** - Property-based styling with gradients, discrete values, and geologic patterns
- **Hierarchical organization** - Nested layer groups with visibility and opacity controls

### Interactive Tools

- **Animation** - Create animated GIFs and MP4s from map sequences
- **Chemistry** - Visualize chemical composition data from planetary samples
- **Curtain** - Display ground-penetrating radar subsurface imagery
- **Draw** - Multi-user collaborative vector drawing with real-time synchronization
- **Identifier** - Query pixel values from rasters and point data
- **Info** - Display feature properties and metadata
- **Isochrone** - Terrain traversability analysis and reachability mapping
- **Kinds** - Configure layer-specific click behaviors
- **Layers** - Manage layer visibility, ordering, and properties
- **Legend** - Auto-generated legends from layer styling and metadata
- **Measure** - Distance measurements, elevation profiles and line-of-sight analysis
- **Query** - Spatial and attribute queries across datasets
- **Shade** - Solar/Orbiter/Body illumination and shadow visualization via NAIF's SPICE
- **Sites** - Quick navigation bookmarks and saved viewpoints
- **TimeControl** - Time-enabled data visualization with temporal queries
- **Viewshed** - Line-of-sight visibility analysis

### Collaboration & Sharing

- **Real-time collaboration** - WebSocket-based synchronization across multiple users
- **Live drawing sync** - See teammate edits as they happen
- **Layer notifications** - Automatic updates when administrators modify layers
- **Configuration coordination** - Conflict detection for multi-admin editing

### Mission Management

- **Easy-to-use CMS** - Graphical configuration interface for mission setup
- **Flexible authentication** - Local accounts, OAuth2/SSO, or open access modes
- **Role-based access** - SuperAdmin, Admin, and User permission levels
- **Mission-specific access** - Control which users can view and edit each mission
- **API token management** - Long-term tokens for programmatic access
- **Multiple missions** - Host multiple independent mapping projects

### Advanced Features

- **Temporal data** - Time-based layer filtering and animation
- **Elevation profiling** - Extract terrain profiles along paths
- **Spatial queries** - PostGIS-powered geospatial analysis
- **Geodataset management** - Upload, index, and serve large vector/raster datasets
- **Custom tile generation** - Scripts for creating optimized tilesets
- **Plugin architecture** - Extend functionality with custom tools and backends
- **Webhook integration** - Connect MMGIS to external systems and workflows

<div align="center"><img src="/docs/assets/images/divider.png" alt="---" width="100%" /></div>

## Installation

It is recommended to setup MMGIS via docker. However, if you would like to setup MMGIS without docker, please check out: https://nasa-ammos.github.io/MMGIS/setup/installation#installing-without-docker

`/` will always refer to the repo's root directory.

### Building

Point to a prebuilt image in your docker-compose.yml: https://github.com/NASA-AMMOS/MMGIS/pkgs/container/mmgis

Or build it locally for a custom build:

1. Clone the repo  
   `git clone https://github.com/NASA-AMMOS/MMGIS`

1. Run:
   `docker build -t <image tag> .`

### Preparing

#### .env

- Copy `/sample.env` to `.env`  
   `cp sample.env .env`
- Open `.env` and update the following:

  ```
  DB_NAME=<name>
  DB_USER=<user>
  DB_PASS=<password>
  ```

  From the install example:

  ```
  DB_NAME=db
  DB_USER=postgres
  DB_PASS=<POSTGRES_PASSWORD (see below)>
  ```

- Set all the ENV variables in `.env`. More information about the ENVs can be found [here.](https://nasa-ammos.github.io/MMGIS/setup/envs)
  - If using the postgis/postgres image from within the docker-compose.yml, set the ENV `DB_HOST` to the name of the service (in this case `db`)

#### docker-compose.yml

This repo contains a `/docker-compose.sample.yml` file that defines a service for the application and a PostgreSQL database with PostGIS installed

- Copy this file to a `docker-compose.yml`.
- In the `db` service in `docker-compose.yml`, set the `POSTGRES_PASSWORD` environment variable and use this for MMGIS's `DB_PASS` ENV value.
- Fill out the other `environment` variables within the `docker-compose.yml` as well.
- Note, the `/docker-compose.sample.yml` includes optional STAC and TiTiler services. If any of them are unwanted, they can be removed from the docker-compose-yml and their respective `.env` variable `WITH_{service}` can be set to false.

### Running

Run: `docker-compose up -d`

### Stopping

Run: `docker-compose down`

### First Time UI Setup

1. Setup the admin account:
   - In your browser, navigate to `https://{your-mmgis-domain}/configure`
   - Sign up for an Administrator account (The Administrator account is always the first user in the database and you are only prompted to create an Administrator account if there are no other users)

1. Now sign in with your Administrator credentials

1. Click `NEW MISSION`  
   Enter a new mission name and click `MAKE MISSION`

Navigate to `https://{your-mmgis-domain}/`.

See the [configuration documentation](https://nasa-ammos.github.io/MMGIS/configure/) for more information on how to use the configure page to customize and add data to MMGIS.

<div align="center"><img src="/docs/assets/images/divider.png" alt="---" width="100%" /></div>

## Plugins

MMGIS supports a flexible plugin system for adding custom tools and backend functionality without modifying the core codebase.

### Tool Plugins

Place custom tools in directories matching `/src/essence/*Private-Tools*` or `/src/essence/*Plugin-Tools*`. These directories are automatically gitignored and loaded when you run `npm run build`.

### Component Plugins

Place miscellaneous custom UI behaviors and components in directories matching `/src/essence/*Private-Components*` or `/src/essence/*Plugin-Components*`. These directories are automatically gitignored and loaded when you run `npm run build`.

### Backend Plugins

Place custom backends in directories matching `/API/*Private-Backend*` or `/API/*Plugin-Backend*`. These directories are automatically gitignored and loaded when you run `npm start`.

For detailed plugin development instructions, see the [Contributing Guide](https://nasa-ammos.github.io/MMGIS/contributing/).

<div align="center"><img src="/docs/assets/images/divider.png" alt="---" width="100%" /></div>

## License: Apache 2.0

https://www.apache.org/licenses/LICENSE-2.0

Copyright (c) 2026, California Institute of Technology ("Caltech"). U.S. Government sponsorship acknowledged.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
- Redistributions must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
- Neither the name of Caltech nor its operating division, the Jet Propulsion Laboratory, nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

<div align="center"><img src="/docs/assets/images/divider.png" alt="---" width="100%" /></div>

## Contacts

Dr. Fred J. Calef III - fred.calef@jpl.nasa.gov  
Tariq K. Soliman - tariq.k.soliman@jpl.nasa.gov

Or join us on **[Slack](https://nasa-ammos.slack.com/archives/C076L0Q1P4H)**
