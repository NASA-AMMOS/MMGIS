# Data Formats & Layer Types - Comprehensive Reference

## Overview

MMGIS supports a rich ecosystem of geospatial data formats and layer types designed for planetary science missions. This specification provides a comprehensive reference for all supported layer types, file formats, storage locations, and configuration options available in the MMGIS mapping platform.

The system is built around flexibility, allowing mission teams to integrate diverse data sources—from rover telemetry to orbital imagery—into a unified geospatial interface with both 2D (Leaflet) and 3D (Cesium) rendering capabilities.

## Layer Types Overview

MMGIS supports **10 distinct layer types**, each optimized for specific data visualization needs:

1. **Vector** - Point, line, and polygon features with rich metadata
2. **Tile** - Hierarchical raster imagery tilesets (TMS/WMTS/WMS)
3. **Data** - WebGL shader-based dynamic visualization from DEM data
4. **Model** - 3D models for Globe view (OBJ, GLTF, DAE)
5. **Image** - Single-band GeoTIFF/COG imagery with dynamic colormaps
6. **VectorTile** - Mapbox Vector Tiles for efficient vector rendering
7. **Velocity** - Flow/wind data visualization (streamlines, particles, arrows)
8. **Video** - Video overlays on the map surface
9. **Header** - Organizational grouping layer (no data rendering)
10. **Query** - Internal layer type for query results

---

## 1. Vector Layer

### Purpose
Display GeoJSON point, line, and polygon features with extensive styling and metadata capabilities. Primary layer type for mission annotations, rover paths, science targets, and collaborative drawing.

### Supported File Formats

#### GeoJSON (`.geojson`, `.json`)
- Standard GeoJSON specification
- Enhanced GeoJSON with MMGIS-specific properties
- Nested property access via dot notation (e.g., `properties.metadata.temperature`)
- Per-feature styling via `properties.style` object

#### STAC (SpatioTemporal Asset Catalog)
- STAC Items via `stac-item:` URL prefix
- STAC Catalogs via `stac-catalog:` URL prefix
- STAC Collections via `stac-collection:` URL prefix
- Automatic conversion to GeoJSON features

### Storage Locations

#### Flat Files
- **Path**: Relative or absolute paths to `.geojson` files in mission directories
- **Example**: `Missions/MyMission/layers/science_targets.geojson`
- **Access**: Direct file serving or through MMGIS tile server

#### PostGIS Geodatasets
- **Format**: `geodatasets:{dataset_name}`
- **Backend**: PostgreSQL with PostGIS extension
- **Tables**: Dynamic `g{n}_geodatasets` tables with spatial indexing
- **Features**:
  - GIST spatial index on geometry column
  - Temporal indexing (start_time, end_time)
  - Group and feature ID indexing
  - JSON properties storage
  - Support for all GeoJSON geometry types

#### API Endpoints
- **Published Features**: `api:publishedall` - All published DrawTool features
- **Intent-Based**: `api:published:{intent}` where intent is:
  - `roi` - Regions of Interest
  - `campaign` - Campaign boundaries
  - `campsite` - Campsite locations
  - `signpost` - Waypoint markers
  - `trail` - Traverse paths
  - `all` - All intents
- **Specific File**: `api:drawn:{file_id}` - Specific DrawTool file by ID
- **Tactical Targets**: `api:tacticaltargets` - Ingested tactical target data

#### Remote Servers
- Any URL returning valid GeoJSON
- Cross-origin requests supported with CORS
- Optional authentication headers

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`url`** (string, required): Data source URL or path
- **`type`** (string, required): Must be `"vector"`
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Visibility Controls
- **`minZoom`** (number): Minimum zoom level for visibility
- **`maxZoom`** (number): Maximum zoom level for visibility
- **`visibilityCutoff`** (number): Features beyond this zoom level are not rendered

#### Styling Options

**Stroke (Lines/Polygon Borders)**:
- **`strokeColor`** (string): CSS color or hex, default '#000000'
- **`strokeOpacity`** (number, 0-1): Stroke opacity, default 1
- **`strokeWeight`** (number): Line width in pixels, default 2
- **`dashArray`** (string): SVG dash pattern (e.g., "5, 5" for dashes)

**Fill (Polygons)**:
- **`fillColor`** (string): CSS color or hex, default '#ffffff'
- **`fillOpacity`** (number, 0-1): Fill opacity, default 0.3

**Markers (Points)**:
- **`radius`** (number): Circle marker radius in pixels, default 8
- **`shape`** (string): Marker shape - `circle`, `square`, `triangle`, `diamond`, `star`
- **`symbol`** (string): Material Design icon name or custom SVG path
- **`symbolSize`** (number): Symbol size multiplier, default 1
- **`symbolRotation`** (number): Symbol rotation in degrees, default 0
- **`symbolColor`** (string): Symbol color override

**Per-Feature Styling**:
Features can override layer styling via `properties.style`:
```json
{
  "type": "Feature",
  "properties": {
    "style": {
      "fillColor": "#ff0000",
      "fillOpacity": 0.7,
      "strokeColor": "#000000",
      "strokeWeight": 3
    }
  },
  "geometry": {...}
}
```

#### Time-Enabled Layers

**Time Type**:
- **`time.type`** (string):
  - `"global"` - Uses application-wide TimeControl
  - `"individual"` - Layer has independent time controls
  - `"requery"` - Fetches new data when time changes
  - `"local"` - Filters existing data client-side

**Time Filtering (Local Mode)**:
- **`time.startProp`** (string): Path to feature start time property (dot notation supported)
- **`time.endProp`** (string): Path to feature end time property (optional, for ranges)
- **`time.format`** (string): Time format - `"unix"` (milliseconds) or `"ISO"` (UTC with 'Z')

**Time Requery (Requery Mode)**:
- **URL Placeholders**:
  - `{time}` - Single time value
  - `{starttime}` - Start of time range
  - `{endtime}` - End of time range
- **`time.format`** (string): strftime format string (e.g., `"%Y-%m-%dT%H:%M:%SZ"`)

**Refresh Intervals**:
- **`time.refreshInterval`** (number): Auto-refresh interval in seconds, default 60

#### Dynamic Extent (Viewport-Based Queries)

**Purpose**: Query only features within the current map viewport, enabling server-side spatial filtering for large datasets.

**Configuration**:
- **`controlled`** (boolean): Enable dynamic extent mode, default false
- **`controlledUrl`** (string): Base URL for dynamic queries (overrides `url`)

**URL Parameter Injection**:
MMGIS automatically injects these parameters into the controlled URL:
- **`{minx}`**, **`{miny}`**, **`{maxx}`**, **`{maxy}`** - Bounding box coordinates
- **`{starttime}`**, **`{endtime}`** - Time range (if time-enabled)
- **`{startprop}`**, **`{endprop}`** - Time property names
- **`{crscode}`** - Coordinate reference system code
- **`{zoom}`** - Current zoom level

**Move Threshold**:
- **`controlledMoveThreshold`** (number): Minimum map movement (in map units) before re-querying, default varies by zoom level

#### Layer Attachments

**Labels**:
- **`layerAttachments.labels`** (object):
  - **`initialVisibility`** (boolean): Labels visible on load
  - **`property`** (string): Feature property to display
  - **`color`** (string): Text color
  - **`size`** (number): Font size in pixels
  - **`weight`** (string): Font weight - `"normal"`, `"bold"`
  - **`backgroundColor`** (string): Label background color
  - **`offset`** (array[2]): Pixel offset [x, y] from feature

**Pairings** (Cross-Layer Feature Linking):
- **`layerAttachments.pairings`** (object):
  - **`layerUUID`** (string): Target layer UUID to link with
  - **`prop`** (string): Property containing pairing ID
  - **`color`** (string): Pairing line color
  - **`weight`** (number): Pairing line width

**Coordinate Markers**:
- **`layerAttachments.markers`** (boolean): Show marker at every coordinate, default false

