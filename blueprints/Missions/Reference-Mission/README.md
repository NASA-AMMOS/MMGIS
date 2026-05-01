# MMGIS Reference Mission Demo Mission

**Version**: 4.1.18
**Region**: San Francisco Bay Area, California, Earth
**Purpose**: Comprehensive feature showcase, reference implementation, and testing target

## Overview

The Reference Mission mission is a comprehensive demonstration of **all MMGIS features, layer types, data formats, tools, and configuration options**. It serves three primary purposes:

1. **Reference Documentation** - Site administrators can examine this configuration to understand how to set up specific features
2. **Demonstration Platform** - Showcase the full extent of MMGIS capabilities for stakeholders, new users, and mission teams
3. **Testing Target** - Provides a stable, feature-complete mission for Playwright E2E testing and development validation

**⚠️ IMPORTANT**: This is a demo/testing mission only. It is **NOT** accessible through the normal mission list and requires the `FORCE_CONFIG_PATH` environment variable to be set explicitly.

---

## Usage

### How to Launch

Set the `FORCE_CONFIG_PATH` environment variable to point to the Reference Mission configuration:

```bash
# On Linux/Mac:
export FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json
npm start

# On Windows (CMD):
set FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json
npm start

# On Windows (PowerShell):
$env:FORCE_CONFIG_PATH="Missions/Reference-Mission/config.reference-mission.json"
npm start
```

Then navigate to `http://localhost:8888` in your browser.

### For Playwright Tests

```bash
# Set environment variable before running tests
FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json npm test
```

### Managing Configuration

The Reference-Mission mission supports special configuration management features in the Configure page:

#### Creating the Reference-Mission Mission

1. Navigate to the Configure page at `http://localhost:8888/configure`
2. Click "New Mission" button
3. Check "Setup Reference Mission Demo (creates or updates 'Reference-Mission' mission)"
4. Click "Make Mission"

This creates a single reusable `Reference-Mission` mission (without timestamps). If the mission already exists, it will be updated to the latest version.

#### Home Tab Buttons (Configure Page)

When viewing the Reference-Mission mission in the Configure page, the Home tab shows special buttons:

**🔄 Load from Template** (always visible):
- Updates the current Reference-Mission mission with the config from `blueprints/Missions/Reference-Mission/config.reference-mission.json`
- Useful for resetting to the reference implementation after making experimental changes
- Reloads the page after updating

**💾 Save to Template** (development mode only):
- Saves the current Reference-Mission config back to `blueprints/Missions/Reference-Mission/config.reference-mission.json`
- Only visible when `NODE_ENV=development`
- Useful for developers updating the reference implementation after adding new demo features

**Workflow Example**:
```bash
# 1. Start in development mode
NODE_ENV=development npm start

# 2. Make changes to Reference-Mission in Configure page
# 3. Click "Save to Template" to persist changes to blueprints/
# 4. Changes are now part of the reference implementation
# 5. Click "Load from Template" anytime to revert to saved state
```

---

## Layer Catalog

The Reference Mission mission includes **44 layers** organized into two main categories: **GeoJSON Data Features** (what you put in your data files) and **Layer Configuration** (what you set in the Configure page).

### Vector Layers (36 layers)

All vector layers are **flat file GeoJSON** (or KML converted to GeoJSON at runtime) stored in `Layers/Vectors/`. They use SF Bay Area coordinates (~37.8°N, -122.4°W).

The layers are organized into:
- **📄 GeoJSON Data Features** (18 layers) - Features driven by geometry types and feature properties
- **⚙️ Layer Configuration** (18 layers) - Features driven by layer config settings

---

### 📄 GeoJSON Data Features (18 layers)

Features driven by **geometry types** and **feature properties** in your GeoJSON files.

#### Geometry Types (5 layers)

