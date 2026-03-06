# MMGIS Kitchen Sink Demo Mission

**Version**: 4.1.18
**Region**: San Francisco Bay Area, California, Earth
**Purpose**: Comprehensive feature showcase, reference implementation, and testing target

## Overview

The Kitchen Sink mission is a comprehensive demonstration of **all MMGIS features, layer types, data formats, tools, and configuration options**. It serves three primary purposes:

1. **Reference Documentation** - Site administrators can examine this configuration to understand how to set up specific features
2. **Demonstration Platform** - Showcase the full extent of MMGIS capabilities for stakeholders, new users, and mission teams
3. **Testing Target** - Provides a stable, feature-complete mission for Playwright E2E testing and development validation

**⚠️ IMPORTANT**: This is a demo/testing mission only. It is **NOT** accessible through the normal mission list and requires the `FORCE_CONFIG_PATH` environment variable to be set explicitly.

---

## Usage

### How to Launch

Set the `FORCE_CONFIG_PATH` environment variable to point to the Kitchen Sink configuration:

```bash
# On Linux/Mac:
export FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json
npm start

# On Windows (CMD):
set FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json
npm start

# On Windows (PowerShell):
$env:FORCE_CONFIG_PATH="Missions/Kitchen-Sink/config.kitchen-sink.json"
npm start
```

Then navigate to `http://localhost:8888` in your browser.

### For Playwright Tests

```bash
# Set environment variable before running tests
FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json npm test
```

---

## Layer Catalog

The Kitchen Sink mission includes **30 layers** organized hierarchically by type and feature complexity.

### Vector Layers (21 layers)

All vector layers are **flat file GeoJSON** stored in `Layers/Vectors/`. They use SF Bay Area coordinates (~37.8°N, -122.4°W).