**Uncertainty Ellipses**:
- **`layerAttachments.uncertainty`** (object):
  - **`initialVisibility`** (boolean): Ellipses visible on load
  - **`ellipseMode`** (string): `"2d"` or `"3d"`
  - **`ellipseProperties`** (array[6]): Property names for [x, y, z, xx, yy, zz] covariance
  - **`color`** (string): Ellipse color
  - **`opacity`** (number, 0-1): Ellipse opacity

**Images** (Feature-Attached Image Overlays):
- **`layerAttachments.images`** (object):
  - **`initialVisibility`** (boolean): Images visible on load
  - **`path`** (string): Property containing image URL
  - **`scale`** (string): Property for image scale factor
  - **`rotation`** (string): Property for rotation in degrees
  - **`opacity`** (number, 0-1): Image opacity

**3D Models** (Feature-Attached Models):
- **`layerAttachments.model`** (object):
  - **`initialVisibility`** (boolean): Models visible on load
  - **`path`** (string): Property containing model file URL (.obj, .gltf)
  - **`mtl`** (string): Property containing material file URL (.mtl for OBJ)
  - **`scale`** (string): Property for model scale factor
  - **`rotation`** (array[3]): Properties for rotation [X, Y, Z] in radians

**Path Gradients** (Value Visualization Along Paths):
- **`pathAttachments.gradient`** (object):
  - **`initialVisibility`** (boolean): Gradients visible on load
  - **`property`** (string): Feature property to visualize
  - **`colormap`** (string): Colormap name (e.g., "viridis", "plasma")
  - **`min`** (number): Minimum value for color scale
  - **`max`** (number): Maximum value for color scale
  - **`weight`** (number): Line width in pixels

#### Marker Attachments (Point Features Only)

**Bearing Indicators**:
- **`markerAttachments.bearing`** (object):
  - **`initialVisibility`** (boolean): Bearing arrows visible on load
  - **`angleProp`** (string): Property containing bearing angle in degrees
  - **`lengthProp`** (string): Property for arrow length
  - **`color`** (string): Arrow color
  - **`weight`** (number): Arrow line width

**Uncertainty** (Point-Specific):
- Same as layerAttachments.uncertainty but applies per-marker

**Images** (Point-Specific):
- Same as layerAttachments.images but applies per-marker

**Models** (Point-Specific):
- Same as layerAttachments.model but applies per-marker

#### Sublayer System

Features can be organized into user-toggleable sublayers:
- **`sublayers`** (array): List of sublayer definitions
  - **`name`** (string): Sublayer display name
  - **`type`** (string): Sublayer type - `"labels"`, `"pairings"`, `"markers"`, `"uncertainty"`, `"images"`, `"models"`
  - **`initialVisibility`** (boolean): Sublayer visible on load
  - **`opacity`** (number, 0-1): Sublayer opacity

Users can toggle sublayers independently in the Layers Tool interface.

#### Dataset Links

Link features to external CSV datasets:
- **`properties.datasets`** (array): List of dataset references
  - **`name`** (string): Dataset display name
  - **`url`** (string): CSV file URL
  - **`key`** (string): Feature property to match against dataset key column

#### Deep Links

Link features to external websites or documents:
- **`properties.links`** (array): List of external links
  - **`name`** (string): Link display name
  - **`url`** (string): Target URL
  - **`icon`** (string): Material Design icon name

#### Info Records

Display feature information on startup:
- **`properties.info`** (object): Startup info configuration
  - **`showOnStartup`** (boolean): Display info panel on load
  - **`priority`** (number): Display order (lower = higher priority)

---

## 2. Tile Layer

### Purpose
Display hierarchical raster imagery tilesets following web map tile standards (TMS, WMTS, WMS). Primary layer type for basemaps, aerial imagery, DEMs rendered as imagery, and time-series satellite data.

### Supported Tile Formats

#### TMS (Tile Map Service)
- **URL Pattern**: `/{z}/{x}/{y}.png` or `/{z}/{x}/{y}.jpg`
- **Coordinate System**: Standard XYZ tiling scheme
- **Y-Axis**: Y=0 at bottom (South)

#### WMTS (Web Map Tile Service)
- **URL Pattern**: Same as TMS
- **Y-Axis**: Y=0 at top (North) - inverted from TMS
- **Specification**: OGC WMTS 1.0.0

#### WMS (Web Map Service)
- **Protocol**: OGC WMS 1.1.1 or 1.3.0
- **Parameters**: `LAYERS`, `STYLES`, `FORMAT`, `BBOX`, `SRS`/`CRS`, `WIDTH`, `HEIGHT`
- **Use Case**: Professional GIS servers, dynamic rendering

#### Cloud Optimized GeoTIFF (COG)
- **Prefix**: `COG:` before tile URL
- **Format**: HTTP range-request enabled GeoTIFF
- **Rendering**: Server-side tile generation via TiTiler integration

### Tile Image Formats
- **PNG**: Lossless, supports transparency, larger file size
- **JPEG**: Lossy compression, no transparency, smaller file size
- **WebP**: Modern format, better compression (browser support required)

### Storage Locations

#### Flat File Tilesets
- **Structure**: Hierarchical directories `/{z}/{x}/{y}.{ext}`
- **Location**: Mission directories (e.g., `Missions/MyMission/Layers/Basemap/`)
- **Access**: Direct file serving by MMGIS or via tile server

#### TileServer (Through MMGIS)
- **Option**: `throughTileServer: true`
- **Function**: MMGIS acts as tile proxy, auto-converts to WMTS
- **Benefit**: Caching, coordinate transformation, format conversion

#### Remote Tile Servers
- **MapServer**: Professional OGC-compliant server
- **GeoServer**: Open-source WMS/WMTS server
- **MapTiler**: Cloud tile hosting
- **Custom APIs**: Any server returning valid tile imagery

#### Local File System
- **Backend**: Files stored in `Missions/` directory
- **Access**: Through MMGIS backend tile serving APIs
- **Configuration**: Via mission configuration in database

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`url`** (string, required): Tile URL with {z}, {x}, {y} placeholders
- **`type`** (string, required): Must be `"tile"`
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level, default 0
- **`maxZoom`** (number): Maximum zoom level for tile requests, default 18
- **`maxNativeZoom`** (number): Maximum zoom level with actual tiles (scales beyond this)

**Example**: If `maxNativeZoom: 14` and `maxZoom: 18`, tiles at zoom 14 are scaled up for zooms 15-18.

#### Bounding Box Constraints
- **`bounds`** (array[4]): `[west, south, east, north]` in layer CRS
- **Purpose**: Restrict tile requests to specific geographic region
- **Benefit**: Prevent unnecessary tile requests outside mission area

#### Time-Enabled Tiles

**Time Types**:
- **`time.type`** (string):
  - `"global"` - Uses application-wide TimeControl
  - `"individual"` - Independent time slider per layer

**Time Placeholders in URL**:
- **`{time}`** - Single time value
- **`{starttime}`** - Start of time range
- **`{endtime}`** - End of time range

**Time Format**:
- **`time.format`** (string): strftime format string
  - Example: `"%Y-%m-%dT%H:%M:%SZ"` for ISO 8601
  - Example: `"%Y%m%d"` for YYYYMMDD
  - Example: `"%j"` for day of year

**Composited Time Tiles**:
- **`time.composited`** (boolean): Merge sparse time data into single tiles
- **Use Case**: Daily observations with gaps, shown as composite imagery

**Refresh Intervals**:
- **`time.refreshInterval`** (number): Auto-refresh interval in seconds for live data

#### DEM Support (3D Globe)

For terrain rendering in Cesium Globe view:

**DEM Tile URL**:
- **`demtileurl`** (string): URL to elevation tiles (separate from imagery)
- **Format**: Typically 16-bit PNG or custom binary format