Basic examples of each geometry type.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Points Basic | `points-basic.geojson` | 8 | Simple circular markers with basic properties (id, name, description, category) |
| Lines Basic | `lines-basic.geojson` | 4 | Simple solid stroke paths/routes |
| Polygons Basic | `polygons-basic.geojson` | 5 | Simple shapes with default fill/stroke (parks, districts, regions) |
| Arrows | `arrows-example.geojson` | 4 | LineStrings with `arrow: true` property - displays as directional arrows |
| Annotations | `annotations-example.geojson` | 4 | Points with `annotation: true` property - styled text labels with custom colors, rotation |

#### Feature Property Styling (4 layers)

Per-feature styling via `properties.style` objects or specific style properties.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Points Styled | `points-styled.geojson` | 8 | Per-feature styling via `properties.style` (fillColor, strokeColor, radius, opacity) |
| Lines Styled | `lines-styled.geojson` | 5 | Various stroke styles: colors, weights, dash arrays (dashed, dotted, dash-dot patterns) |
| Polygons Styled | `polygons-styled.geojson` | 5 | Different fill colors, opacities, stroke styles, including dashed borders |
| Style From Property | `style-from-property.geojson` | 5 | Features with `fillColor`, `strokeColor`, `radius`, etc. properties used by `style.fillColorProp` config |

#### Feature Property Behavior (8 layers)

Feature behaviors driven by specific properties in the GeoJSON.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Points Symbols | `points-symbols.geojson` | 10 | Features with `shape` property (circle, square, triangle, diamond, star) |
| Bearings Directional | `bearings-example.geojson` | 5 | Features with `heading` property showing direction of travel |
| Shape From MDI Icons | `mdi-icons-example.geojson` | 4 | Features with `icon` property using Material Design Icons |
| Hotline Gradient Path | `hotline-gradient.geojson` | 1 | Path with `elevation` property values for color gradient visualization |
| Hotline Gradient 3D | `hotline-gradient-3d.geojson` | — | 3D gradient polyline with elevation-based positioning in the Cesium globe |
| Uncertainty Ellipses | `uncertainty-example.geojson` | 4 | Features with `xAxis`, `yAxis`, `angle` properties for position uncertainty |
| Pairings Transmitters | `pairings-example.geojson` | 3 | Features with `station_id` property (transmitting end) - pairs with Receivers via matching IDs |
| Pairings Receivers | `pairings-receivers.geojson` | 3 | Features with `station_id` property (receiving end) |

#### Miscellaneous (1 layer)

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| KML | `sample-kml.kml` | 5 | KML file support - Points, LineString, and Polygon loaded from a .kml file instead of GeoJSON |

---

### ⚙️ Layer Configuration (18 layers)

Features driven by **layer configuration** in the Configure page (config.json settings).

#### Core Settings Tab (3 layers)

Basic layer visibility and zoom constraints.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Initially Visible | `initially-visible.geojson` | 1 | Tests `visibility: true` - Only layer visible by default |
| Zoom - Layer Config (10-14) | `zoom-layer-config.geojson` | — | Tests `minZoom: 10, maxZoom: 14` - Only visible at specific zoom levels |
| Zoom - Feature Properties | `zoom-feature-props.geojson` | — | Tests zoom constraints via feature properties |

#### Style Tab (2 layers)

Style-related configuration options.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Animated Pulse | `animated-example.geojson` | 4 | Tests `style.animation: "pulse"` - Animated markers with pulse effect |
| Clustered | `clustered.geojson` | 35 | Tests `clustering: true` - Point clustering at various zoom levels |

#### Time Tab (2 layers)

Temporal configuration options.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Time-Enabled | `time-enabled.geojson` | 11 | Mixed geometry with temporal data (5 time steps). Features have `startTime` property. **Requires TimeControl tool** |
| Time - Refresh Interval | `time-refresh-interval.geojson` | 4 | Tests `time.refreshIntervalEnabled: true` and `time.refreshIntervalAmount: 30` - Auto-refreshes every 30 seconds |

#### Legend Tab (1 layer)

Legend configuration.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Legend Test | `legend-test.geojson` | 5 | Tests `legend: "path/to/csv"` with categorical symbology (high/medium/low priority) |

#### Filter Tab (1 layer)