#### Points (10 layers)

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Vector - GeoJSON - Points Basic | `points-basic.geojson` | 8 | Simple circular markers with basic properties (id, name, description, category) |
| Vector - GeoJSON - Points Styled | `points-styled.geojson` | 8 | Per-feature styling via `properties.style` (fillColor, strokeColor, radius, opacity) |
| Vector - GeoJSON - Points Symbols | `points-symbols.geojson` | 10 | Different marker shapes (circle, square, triangle, diamond, star) and Material Design icons |
| Vector - GeoJSON - Clustered | `clustered.geojson` | 35 | Dense point clustering in 4 groups (downtown, marina, mission, scattered). Demonstrates clustering at various zoom levels |
| **Vector - Advanced - Labels** | `labels-example.geojson` | 5 | **Feature labels** - Points with visible name labels (Fisherman's Wharf, Union Square, Twin Peaks, Coit Tower, Painted Ladies). Uses default theme and size |
| **Vector - Advanced - Bearings Directional** | `bearings-example.geojson` | 5 | **Directional markers** - Ships with heading/bearing indicators showing direction of travel (NE, E, SE, S, NW). Includes heading angle and speed properties |
| **Vector - Advanced - Shape From MDI Icons** | `mdi-icons-example.geojson` | 4 | **Material Design Icons** - Points using MDI library icons (airplane for airport, icons for ferry, helicopter, train). Demonstrates shapeIcon configuration |
| **Vector - Advanced - Animated Pulse** | `animated-example.geojson` | 4 | **Animated features** - Points with pulse animation effect. Useful for highlighting alerts, active features, or real-time data |
| **Vector - Advanced - Annotations** | `annotations-example.geojson` | 4 | **Text annotations** - Points with styled text labels using `annotation: true` property. Supports custom colors, stroke, font size, and rotation |
| **Vector - Advanced - Uncertainty Ellipses** | `uncertainty-example.geojson` | 4 | **Position uncertainty** - GPS positions with uncertainty ellipses showing confidence regions. Uses markerAttachments.uncertainty with configurable axes and rotation |

#### Lines (4 layers)

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Vector - GeoJSON - Lines Basic | `lines-basic.geojson` | 4 | Simple solid stroke paths/routes |
| Vector - GeoJSON - Lines Styled | `lines-styled.geojson` | 5 | Various stroke styles: colors, weights, dash arrays (dashed, dotted, dash-dot patterns) |
| **Vector - Advanced - Arrows** | `arrows-example.geojson` | 4 | **Directional arrows** - LineStrings with `arrow: true` property. Displays as styled arrows with customizable colors and weights. Useful for flow direction, navigation, and vectors |
| **Vector - Advanced - Hotline Gradient Path** | `hotline-gradient.geojson` | 1 | **Path with elevation gradient** - Demonstrates hotline/gradient visualization with color ramp (blue→cyan→green→yellow→red) based on elevation values along the path |

#### Polygons (2 layers)

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Vector - GeoJSON - Polygons Basic | `polygons-basic.geojson` | 5 | Simple shapes with default fill/stroke (parks, districts, regions) |
| Vector - GeoJSON - Polygons Styled | `polygons-styled.geojson` | 5 | Different fill colors, opacities, stroke styles, including dashed borders |

#### Mixed Geometry & Special Features (5 layers)

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Vector - GeoJSON - Time-Enabled | `time-enabled.geojson` | 11 | Temporal data with 5 time steps (Days 1, 5, 10, 15, 20). Each feature has `startTime` property (ISO format). **Requires TimeControl tool** |
| Vector - GeoJSON - TEST Geodataset Example | `TEST-geodataset-example.geojson` | 8 | Simulates database-sourced geodataset features with rich metadata (status, timestamps, operators, data quality) |
| Vector - GeoJSON - TEST Draw File Example | `TEST-draw-file-example.geojson` | 8 | Simulates DrawTool user annotations with typical metadata (uuid, file_id, intent, created_by, tags, visibility) |
| **Vector - Advanced - Pairings Receivers** | `pairings-receivers.geojson` | 3 | **Pairing targets** - Receiver stations that pair with transmitters via matching `station_id`. Part of the pairings demonstration |
| **Vector - Advanced - Pairings Transmitters** | `pairings-example.geojson` | 3 | **Cross-layer connections** - Demonstrates layerAttachments.pairings to draw lines between transmitters and receivers with matching `station_id` properties. **Requires both layers enabled** |

### Raster Layers (7 layers)

#### Tiles (4 layers)

| Layer Name | Source | Purpose | Status |
|------------|--------|---------|--------|
| Tile - XYZ - OpenStreetMap | External (openstreetmap.org) | Standard OSM basemap | ✅ Live external data |
| Tile - XYZ - ArcGIS World Imagery | External (ArcGIS Online) | Satellite imagery basemap | ✅ Live external data |
| Tile - XYZ - ArcGIS World Topographic | External (ArcGIS Online) | Topographic map basemap | ✅ Live external data |
| Tile - Local - Basemap (Optional) | `Layers/Tiles/basemap/{z}/{x}/{y}.png` | User-provided local tiles | ⚠️ Placeholder (404 expected) |

**External Tile Attribution**:
- OpenStreetMap: © OpenStreetMap contributors
- ArcGIS: Esri, Maxar, Earthstar Geographics, and the GIS User Community

#### Images (2 layers)

| Layer Name | File | Purpose | Status |
|------------|------|---------|--------|
| Image - GeoTIFF - Single Band (Optional) | `Layers/Images/single-band.tif` | Single-band raster with colormap legend | ⚠️ Placeholder (404 expected) |
| Image - COG - Cloud Optimized (Optional) | `Layers/Images/cloud-optimized.tif` | Cloud-optimized GeoTIFF for efficient streaming | ⚠️ Placeholder (404 expected) |

#### Data (1 layer)

| Layer Name | File | Purpose | Status |
|------------|------|---------|--------|
| Data - WebGL - Elevation (Optional) | `Data/elevation/{z}/{x}/{y}.png` | DEM tileset for WebGL rendering and analysis | ⚠️ Placeholder (404 expected) |

### 3D Assets (3 layers)

| Layer Name | Source | Purpose | Status |
|------------|--------|---------|--------|
| Model - GLTF - Mars 2020 Perseverance Rover | NASA 3D Resources | Demonstrates model loading and positioning | ⚠️ External URL (may need update) |
| Model - GLTF - Ingenuity Mars Helicopter | NASA 3D Resources | Demonstrates model with elevation offset and rotation | ⚠️ External URL (may need update) |
| Model - GLTF - James Webb Space Telescope | NASA 3D Resources | Demonstrates large-scale model positioning | ⚠️ External URL (may need update) |

**Note**: NASA 3D model URLs currently point to resource pages. For actual loading, update `url` fields to direct GLTF download links from [NASA 3D Resources](https://science.nasa.gov/3d-resources/).

---

## Tool Catalog

The Kitchen Sink mission configures **14 interactive tools** with representative settings.

### Core Map Tools

- **Identifier** - Mouse-over pixel value queries (configured but requires DEM layer URLs)
- **Layers** - Hierarchical layer management (expanded: false)
- **Legend** - Layer legend display (right-justified, not displayed on start)
- **Info** - Feature property display (alphabetically sorted)

### Navigation

- **Sites** - Quick navigation bookmarks to 4 SF Bay locations:
  - Golden Gate Bridge (zoom 15)
  - Downtown San Francisco (zoom 13)
  - SF Bay Overview (zoom 11)
  - Alcatraz Island (zoom 16)

### Drawing & Annotation

- **Draw** - Collaborative vector drawing with:
  - 6 intent aliases: ROI, Campaign, Traverse, Waypoint, Annotation, All Features
  - Dynamic extent loading (threshold: `1000/z`)
  - Default filters: yours only (true), on (false), public (false)
  - 5 property templates: Priority (dropdown), Confidence (slider), Notes (textarea), Reviewed (checkbox), Observation Date (date)
  - Hover length enabled for lines

### Analysis Tools

- **Measure** - Distance measurement and elevation profiles
  - DEM: `Data/elevation.tif` (placeholder)
  - Default mode: continuous

- **Viewshed** - Line-of-sight visibility analysis
  - DEM tileset: `Data/dem-tiles/{z}/{x}/{y}.png` (placeholder)
  - Camera preset: Default (height 2m, azimuth 0°, elevation -10°)
  - Planetary curvature: enabled

- **Isochrone** - Traversability and reachability analysis
  - DEM tileset configured (placeholder)
  - Models: Traverse Time, Isodistance

- **Shade** - Sun/shadow illumination (no SPICE integration)
  - DEM: `Data/elevation.tif` (placeholder)
  - Source: Sun only (SPICE observers intentionally omitted per requirements)

### Specialized Tools

- **Chemistry** - Chemical composition visualization (basic config)
- **Curtain** - Ground-penetrating radar subsurface imagery (withCredentials: false)
- **Animation** - Map animation creation with export options:
  - GIF export: enabled
  - MP4 export: enabled (via ffmpeg.wasm in browser)
  - PNG export: disabled

---

## Test Data

The Kitchen Sink includes two files prefixed with `TEST-` to simulate database-sourced features:

### TEST-geodataset-example.geojson

Simulates what the `geodatasets:` layer URL format would return from the database. Includes:
- 8 features (3 monitoring stations, 2 survey transects, 3 zones)
- Rich metadata: status, last_reading timestamps, sensor types, operators, data quality indicators
- Examples of seismic, weather, water quality, field survey, and environmental hazard data

### TEST-draw-file-example.geojson

Simulates what the `api:drawn:` layer URL format would return from DrawTool files. Includes:
- 8 user-drawn annotations (3 points, 2 lines, 3 polygons)
- DrawTool metadata: uuid, file_id, intent, created_by, created_at, updated_by, updated_at, visibility, tags
- Example intents: poi, annotation, roi, campaign

---

## Optional Data

The Kitchen Sink configuration includes **placeholder URLs** for optional user-provided data. These layers will show 404 errors until data is added, which is expected and acceptable.

### How to Add Local Tiles

1. Generate tiles using `gdal2tiles.py` or similar:
   ```bash
   gdal2tiles.py --zoom=8-18 input.tif Missions/Kitchen-Sink/Layers/Tiles/basemap/
   ```

2. Tiles should follow TMS or XYZ structure: `{z}/{x}/{y}.png`

3. Sources for tiles:
   - **USGS TopoView**: https://ngmdb.usgs.gov/topoview/
   - **OpenStreetMap extracts**: https://download.geofabrik.de/
   - **Natural Earth Data**: https://www.naturalearthdata.com/

### How to Add DEMs

1. Download DEM data:
   - **USGS 3DEP**: https://apps.nationalmap.gov/downloader/
   - **NASA SRTM**: https://www.earthdata.nasa.gov/
   - **Copernicus DEM**: https://spacedata.copernicus.eu/

2. Convert to COG (Cloud Optimized GeoTIFF):
   ```bash
   gdal_translate -of COG -co COMPRESS=DEFLATE input.tif Missions/Kitchen-Sink/Data/elevation.tif
   ```

3. For tiled DEMs, use `1bto4b` or `gdal2tiles` scripts (see `auxiliary/` directory)

### How to Add GeoTIFFs

1. Ensure image is georeferenced (has coordinate system metadata)

2. Convert to COG for efficient streaming:
   ```bash
   gdal_translate -of COG -co COMPRESS=JPEG -co QUALITY=85 input.tif output.tif
   ```

3. Place in `Missions/Kitchen-Sink/Layers/Images/`

### How to Add 3D Models

1. Visit [NASA 3D Resources](https://science.nasa.gov/3d-resources/)

2. Find models in GLTF, OBJ, or DAE format

3. **Option A**: Use external URL (recommended for large files):
   - Update layer `url` field to direct download link

4. **Option B**: Download locally (for offline demos):
   - Place in `Missions/Kitchen-Sink/Layers/Models/`
   - Update layer `url` to relative path

**Note**: The config currently uses NASA 3D Resources page URLs. For actual loading, replace with direct GLTF download URLs.

---

## Troubleshooting

### Mission doesn't load

**Problem**: Navigating to `http://localhost:8888` shows empty landing page or different mission.

**Solution**: Ensure `FORCE_CONFIG_PATH` environment variable is set before starting the server:
```bash
FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json npm start
```

### 404 errors for optional data

**Problem**: Browser console shows 404 errors for tile layers, images, DEMs, or models.

**Solution**: This is expected! Optional data layers use placeholder URLs. Either:
- Ignore the 404s (they won't crash the app)
- Add your own data following the "Optional Data" section above
- Toggle off the optional layers in the Layers tool

### External tiles not loading

**Problem**: OpenStreetMap or ArcGIS tiles don't appear.

**Solution**:
- Check browser console for CORS or network errors
- Verify internet connection
- Check if tile provider is accessible (providers occasionally have downtime)
- Try a different external tile layer

### Models don't load in Globe view

**Problem**: NASA 3D models don't appear when layer is toggled on.

**Solution**:
- Current model URLs point to NASA resource pages, not direct GLTF files
- Find the actual GLTF download URL on the NASA 3D Resources page
- Update the layer's `url` field in `config.kitchen-sink.json`
- Alternatively, download models locally and use relative paths

### Time-enabled layer doesn't respond to time controls

**Problem**: Time-Enabled vector layer is visible but doesn't filter by time.

**Solution**:
- Ensure TimeControl tool is configured in `tools` array
- Check that layer has `time` configuration with `type: "local"`, `startProp: "startTime"`, `format: "ISO"`
- TimeControl UI should appear in toolbar - use it to select time range

### Clustering doesn't work

**Problem**: Clustered layer shows all 35 points individually at all zoom levels.

**Solution**:
- Verify layer has `"clustering": true` in config
- Zoom out to see clusters form (clustering is zoom-dependent)
- At high zoom levels, clusters naturally break apart to show individual points

---

## Version Compatibility

**IMPORTANT**: The Kitchen Sink mission version **MUST** match the MMGIS version.

- **Current**: Kitchen Sink v4.1.18 ↔ MMGIS v4.1.18
- **Constitution Requirement**: When MMGIS features change, Kitchen Sink must be updated

See `.specify/memory/constitution.md` for the Kitchen Sink maintenance requirement and pre-merge checklist.

---

## Future Expansion

This Kitchen Sink configuration is designed for **Earth (SF Bay Area)**. Future expansions could include:

- **Multi-Config Pattern**: `config.kitchen-sink-mars.json`, `config.kitchen-sink-moon.json` for planetary demos
- **VectorTile Layers**: If MVT data source is identified
- **Velocity Layers**: If wind/flow data is obtained
- **Video Layers**: If georeferenced video is available
- **SPICE Integration**: Add Shade tool observers for spacecraft time computations (currently skipped)
- **Complete DEM Coverage**: Replace placeholders with actual USGS/SRTM elevation data
- **Playwright Deep Tests**: Expand beyond smoke tests to tool interactions

---

## Contributing

When adding new features to MMGIS:

1. **Update Kitchen Sink**: Add configuration examples to `config.kitchen-sink.json`
2. **Add Sample Data**: If the feature requires new data formats, add representative files to `Layers/`
3. **Update This README**: Document the new layer/tool in the appropriate catalog section
4. **Update Spec**: If substantial, create a new spec in `specs/` following the spec-kit workflow
5. **Constitution Check**: Verify the "Kitchen Sink mission updated" checklist item before merging

See `AI-DEVELOPMENT.md` and `.specify/memory/constitution.md` for the development workflow.

---

## License

This mission configuration and sample data are part of MMGIS and fall under the same Apache-2.0 license.

**Attributions**:
- External tile data: © OpenStreetMap contributors, Esri, Maxar, and others (see Layer Catalog)
- NASA 3D models: NASA/JPL-Caltech (Public Domain)
- Sample vector data: Synthetic data created for demonstration purposes

---

## Questions?

- **MMGIS Documentation**: https://nasa-ammos.github.io/MMGIS/
- **GitHub Issues**: https://github.com/NASA-AMMOS/MMGIS/issues
- **Configure UI**: http://localhost:8888/configure (when server running)

**Remember**: Kitchen Sink is for demo/testing only. For production missions, create a new mission configuration through the Configure UI or by copying and modifying this config.