**DEM Parser**:
- **`demParser`** (string): Parser type for elevation data
  - `"default"` - Standard 16-bit PNG (default)
  - `"1bto4b"` - Custom MMGIS binary DEM format
  - `"geotiff"` - GeoTIFF elevation tiles

**DEM Configuration**:
- **`demMaxZoom`** (number): Maximum zoom for DEM requests
- **`demZoomLevels`** (array): Available DEM zoom levels
- **`demMinResolution`** (number): Minimum resolution in meters/pixel
- **`demMaxResolution`** (number): Maximum resolution in meters/pixel

#### URL Replacements (Dynamic Values)

For mission-specific URL parameter substitution:
- **`urlReplacements`** (object): Key-value pairs for string replacement
  - Keys wrapped in `{}` in URL are replaced with values
  - Example: `{mission_sol}` → `"0123"`

#### Tile Server Options
- **`throughTileServer`** (boolean): Proxy through MMGIS tile server, default false
- **`tileFormat`** (string): Override tile format - `"png"`, `"jpg"`, `"webp"`

---

## 3. Data Layer

### Purpose
WebGL shader-based dynamic tile generation from Digital Elevation Model (DEM) data. Provides real-time colorization, hillshading, and data visualization of elevation and derived products with viewport-adaptive rendering.

### Supported Data Formats

#### 1bto4b DEM Tilesets
- **Format**: Custom binary DEM format optimized for web delivery
- **Generation**: Via `auxiliary/1bto4b/rasterstotiles1bto4b.py` script
- **Structure**: Multi-band elevation data with metadata
- **Storage**: Hierarchical tileset in mission directories

### Storage Locations

#### Flat File DEM Tilesets
- **Location**: Mission directories (e.g., `Missions/MyMission/DEMs/HighRes/`)
- **Structure**: `/{z}/{x}/{y}.1bto4b` binary files
- **Access**: Direct file serving, client-side WebGL processing

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"data"`
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Data Source Configuration
- **`data`** (array, required): Array of DEM tileset objects
  - **`name`** (string): Tileset display name
  - **`demtileurl`** (string): URL pattern for DEM tiles `/{z}/{x}/{y}.1bto4b`
  - **`minZoom`** (number): Minimum zoom for this tileset
  - **`maxZoom`** (number): Maximum zoom for this tileset
  - **`maxNativeZoom`** (number): Maximum zoom with actual DEM tiles

**Multi-Resolution Support**: Define multiple tilesets at different resolutions, MMGIS automatically selects appropriate one per zoom level.

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level for visibility
- **`maxZoom`** (number): Maximum zoom level for requests
- **`maxNativeZoom`** (number): Maximum zoom with native data

#### Bounding Box Constraints
- **`bounds`** (array[4]): `[west, south, east, north]` to restrict rendering area

#### Time-Enabled Support
- **`time.type`** (string): `"global"` or `"individual"`
- **`time.format`** (string): Time format for URL placeholders
- URL can include `{time}`, `{starttime}`, `{endtime}` placeholders

#### Shader Configuration

**Shader Type**:
- **`shader`** (string, required): Shader mode
  - `"colorize"` - Dynamic color ramps with data-driven coloring
  - `"image"` - Raw data display for testing

**Colorize Shader Options**:

**Color Ramp**:
- **`colorRamp`** (array, required): Array of color stop objects
  - **`value`** (number): Data value for this color
  - **`color`** (string): CSS color or hex
  - **`transparent`** (boolean): Optional, makes this stop transparent

**Example Color Ramp**:
```json
{
  "colorRamp": [
    {"value": -100, "color": "#0000ff"},
    {"value": 0, "color": "#00ff00"},
    {"value": 100, "color": "#ff0000"},
    {"value": 200, "color": "transparent", "transparent": true}
  ]
}
```

**Value Range**:
- **`range.type`** (string): Range calculation mode
  - `"viewport"` - Adaptive range based on visible data (default)
  - `"fixed"` - Fixed min/max values
- **`range.min`** (number): Minimum value (fixed mode)
- **`range.max`** (number): Maximum value (fixed mode)

**NoData Handling**:
- **`noDataValue`** (number): Value to treat as NoData, default -9999
- **`hideNoData`** (boolean): Hide NoData pixels (transparent), default true

**Display Units**:
- **`units`** (string): Unit label for legend (e.g., "meters", "°C")
- **`sigfigs`** (number): Significant figures for value display, default 2

---

## 4. Model Layer

### Purpose
Display 3D models in Cesium Globe view. Used for spacecraft, landers, rovers, scientific instruments, and infrastructure visualization in planetary mission contexts.

### Supported File Formats

#### Wavefront OBJ (`.obj`)
- **Format**: Text-based 3D model format
- **Materials**: Optional `.mtl` material file for textures and colors
- **Textures**: Referenced texture image files (PNG, JPEG)
- **Support**: Vertices, faces, normals, UV coordinates

#### glTF / GLB (`.gltf`, `.glb`)
- **Format**: GL Transmission Format (Khronos standard)
- **GLB**: Binary glTF with embedded textures
- **Features**: PBR materials, animations, skeletal rigs (animations not yet supported)
- **Preferred**: Modern format with better compression

#### COLLADA (`.dae`)
- **Format**: XML-based interchange format
- **Support**: Basic geometry and materials
- **Note**: Limited support, OBJ/glTF preferred

### Storage Locations

#### Flat Files
- **Location**: Mission directories (e.g., `Missions/MyMission/Models/rover.obj`)
- **Textures**: Must be in same directory or relative paths in model file
- **Access**: Direct file serving by MMGIS

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"model"`
- **`url`** (string, required): Path to model file (.obj, .gltf, .glb, .dae)
- **`opacity`** (number, 0-1): Model opacity, default 1
- **`initialVisibility`** (boolean): Model visible on load, default false

#### Position
- **`position.longitude`** (number, required): Longitude in degrees
- **`position.latitude`** (number, required): Latitude in degrees
- **`position.elevation`** (number, required): Elevation above surface in meters

#### Rotation
- **`rotation.x`** (number): Rotation around X-axis in radians, default 0
- **`rotation.y`** (number): Rotation around Y-axis in radians, default 0
- **`rotation.z`** (number): Rotation around Z-axis in radians, default 0

**Rotation Order**: Applied as X → Y → Z Euler angles

#### Scale
- **`scale`** (number): Uniform scale factor, default 1.0

**Example**: Scale of 2.0 doubles model size; 0.5 halves it.

#### Material File (OBJ Only)
- **`mtl`** (string): Path to `.mtl` material file if not auto-detected

#### Time-Enabled Models
- **`time.type`** (string): `"global"` or `"individual"`
- **`url`** can include `{time}` placeholder for time-varying models

#### Globe-Only Rendering
- **Note**: Model layers only render in 3D Globe view (Cesium), not in 2D Map (Leaflet)

#### Alternative: Feature-Attached Models
Models can also be attached to Vector layer point features via `markerAttachments.model` for dynamic, data-driven model placement.

---

## 5. Image Layer

### Purpose
Display single-band GeoTIFF or Cloud Optimized GeoTIFF (COG) raster images with dynamic colormap application and value rescaling. Ideal for scientific data visualization (temperature, elevation, spectral bands, derived products).

### Supported File Formats

#### GeoTIFF (`.tif`, `.tiff`)
- **Bands**: Single-band only
- **Georeferencing**: Must include geotransform or GCPs
- **Data Types**: 8-bit, 16-bit, 32-bit integer or float
- **Compression**: Any GeoTIFF-supported compression

#### Cloud Optimized GeoTIFF (COG)
- **Format**: GeoTIFF with internal tiling and overviews
- **Access**: Supports HTTP range requests for efficient streaming
- **Benefit**: Fast visualization without downloading entire file
- **Validation**: Should pass `rio cogeo validate`

### Storage Locations

#### Flat Files
- **Location**: Mission directories or absolute paths
- **Access**: Direct file serving