Initial filter configuration.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Initial Filters | `initial-filters.geojson` | 5 | Tests `variables.initialFilters` - Shows only features where `status == "active"` by default |

#### Interface Tab (4 layers)

User interface configuration options.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Hover Feature Labels | `hover-labels.geojson` | 3 | Tests `variables.useKeyAsName` - Shows custom properties on hover |
| External Links | `external-links.geojson` | 3 | Tests `variables.links` - Displays deep links in top bar when feature clicked |
| TopBar Information | `topbar-info.geojson` | 2 | Tests `variables.info` - Displays layer properties in top bar |
| Tags and Description | `tags-description.geojson` | 3 | Tests `tags` array and `description` field for layer organization |

#### Attachment - Labels Tab (1 layer)

Label attachment configuration.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Labels | `labels-example.geojson` | 5 | Tests `variables.layerAttachments.labels` - Visible name labels on features |

#### Attachment - Coordinates Tab (1 layer)

Coordinate display attachment.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Attachment - Coordinates | `coordinates-marker.geojson` | 3 | Tests `variables.coordinateAttachments.marker` - Displays coordinates at each marker |

#### Attachment - Markers Tab (2 layers)

Marker image attachment.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Attachment - Image (Per-Feature) | `image-marker.geojson` | 3 | Tests `variables.markerAttachments.image` - Displays scaled/oriented images under markers |
| Attachment - Image (Shared + Rotation) | `image-shared.geojson` | — | Tests shared image attachments with rotation configuration |

#### Special (1 layer)

Special features and shortcuts.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| Keyboard Shortcut Demo - Alt+K | `keyboard-shortcut-demo.geojson` | 1 | Tests `variables.shortcutSuffix` - Layer toggleable with Alt+K |

---

### Old Structure (for reference)

<details>
<summary>Click to see the old organization by geometry type</summary>

#### Points (10 layers)
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

#### Configure Page Testing (14 layers)

Test layers demonstrating specific Configure page options and layer configuration features.

| Layer Name | File | Features | Purpose |
|------------|------|----------|---------|
| **Initially Visible** | `initially-visible.geojson` | 1 | Tests `visibility: true` - Only layer visible by default to verify initial visibility setting |
| **Zoom Constrained - Points** | `zoom-constrained-points.geojson` | 3 | Tests `minZoom: 10, maxZoom: 14` - Points only visible at zoom levels 10-14 (mission starts at zoom 12) |
| **Zoom Constrained - Lines** | `zoom-constrained-lines.geojson` | 2 | Tests zoom constraints on LineString geometry |
| **Zoom Constrained - Polygons** | `zoom-constrained-polygons.geojson` | 2 | Tests zoom constraints on Polygon geometry |
| **Style From Property** | `style-from-property.geojson` | 5 | Tests `style.fillColorProp`, `style.colorProp`, `style.radiusProp`, `style.weightProp`, `style.opacityProp`, `style.fillOpacityProp` - Each feature defines its own style via properties |
| **Time - Refresh Interval** | `time-refresh-interval.geojson` | 4 | Tests `time.refreshIntervalEnabled: true` and `time.refreshIntervalAmount: 30` - Auto-refreshes data every 30 seconds |
| **Legend Test** | `legend-test.geojson` | 5 | Tests legend CSV configuration with categorical symbology (high/medium/low priority) |
| **Initial Filters** | `initial-filters.geojson` | 5 | Tests `variables.initialFilters` - Only shows features where `status == "active"` by default |
| **Hover Feature Labels** | `hover-labels.geojson` | 3 | Tests `variables.useKeyAsName` - Shows custom properties (name, elevation, temperature, status) on hover |
| **External Links** | `external-links.geojson` | 3 | Tests `variables.links` - Displays deep links in top bar when feature is clicked |
| **TopBar Information** | `topbar-info.geojson` | 2 | Tests `variables.info` - Displays layer properties in top bar (mission time, temperature from last feature) |
| **Tags and Description** | `tags-description.geojson` | 3 | Tests `tags` array and `description` field for layer organization and searchability |
| **Attachment - Coordinates** | `coordinates-marker.geojson` | 3 | Tests `variables.coordinateAttachments.marker` - Places markers at every coordinate with position display |
| **Attachment - Image** | `image-marker.geojson` | 3 | Tests `variables.markerAttachments.image` - Displays scaled/oriented images under markers (uses placeholder images) |

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