#### Remote URLs
- **Protocol**: HTTP/HTTPS
- **Requirement**: Must support range requests for COG
- **CORS**: Cross-origin requests must be enabled if external

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"image"`
- **`url`** (string, required): Path to GeoTIFF/COG file
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level for visibility
- **`maxZoom`** (number): Maximum zoom level
- **`maxNativeZoom`** (number): Maximum zoom with native image data

#### Bounding Box
- **`bounds`** (array[4]): `[west, south, east, north]` - usually auto-detected from GeoTIFF

#### Transform COG (Dynamic Colorization)

**Enable Transformation**:
- **`transformCOG`** (boolean): Enable on-the-fly rescaling and recoloring, default false

**Pixel Value Range**:
- **`cogMin`** (number): Minimum pixel data value to display
- **`cogMax`** (number): Maximum pixel data value to display
- **Purpose**: Rescale pixel values to this range before colormap application

**Colormap Selection**:
- **`colormap`** (string): Colormap name from intersection of:
  - **TiTiler colormaps**: `viridis`, `plasma`, `inferno`, `magma`, `cividis`, `turbo`, etc.
  - **js-colormaps**: Additional scientific colormaps
- **See**: TiTiler documentation for full list

**Fill Behavior**:
- **`fillMin`** (boolean): Fill pixels below `cogMin` with first colormap color, default false
- **`fillMax`** (boolean): Fill pixels above `cogMax` with last colormap color, default false

**NoData Handling**:
- **`hideNoData`** (boolean): Make NoData pixels transparent, default true
- **NoData Value**: Auto-detected from GeoTIFF metadata

**Display Units**:
- **`units`** (string): Unit label for legend (e.g., "Kelvin", "mGal")

#### TiTiler Integration
- **Requirement**: TiTiler service must be running (configure via `WITH_TITILER=true` in .env)
- **Endpoint**: TiTiler handles COG parsing, rescaling, and colormap application
- **Performance**: Server-side processing reduces client load

---

## 6. VectorTile Layer

### Purpose
Display Mapbox Vector Tiles (MVT) in Protocol Buffer (PBF) format. Provides efficient rendering of large vector datasets with client-side styling. Ideal for massive point clouds, global administrative boundaries, road networks, and dense feature collections.

### Supported File Formats

#### Protocol Buffer (PBF) - Mapbox Vector Tile
- **Specification**: Mapbox Vector Tile Specification v2.1
- **Format**: Binary protocol buffer encoding
- **Structure**: Tiled vector data with layers, features, and properties
- **Efficiency**: Highly compressed, fast parsing, client-side rendering

### Storage Locations

#### Flat File Vector Tile Directories
- **Structure**: `/{z}/{x}/{y}.pbf` or `/{z}/{x}/{y}.mvt`
- **Location**: Mission directories
- **Generation**: Via tools like `tippecanoe`, `ogr2ogr`, or custom scripts

#### Geodatasets (PostGIS)
- **Format**: `geodatasets:{dataset_name}`
- **Backend**: MMGIS generates MVT tiles dynamically from PostGIS
- **Function**: `ST_AsMVT()` for on-the-fly tile generation

#### Remote Vector Tile Servers
- **MapTiler**: Cloud-hosted vector tiles
- **MapLibre**: Self-hosted vector tile server
- **Custom APIs**: Any server returning MVT/PBF tiles

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"vectortile"`
- **`url`** (string, required): Tile URL with {z}/{x}/{y} placeholders
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level, default 0
- **`maxZoom`** (number): Maximum zoom level for tile requests, default 18
- **`maxNativeZoom`** (number): Maximum zoom level with actual vector tiles

#### Styling
- **Styling Options**: Similar to vector layer styling
  - `strokeColor`, `strokeOpacity`, `strokeWeight`
  - `fillColor`, `fillOpacity`
  - `radius` (for point features)

**Note**: Vector tile styling is applied to all features in tile. Per-feature styling not supported.

#### Performance Benefits
- **Client-Side Rendering**: Features rendered as canvas/WebGL, not DOM elements
- **Reduced Data Transfer**: Binary PBF format is highly compressed
- **No Feature Limit**: Can efficiently display millions of features
- **Smooth Zoom**: Features re-rendered at each zoom level from vector data

---

## 7. Velocity Layer

### Purpose
Visualize velocity, flow, wind, or current data with animated effects. Supports multiple visualization types: streamlines, particles, arrows, and wind barbs. Used for atmospheric data, ocean currents, rover traverse planning, and dynamic environmental visualization.

### Supported File Formats

#### GeoJSON (for Particles and Arrows)
- **Format**: Standard GeoJSON with velocity vector properties
- **Properties Required**:
  - `u` or `eastward` - Eastward velocity component
  - `v` or `northward` - Northward velocity component
  - `magnitude` (optional) - Velocity magnitude
  - `direction` (optional) - Direction in degrees

#### GribJSON (for Streamlines Only)
- **Format**: JSON representation of GRIB meteorological data
- **Source**: Converted from GRIB2 files via custom tools
- **Use Case**: Professional atmospheric modeling data

#### GeoTIFF (for Arrows Only)
- **Format**: Multi-band GeoTIFF with U and V components
- **Band 1**: Eastward velocity (U)
- **Band 2**: Northward velocity (V)

#### Veloserver URLs
- **Protocol**: Custom velocity data server API
- **Endpoint**: Returns velocity data in JSON format
- **Query Parameters**: Bounding box, time range, resolution

### Storage Locations

#### Flat Files
- **Location**: Mission directories for GeoJSON/GeoTIFF
- **Access**: Direct file serving

#### Veloserver Endpoints
- **Remote Server**: Dedicated velocity data server
- **API**: RESTful interface with spatial/temporal queries