The Reference Mission mission configures **14 interactive tools** with representative settings.

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

The Reference Mission includes two files prefixed with `TEST-` to simulate database-sourced features:

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

The Reference Mission configuration includes **placeholder URLs** for optional user-provided data. These layers will show 404 errors until data is added, which is expected and acceptable.

### How to Add Local Tiles

1. Generate tiles using `gdal2tiles.py` or similar:
   ```bash
   gdal2tiles.py --zoom=8-18 input.tif Missions/Reference-Mission/Layers/Tiles/basemap/
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
   gdal_translate -of COG -co COMPRESS=DEFLATE input.tif Missions/Reference-Mission/Data/elevation.tif
   ```

3. For tiled DEMs, use `1bto4b` or `gdal2tiles` scripts (see `auxiliary/` directory)

### How to Add GeoTIFFs

1. Ensure image is georeferenced (has coordinate system metadata)

2. Convert to COG for efficient streaming:
   ```bash
   gdal_translate -of COG -co COMPRESS=JPEG -co QUALITY=85 input.tif output.tif
   ```

3. Place in `Missions/Reference-Mission/Layers/Images/`

### How to Add 3D Models

1. Visit [NASA 3D Resources](https://science.nasa.gov/3d-resources/)

2. Find models in GLTF, OBJ, or DAE format

3. **Option A**: Use external URL (recommended for large files):
   - Update layer `url` field to direct download link

4. **Option B**: Download locally (for offline demos):
   - Place in `Missions/Reference-Mission/Layers/Models/`
   - Update layer `url` to relative path

**Note**: The config currently uses NASA 3D Resources page URLs. For actual loading, replace with direct GLTF download URLs.

---

## Troubleshooting

### Mission doesn't load

**Problem**: Navigating to `http://localhost:8888` shows empty landing page or different mission.

**Solution**: Ensure `FORCE_CONFIG_PATH` environment variable is set before starting the server:
```bash
FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json npm start
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
- Update the layer's `url` field in `config.reference-mission.json`
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

**IMPORTANT**: The Reference Mission mission version **MUST** match the MMGIS version.

- **Current**: Reference Mission v4.1.18 ↔ MMGIS v4.1.18
- **Constitution Requirement**: When MMGIS features change, Reference Mission must be updated

See `.specify/memory/constitution.md` for the Reference Mission maintenance requirement and pre-merge checklist.

---

## Future Expansion

This Reference Mission configuration is designed for **Earth (SF Bay Area)**. Future expansions could include:

- **Multi-Config Pattern**: `config.reference-mission-mars.json`, `config.reference-mission-moon.json` for planetary demos
- **VectorTile Layers**: If MVT data source is identified
- **Velocity Layers**: If wind/flow data is obtained
- **Video Layers**: If georeferenced video is available
- **SPICE Integration**: Add Shade tool observers for spacecraft time computations (currently skipped)
- **Complete DEM Coverage**: Replace placeholders with actual USGS/SRTM elevation data
- **Playwright Deep Tests**: Expand beyond smoke tests to tool interactions

---

## Contributing

When adding new features to MMGIS:

1. **Update Reference Mission**: Add configuration examples to `config.reference-mission.json`
2. **Add Sample Data**: If the feature requires new data formats, add representative files to `Layers/`
3. **Update This README**: Document the new layer/tool in the appropriate catalog section
4. **Update Spec**: If substantial, create a new spec in `specs/` following the spec-kit workflow
5. **Constitution Check**: Verify the "Reference Mission mission updated" checklist item before merging

See `knowledge/AI-DEVELOPMENT.md` and `.specify/memory/constitution.md` for the development workflow.

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

**Remember**: Reference Mission is for demo/testing only. For production missions, create a new mission configuration through the Configure UI or by copying and modifying this config.