#### Remote Servers
- **Any URL**: Returning GeoJSON, GribJSON, or GeoTIFF velocity data

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"velocity"`
- **`url`** (string, required): Data source URL
- **`opacity`** (number, 0-1): Layer opacity, default 1
- **`initialVisibility`** (boolean): Layer visible on load, default false

#### Visualization Kind
- **`kind`** (string, required): Visualization type
  - `"streamlines"` - Animated flow lines (uses leaflet-velocity)
  - `"particles"` - Single-direction particle effects (uses Leaflet.Rain)
  - `"arrows"` - Directional arrow vectors (placeholder - not fully implemented)
  - `"windbarbs"` - Wind barb symbols (placeholder - not fully implemented)

#### Velocity Range
- **`velocityMin`** (number): Minimum velocity value for color scale
- **`velocityMax`** (number): Maximum velocity value for color scale

#### Streamlines Configuration

**Particle Behavior**:
- **`particleAge`** (number): Maximum age of particles in frames, default 100
- **`particleMultiplier`** (number): Number of particles, default 1/300 of canvas area
- **`frameRate`** (number): Animation frame rate, default 15 fps
- **`lineWidth`** (number): Streamline width in pixels, default 2

**Color Scale**:
- **`colorScale`** (array): Array of color stops for velocity values
  - Each element: `[value, "color"]`
  - Example: `[[0, "#0000ff"], [10, "#00ff00"], [20, "#ff0000"]]`

#### Particles Configuration

**Behavior**:
- **`particleCount`** (number): Number of concurrent particles, default 100
- **`particleSpeed`** (number): Particle movement speed multiplier, default 1
- **`particleSize`** (number): Particle size in pixels, default 2
- **`particleColor`** (string): Particle color, default "#ffffff"

#### Display Values
- **`displayValues`** (boolean): Show velocity values on hover, default false
- **`displayPosition`** (string): Value label position - `"topleft"`, `"topright"`, `"bottomleft"`, `"bottomright"`

#### Controlled Mode (Dynamic Updates)
- **`controlled`** (boolean): Enable programmatic velocity updates, default false
- **Use Case**: Real-time telemetry feeds, live weather data

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level for visibility
- **`maxZoom`** (number): Maximum zoom level

---

## 8. Video Layer

### Purpose
Display video overlays georeferenced on the map surface. Used for time-lapse visualizations, animated simulations, documentary footage of field sites, and dynamic contextual media.

### Supported File Formats

#### WebM (`.webm`) - Recommended
- **Codec**: VP8 or VP9 video, Vorbis or Opus audio
- **Benefit**: Open format, efficient compression, wide browser support
- **Preferred**: Best balance of quality and compatibility

#### MP4 (`.mp4`)
- **Codec**: H.264 video, AAC audio
- **Compatibility**: Universal browser support
- **License**: May have patent restrictions in some contexts

#### Animated GIF (`.gif`)
- **Format**: Sequence of GIF frames
- **Use Case**: Simple animations, legacy compatibility
- **Limitation**: Large file size, limited color palette (256 colors)

### Storage Locations

#### Flat Files
- **Location**: Mission directories (e.g., `Missions/MyMission/Media/timelapse.webm`)
- **Access**: Direct file serving by MMGIS

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name in UI
- **`type`** (string, required): Must be `"video"`
- **`url`** (string, required): Path to video file
- **`opacity`** (number, 0-1): Video opacity, default 1
- **`initialVisibility`** (boolean): Video visible on load, default false

#### Bounding Box (Positioning)
- **`bounds`** (array[4], required): `[west, south, east, north]` in layer CRS
- **Purpose**: Define geographic extent of video overlay

**Example**: Video of field site at lat/lon bounds `[137.5, -4.5, 138.0, -4.0]`

#### Playback Controls

**Autoplay**:
- **`autoplay`** (boolean): Start playback on layer activation, default false

**Loop**:
- **`loop`** (boolean): Continuously loop video, default true

**Muted**:
- **`muted`** (boolean): Mute audio track, default true

**Plays Inline**:
- **`playsInline`** (boolean): Play inline on mobile (no fullscreen), default true

#### User Controls
- **`controls`** (boolean): Show play/pause, progress bar, volume controls, default true

**Control Panel**:
- Play/Pause button
- Restart button
- Mute/Unmute toggle
- Progress scrubber

#### Zoom Level Controls
- **`minZoom`** (number): Minimum zoom level for visibility
- **`maxZoom`** (number): Maximum zoom level

---

## 9. Header Layer

### Purpose
Organizational grouping layer that contains sublayers of any type. Creates collapsible hierarchies in the Layers Tool UI. Does not render any data itself. Used for mission phase grouping, data category organization, and workspace management.

### Functionality

#### Layer Grouping
- **Contains**: Any number of child layers of any type
- **Display**: Collapsible folder in Layers Tool
- **Toggle**: Turning header on/off affects all child layer visibility

#### Use Cases
- **Mission Phases**: "Sol 1", "Sol 2", "Sol 3" headers
- **Data Categories**: "Basemaps", "Science Targets", "Engineering Data"
- **Team Workspaces**: "Team A Annotations", "Team B Analysis"

### Configuration Options

#### Basic Properties
- **`name`** (string, required): Display name for header group
- **`type`** (string, required): Must be `"header"`
- **`initialVisibility`** (boolean): Header expanded on load, default false

**Note**: Header layers are always initially "on" (checked) - toggling affects child visibility

#### Sublayers
- **`sublayers`** (array, required): Array of child layer configurations
- **Structure**: Each element is a full layer configuration object
- **Nesting**: Headers can contain other headers for multi-level hierarchies

#### Example Configuration
```json
{
  "name": "Sol 015",
  "type": "header",
  "sublayers": [
    {
      "name": "Basemap Sol 015",
      "type": "tile",
      "url": "Missions/MyMission/Basemaps/Sol015/{z}/{x}/{y}.png"
    },
    {
      "name": "Science Targets Sol 015",
      "type": "vector",
      "url": "Missions/MyMission/Annotations/sol015_targets.geojson"
    }
  ]
}
```

---

## 10. Query Layer

### Purpose
Special internal vector layer type for displaying spatial query results. Automatically managed by MMGIS query tools (Query Tool, spatial selection, buffer operations). Not manually configured by users.

### Functionality

#### Automatic Management
- **Created**: When user performs spatial query
- **Populated**: With query result features
- **Cleared**: When new query is executed or tool is closed

#### Rendering
- **Type**: Rendered as vector layer
- **Styling**: Uses query tool's default styling
- **Interaction**: Features are selectable and display properties

### Configuration

#### Internal Configuration Only
Query layers are created programmatically and do not appear in mission configuration files. Styling is controlled via query tool configuration.

---

## Storage Architecture Summary

### 1. Flat File Storage
**Location**: `Missions/{mission_name}/` directory structure

**Advantages**:
- Simple deployment, no database required
- Version control friendly (Git-trackable)
- Fast read access for small to medium datasets
- Easy manual editing and inspection

**Structure**:
```
Missions/
  MyMission/
    Layers/
      Basemap/
        {z}/
          {x}/
            {y}.png
      Annotations/
        science_targets.geojson
      DEMs/
        HighRes/
          {z}/
            {x}/
              {y}.1bto4b
    Models/
      rover.obj
      rover.mtl
      textures/
        rover_diffuse.png
    Media/
      timelapse.webm
```

**Access**: Direct file serving by MMGIS Express server or through tile server proxy

### 2. PostgreSQL + PostGIS (Geodatasets)

**Database**: PostgreSQL with PostGIS spatial extension

**Tables**: Dynamic `g{n}_geodatasets` tables where `{n}` is geodataset index

**Schema**:
```sql
CREATE TABLE g1_geodatasets (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL,
  feature_id INTEGER,
  group_id INTEGER,
  properties JSONB,
  geometry GEOMETRY(Geometry, 4326),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_geometry ON g1_geodatasets USING GIST (geometry);
CREATE INDEX idx_start_time ON g1_geodatasets (start_time);
CREATE INDEX idx_end_time ON g1_geodatasets (end_time);
CREATE INDEX idx_file_id ON g1_geodatasets (file_id);
CREATE INDEX idx_feature_id ON g1_geodatasets (feature_id);
CREATE INDEX idx_group_id ON g1_geodatasets (group_id);
```

**Advantages**:
- Efficient spatial queries (ST_Intersects, ST_Contains, etc.)
- Temporal indexing for time-series data
- ACID compliance for concurrent edits
- Scalable to millions of features
- Dynamic tile generation (MVT)

**Access**: Via `geodatasets:{name}` URL format in layer configuration

**Management**: Through "Manage Geodatasets" UI in Configure page

**Supported Layer Types**: Vector, VectorTile

### 3. Local File System Storage

**Type**: Local file storage in `Missions/` directory

**Configuration**: Automatic based on mission name

**Directory Structure**:
```
Missions/
  {mission_name}/
    Data/           # Geodata files (GeoTIFF, GeoJSON, etc.)
    Layers/         # Layer configuration
    public/         # Public web-accessible files
```

**Use Cases**:
- User file uploads (Draw Tool attachments, mission assets)
- Large raster datasets
- Vector data files (GeoJSON, shapefiles)
- Mission-specific configuration files

**Access**: Through MMGIS backend APIs (`/api/files/upload`, `/api/files/download`)

**Advantages**:
- Scalable object storage
- S3-compatible (easy migration to AWS/GCP)
- Built-in redundancy and versioning
- Reduces local filesystem load

### 4. Remote Servers

**Supported Protocols**:
- **HTTP/HTTPS**: Direct file access with CORS support
- **WMS**: OGC Web Map Service
- **WMTS**: OGC Web Map Tile Service
- **TMS**: Tile Map Service
- **STAC**: SpatioTemporal Asset Catalog API
- **Custom APIs**: RESTful geospatial data endpoints

**Authentication**:
- **Public**: No authentication required
- **API Keys**: Passed via URL parameters or custom headers
- **OAuth**: Token-based authentication (configured per endpoint)

**Advantages**:
- Leverage external data sources (NASA PDS, USGS, mission archives)
- No local storage required
- Always up-to-date data
- Centralized data management

**Considerations**:
- Network latency affects performance
- Requires internet connectivity or VPN
- CORS must be enabled on remote servers for browser access

---

## Time-Enabled Layers Deep Dive

MMGIS provides sophisticated time support across multiple layer types with four distinct time modes.

### Time Types

#### 1. Global Time
- **Behavior**: Layer uses application-wide TimeControl
- **UI**: Single time slider controls all global time layers
- **Synchronization**: All global layers update together
- **Use Case**: Mission-wide temporal coordination (e.g., all Sol 15 data)

#### 2. Individual Time
- **Behavior**: Layer has independent time controls
- **UI**: Per-layer time slider in Layers Tool
- **Independence**: Does not affect other layers' time
- **Use Case**: Comparing data from different time periods

#### 3. Requery Time
- **Behavior**: Fetches new data when time changes
- **Mechanism**: URL placeholders replaced with time values
- **Server-Side**: Server filters/generates data for requested time
- **Use Case**: Large datasets, dynamic tile generation, APIs

#### 4. Local Time
- **Behavior**: Filters existing data client-side
- **Mechanism**: Feature properties evaluated against time range
- **Performance**: Instant filtering, no network requests
- **Use Case**: Pre-loaded datasets with temporal properties

### Time Placeholders

Used in layer URLs for requery mode:

**Single Time**:
- **`{time}`**: Current time value formatted per `time.format`

**Time Range**:
- **`{starttime}`**: Start of time range
- **`{endtime}`**: End of time range

**Property Names** (for dynamic extent):
- **`{startprop}`**: Name of feature start time property
- **`{endprop}`**: Name of feature end time property

### Time Format Strings

**Strftime Format** (Python/POSIX):
- **`%Y`**: 4-digit year (e.g., 2024)
- **`%m`**: 2-digit month (01-12)
- **`%d`**: 2-digit day (01-31)
- **`%H`**: 2-digit hour (00-23)
- **`%M`**: 2-digit minute (00-59)
- **`%S`**: 2-digit second (00-59)
- **`%j`**: Day of year (001-366)
- **`%Y-%m-%dT%H:%M:%SZ`**: ISO 8601 format

**Special Formats**:
- **`"unix"`**: Unix timestamp in milliseconds
- **`"ISO"`**: ISO 8601 with 'Z' suffix (UTC)

**Example URL**:
```
https://tiles.example.com/{z}/{x}/{y}/{time}.png
```
With `time.format: "%Y%m%d"` becomes:
```
https://tiles.example.com/10/512/384/20240315.png
```

### Time Properties (Local Filtering)

**Property Paths**:
- **`time.startProp`**: Path to feature start time property
- **`time.endProp`**: Path to feature end time property (optional)

**Dot Notation** for nested properties:
```
"time.startProp": "properties.observation.timestamp"
```

**Property Value Formats**:
- **Unix Timestamps**: Milliseconds since epoch (as number)
- **ISO Strings**: UTC with 'Z' suffix (e.g., "2024-03-15T14:30:00Z")

**Range Filtering**:
- If only `startProp` specified: Feature visible if `startProp <= currentTime`
- If both specified: Feature visible if `startProp <= currentTime <= endProp`

### Refresh Intervals

**Purpose**: Auto-reload layer data at regular intervals for live-updating sources

**Configuration**:
- **`time.refreshInterval`**: Interval in seconds, default 60

**Use Cases**:
- Live telemetry feeds
- Weather data updates
- Mission operations dashboards
- Real-time rover tracking

**Behavior**:
- Timer starts when layer is enabled
- Pauses when layer is disabled
- Resets on manual time change

---

## Advanced Configuration Patterns

### Pattern 1: Multi-Resolution Tilesets

For optimal performance across zoom levels, configure multiple DEM/tile sources:

```json
{
  "name": "Global Elevation",
  "type": "data",
  "data": [
    {
      "name": "Low Resolution (Global)",
      "demtileurl": "Missions/Mars/DEMs/Global/{z}/{x}/{y}.1bto4b",
      "minZoom": 0,
      "maxZoom": 8,
      "maxNativeZoom": 8
    },
    {
      "name": "Medium Resolution (Regions)",
      "demtileurl": "Missions/Mars/DEMs/Regional/{z}/{x}/{y}.1bto4b",
      "minZoom": 9,
      "maxZoom": 14,
      "maxNativeZoom": 14
    },
    {
      "name": "High Resolution (Sites)",
      "demtileurl": "Missions/Mars/DEMs/HighRes/{z}/{x}/{y}.1bto4b",
      "minZoom": 15,
      "maxZoom": 20,
      "maxNativeZoom": 18
    }
  ]
}
```

MMGIS automatically selects appropriate tileset based on current zoom level.

### Pattern 2: Time-Enabled Dynamic Extent

Combine time and spatial filtering for efficient large dataset queries:

```json
{
  "name": "Rover Telemetry",
  "type": "vector",
  "controlled": true,
  "controlledUrl": "https://api.example.com/telemetry?bbox={minx},{miny},{maxx},{maxy}&start={starttime}&end={endtime}",
  "time": {
    "type": "global",
    "format": "%Y-%m-%dT%H:%M:%SZ"
  }
}
```

Server receives both spatial and temporal parameters for optimized queries.

### Pattern 3: Hierarchical Layer Organization

Use nested headers for complex mission structures:

```json
{
  "name": "Mission Operations",
  "type": "header",
  "sublayers": [
    {
      "name": "Sol 015",
      "type": "header",
      "sublayers": [
        {
          "name": "Basemap Sol 015",
          "type": "tile",
          "url": "..."
        },
        {
          "name": "Rover Path Sol 015",
          "type": "vector",
          "url": "..."
        }
      ]
    },
    {
      "name": "Sol 016",
      "type": "header",
      "sublayers": [...]
    }
  ]
}
```

### Pattern 4: Feature-Rich Vector Layers

Combine multiple attachment types for comprehensive visualization:

```json
{
  "name": "Rover Waypoints",
  "type": "vector",
  "url": "Missions/Mars/Waypoints/waypoints.geojson",
  "layerAttachments": {
    "labels": {
      "initialVisibility": true,
      "property": "name",
      "color": "#ffffff",
      "backgroundColor": "#000000aa"
    },
    "uncertainty": {
      "initialVisibility": true,
      "ellipseMode": "2d",
      "ellipseProperties": ["cov_x", "cov_y", "cov_z", "cov_xx", "cov_yy", "cov_zz"],
      "color": "#ffff00",
      "opacity": 0.3
    }
  },
  "markerAttachments": {
    "bearing": {
      "initialVisibility": true,
      "angleProp": "heading",
      "lengthProp": "speed",
      "color": "#00ff00"
    },
    "model": {
      "initialVisibility": false,
      "path": "model_url",
      "scale": "model_scale",
      "rotation": ["rot_x", "rot_y", "rot_z"]
    }
  }
}
```

### Pattern 5: COG with Dynamic Colormap

Scientific raster visualization with on-the-fly processing:

```json
{
  "name": "Surface Temperature",
  "type": "image",
  "url": "Missions/Mars/Thermal/surface_temp.tif",
  "transformCOG": true,
  "cogMin": 180,
  "cogMax": 320,
  "colormap": "turbo",
  "fillMin": true,
  "fillMax": true,
  "hideNoData": true,
  "units": "Kelvin"
}
```

TiTiler service rescales 180-320K range and applies "turbo" colormap.

---

## Layer URL Formats Reference

### Vector Layer URLs

**Flat Files**:
```
Missions/MyMission/Annotations/targets.geojson
/absolute/path/to/data.json
```

**Geodatasets**:
```
geodatasets:science_targets
geodatasets:rover_paths
```

**API Endpoints**:
```
api:publishedall
api:published:roi
api:drawn:42
api:tacticaltargets
```

**STAC**:
```
stac:https://stac.example.com/collections/mars_imagery
stac-item:https://stac.example.com/items/image_001
stac-catalog:https://stac.example.com/catalog.json
```

**Remote**:
```
https://data.example.com/mission/features.geojson
```

### Tile Layer URLs

**TMS/WMTS**:
```
Missions/MyMission/Basemap/{z}/{x}/{y}.png
https://tiles.example.com/mission/{z}/{x}/{y}.jpg
```

**WMS**:
```
https://wms.example.com/service?SERVICE=WMS&REQUEST=GetMap&LAYERS=basemap&...
```

**COG Tiles**:
```
COG:Missions/MyMission/Imagery/scene.tif
COG:https://data.example.com/cog/scene.tif
```

**Time-Enabled**:
```
Missions/MyMission/Basemap/{z}/{x}/{y}_{time}.png
https://tiles.example.com/{time}/tiles/{z}/{x}/{y}.png
```

### Data Layer URLs

**1bto4b DEMs**:
```
Missions/MyMission/DEMs/HighRes/{z}/{x}/{y}.1bto4b
```

### Model Layer URLs

**Model Files**:
```
Missions/MyMission/Models/rover.obj
Missions/MyMission/Models/lander.gltf
https://models.example.com/assets/instrument.glb
```

### Image Layer URLs

**GeoTIFF/COG**:
```
Missions/MyMission/Rasters/temperature.tif
https://data.example.com/cogs/elevation.tif
```

### VectorTile Layer URLs

**PBF Tiles**:
```
Missions/MyMission/VectorTiles/{z}/{x}/{y}.pbf
geodatasets:road_network
https://tiles.example.com/vectors/{z}/{x}/{y}.mvt
```

### Velocity Layer URLs

**GeoJSON**:
```
Missions/MyMission/Velocity/wind.geojson
```

**Veloserver**:
```
https://veloserver.example.com/api/velocity?bbox={bbox}&time={time}
```

### Video Layer URLs

**Video Files**:
```
Missions/MyMission/Media/timelapse.webm
https://media.example.com/videos/field_site.mp4
```

---

## Configuration Management

### Configure Page Interface

**Location**: `/configure` (requires authentication)

**Layer Management**:
- **Add Layer**: Click "Add Layer" in Layers tab, select type, fill form
- **Edit Layer**: Click layer in list, modify properties, save
- **Delete Layer**: Click delete icon, confirm
- **Reorder Layers**: Drag layers to change z-index order
- **Duplicate Layer**: Clone existing layer configuration

**JSON Editing**:
- **Raw Variables**: Advanced JSON configuration per layer
- **Export**: Download entire mission configuration as JSON
- **Import**: Upload configuration JSON to restore/migrate missions

### Mission Configuration Files

**Location**: Managed internally by MMGIS backend

**Structure**:
```json
{
  "msv": 4,
  "configuration": {
    "projection": {...},
    "layers": [
      {
        "name": "Layer 1",
        "type": "vector",
        ...
      },
      ...
    ],
    "tools": {...},
    "time": {...}
  }
}
```

**Access**: Via Configure REST API (`/api/configure`)

### Version Control

**Recommendation**: Export mission configurations and store in Git

**Benefits**:
- Track configuration changes over time
- Collaborative configuration editing
- Rollback to previous configurations
- Branch configurations for testing

---

## Performance Considerations

### Layer Type Performance Characteristics

**Vector Layers**:
- **Performance**: Degrades with >10,000 features on screen
- **Optimization**: Use VectorTile for large datasets, enable visibility cutoffs
- **Best For**: <5,000 features per viewport

**Tile Layers**:
- **Performance**: Excellent, optimized for web delivery
- **Considerations**: Tile generation time, storage size
- **Best For**: Raster basemaps, imagery

**Data Layers**:
- **Performance**: GPU-accelerated, real-time shading
- **Considerations**: WebGL overhead, browser support
- **Best For**: Dynamic DEM visualization

**VectorTile Layers**:
- **Performance**: Excellent, handles millions of features
- **Considerations**: Tile generation complexity
- **Best For**: Dense point clouds, large vector datasets

**Model Layers**:
- **Performance**: Depends on model complexity (polygon count)
- **Optimization**: Use LOD (Level of Detail) models
- **Best For**: <100,000 polygons per model

**Image Layers**:
- **Performance**: Good with COG, slower with full GeoTIFF download
- **Optimization**: Use COG format, TiTiler server-side processing
- **Best For**: Single-image rasters with colormap needs

**Velocity Layers**:
- **Performance**: Animation overhead, GPU-dependent
- **Optimization**: Limit particle count, reduce frame rate
- **Best For**: Visual effects, not data-dense visualization

**Video Layers**:
- **Performance**: Depends on video codec and size
- **Optimization**: Use WebM with VP9, reduce resolution
- **Best For**: <1920x1080 resolution, <60 second loops

### General Optimization Strategies

1. **Limit Active Layers**: Too many active layers reduce performance
2. **Use Zoom Cutoffs**: Set minZoom/maxZoom to reduce unnecessary rendering
3. **Geodatasets for Large Vectors**: PostGIS spatial indexing improves query speed
4. **Tile Caching**: Enable tile server caching for repeated access
5. **COG for Rasters**: Avoid full GeoTIFF downloads with Cloud Optimized format
6. **Dynamic Extent**: Reduce data transfer for large, sparse datasets
7. **Simplify Geometries**: Pre-process vectors to reduce coordinate counts
8. **Compress Tiles**: Use WebP or optimized PNG/JPEG compression

---

## Security Considerations

### Authentication & Authorization

**Layer Access Control**:
- Mission-level permissions (read/write)
- User roles (admin, lead, member, viewer)
- Private vs public layer visibility

**File Access**:
- Mission files served based on user permissions
- API endpoints require valid session cookies
- Geodatasets respect user access levels

### Data Validation

**GeoJSON Validation**:
- Schema validation on geodataset ingestion
- Geometry validation (valid GeoJSON spec)
- Property sanitization (XSS prevention)

**URL Validation**:
- Layer URLs validated against allowed patterns
- Remote URLs require CORS headers
- API endpoints authenticated

### Cross-Origin Resource Sharing (CORS)

**Requirement**: Remote tile/data servers must enable CORS for browser access

**Headers Required**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

**Security**: Use specific origins instead of `*` for production

---

## Troubleshooting Common Issues

### Vector Layer Not Displaying

**Symptoms**: Layer enabled but no features visible

**Causes & Solutions**:
1. **Incorrect URL**: Verify file path or API endpoint
   - Check browser Network tab for 404 errors
   - Verify file exists in Missions directory
2. **Invalid GeoJSON**: Use GeoJSON validator
   - Check for missing `type`, `features`, `geometry`
   - Verify coordinates are [lon, lat] not [lat, lon]
3. **Wrong CRS**: MMGIS expects EPSG:4326 (WGS84)
   - Reproject data to WGS84 before loading
4. **Features Outside Viewport**: Pan/zoom to layer bounds
   - Check feature coordinates are in expected range
5. **Visibility Cutoff**: Check minZoom/maxZoom settings
   - Adjust zoom cutoffs or zoom to appropriate level

### Tile Layer Shows Missing Tiles

**Symptoms**: Checkerboard pattern or missing tile squares

**Causes & Solutions**:
1. **Incorrect URL Pattern**: Verify {z}/{x}/{y} placeholders
   - Check tile coordinates match TMS/WMTS convention
2. **Wrong Max Zoom**: Tiles requested beyond available data
   - Set `maxNativeZoom` to highest available tile zoom
3. **CORS Issues**: Remote server blocking browser requests
   - Add CORS headers on tile server
   - Use `throughTileServer: true` to proxy requests
4. **File Permissions**: Tile files not readable by server
   - Check file system permissions on Missions directory

### Data Layer Not Rendering

**Symptoms**: Blank tiles where DEM layer should appear

**Causes & Solutions**:
1. **Invalid 1bto4b Format**: DEM tiles corrupted or wrong format
   - Regenerate tiles with correct `rasterstotiles1bto4b.py` script
2. **WebGL Disabled**: Browser does not support WebGL
   - Check browser console for WebGL errors
   - Enable hardware acceleration in browser settings
3. **Shader Errors**: ColorRamp misconfigured
   - Verify colorRamp array has valid color stops
   - Check value ranges match data values

### Time-Enabled Layer Not Updating

**Symptoms**: Time slider changes but layer doesn't update

**Causes & Solutions**:
1. **Wrong Time Type**: Using "local" but no features match time range
   - Verify feature properties contain time values
   - Check time property paths are correct
2. **Time Format Mismatch**: URL placeholder not being replaced
   - Verify `time.format` matches expected server format
   - Check browser Network tab for URL with {time} unreplaced
3. **No Refresh Interval**: Data not automatically reloading
   - Set `time.refreshInterval` for live data sources

### Model Layer Not Visible

**Symptoms**: Model layer enabled but model not shown in Globe

**Causes & Solutions**:
1. **2D Map Active**: Models only render in 3D Globe view
   - Switch to Globe panel
2. **Model Outside Viewport**: Model position incorrect
   - Verify longitude/latitude are in expected location
   - Check elevation value (may be underground or in space)
3. **Model File Error**: OBJ/GLTF file corrupted or invalid
   - Check browser console for model loading errors
   - Verify .mtl and texture files are accessible (OBJ)
4. **Scale Too Small/Large**: Model rendered but not visible
   - Adjust scale factor (try 10, 100, 1000)

---

## Cross-Reference: Related Documentation

**Human-Vetted Documentation** (in `docs/pages/`):
- **`Configure/Layers/`** - Individual layer type documentation pages
- **`Configure/Formats/`** - Format specifications (Enhanced GeoJSON, Time Tiles, etc.)
- **`Configure/Kinds/`** - Layer interaction behaviors (click handlers)
- **`Configure/SPICE/`** - SPICE integration for planetary coordinates
- **`Configure/Projections/`** - Custom projection configuration (Planetcantile)
- **`APIs/GeoDatasets/`** - Geodataset API reference
- **`APIs/Backend/`** - Backend API documentation
- **`DataProcessing/`** - Scripts for tile generation and data preparation

**Related Specs**:
- **`specs/002-geodata-management-and-tile-serving`** - Backend architecture for tile serving and geodataset management
- **`specs/006-dual-map-rendering-engines`** - How layers are rendered in Leaflet (2D) and Cesium (3D)
- **`specs/007-interactive-mapping-tools`** - Tools that interact with layers (Layers Tool, Identifier Tool, Query Tool)
- **`specs/009-layer-and-map-configuration`** - Layer styling, visibility controls, and legend configuration

---

## Appendix: Complete Configuration Examples

### Example 1: Complex Vector Layer with All Features

```json
{
  "name": "Rover Science Targets",
  "type": "vector",
  "url": "geodatasets:science_targets",
  "opacity": 0.9,
  "initialVisibility": true,
  "minZoom": 8,
  "maxZoom": 20,
  "visibilityCutoff": 22,
  "strokeColor": "#ff0000",
  "strokeOpacity": 1,
  "strokeWeight": 2,
  "fillColor": "#ff0000",
  "fillOpacity": 0.4,
  "radius": 10,
  "time": {
    "type": "global",
    "startProp": "properties.observation_time",
    "format": "unix"
  },
  "layerAttachments": {
    "labels": {
      "initialVisibility": true,
      "property": "target_name",
      "color": "#ffffff",
      "size": 14,
      "weight": "bold",
      "backgroundColor": "#000000cc",
      "offset": [0, -15]
    },
    "uncertainty": {
      "initialVisibility": true,
      "ellipseMode": "2d",
      "ellipseProperties": ["cov_x", "cov_y", "cov_z", "cov_xx", "cov_yy", "cov_zz"],
      "color": "#ffff00",
      "opacity": 0.3
    }
  },
  "markerAttachments": {
    "bearing": {
      "initialVisibility": true,
      "angleProp": "rover_heading",
      "lengthProp": "distance_from_rover",
      "color": "#00ff00",
      "weight": 2
    }
  }
}
```

### Example 2: Time-Enabled Tile Layer with DEM

```json
{
  "name": "Daily Basemap",
  "type": "tile",
  "url": "https://tiles.example.com/mission/sol{time}/{z}/{x}/{y}.png",
  "opacity": 1,
  "initialVisibility": true,
  "minZoom": 0,
  "maxZoom": 18,
  "maxNativeZoom": 16,
  "bounds": [137.0, -5.0, 138.0, -4.0],
  "demtileurl": "https://tiles.example.com/mission/dem/{z}/{x}/{y}.png",
  "demParser": "default",
  "time": {
    "type": "individual",
    "format": "%03d"
  },
  "throughTileServer": false
}
```

### Example 3: Data Layer with Colorize Shader

```json
{
  "name": "High Resolution Elevation",
  "type": "data",
  "opacity": 0.8,
  "initialVisibility": false,
  "minZoom": 10,
  "maxZoom": 20,
  "shader": "colorize",
  "data": [
    {
      "name": "High Res DEM",
      "demtileurl": "Missions/Mars/DEMs/HighRes/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 20,
      "maxNativeZoom": 18
    }
  ],
  "colorRamp": [
    {"value": -100, "color": "#2166ac"},
    {"value": -50, "color": "#67a9cf"},
    {"value": 0, "color": "#f7f7f7"},
    {"value": 50, "color": "#ef8a62"},
    {"value": 100, "color": "#b2182b"}
  ],
  "range": {
    "type": "viewport"
  },
  "noDataValue": -9999,
  "hideNoData": true,
  "units": "meters"
}
```

### Example 4: Velocity Layer with Streamlines

```json
{
  "name": "Wind Field",
  "type": "velocity",
  "url": "https://veloserver.example.com/api/wind",
  "opacity": 0.7,
  "initialVisibility": false,
  "kind": "streamlines",
  "velocityMin": 0,
  "velocityMax": 30,
  "particleAge": 90,
  "particleMultiplier": 0.003,
  "frameRate": 20,
  "lineWidth": 2,
  "colorScale": [
    [0, "#3288bd"],
    [10, "#66c2a5"],
    [20, "#fee08b"],
    [30, "#d53e4f"]
  ],
  "displayValues": true,
  "displayPosition": "topright"
}
```

### Example 5: Hierarchical Mission Organization

```json
{
  "name": "Mission Data",
  "type": "header",
  "sublayers": [
    {
      "name": "Basemaps",
      "type": "header",
      "sublayers": [
        {
          "name": "Global Basemap",
          "type": "tile",
          "url": "Missions/Mars/Basemaps/Global/{z}/{x}/{y}.png",
          "maxNativeZoom": 10
        },
        {
          "name": "High Resolution Site",
          "type": "tile",
          "url": "Missions/Mars/Basemaps/HighRes/{z}/{x}/{y}.png",
          "minZoom": 11,
          "maxNativeZoom": 18
        }
      ]
    },
    {
      "name": "Science Data",
      "type": "header",
      "sublayers": [
        {
          "name": "Observations",
          "type": "vector",
          "url": "geodatasets:observations"
        },
        {
          "name": "Samples",
          "type": "vector",
          "url": "geodatasets:samples"
        }
      ]
    }
  ]
}
```

---

## Revision History

**Version**: 1.0
**Date**: 2025-12-22
**Status**: Active

**Changes**:
- Initial comprehensive reference specification
- Documented all 10 layer types
- Comprehensive configuration options for all layer types
- Storage architecture reference
- Time-enabled layers deep dive
- Performance and security considerations
- Troubleshooting guide
- Complete configuration examples
