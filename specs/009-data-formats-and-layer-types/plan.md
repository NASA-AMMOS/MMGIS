# Data Formats & Layer Types - Technical Implementation Plan

## Overview

This plan documents the technical implementation of MMGIS's comprehensive data format and layer type system. The system supports 10 distinct layer types across 4 storage backends with sophisticated time-enabled capabilities and dual rendering engine (Leaflet + Cesium) support.

## Architecture

### Layer Management Core

**Primary Module**: `src/essence/Basics/Layers_/Layers_.js` (4100+ lines)

**Responsibilities**:
- Layer lifecycle management (create, update, destroy)
- Configuration parsing and validation
- Rendering coordination between Map (Leaflet) and Globe (Cesium)
- Time-enabled layer updates
- Dynamic extent (viewport-based) query management
- Attachment system (labels, models, uncertainty, etc.)
- Sublayer management

**Key Functions**:
- `parseConfig()` - Parse layer configuration JSON
- `addLayer()` - Add layer to map/globe
- `removeLayer()` - Remove layer and cleanup
- `updateLayerTime()` - Handle time changes
- `toggleLayer()` - Show/hide layer
- `setLayerOpacity()` - Update layer opacity
- `getActiveLayers()` - Get list of active layers

### Rendering Engine Integration

**2D Map** (`src/essence/Basics/Map_/Map_.js`):
- **Library**: Leaflet 1.x
- **Supported Layers**: All except Model (Globe-only)
- **Custom Projections**: Via Proj4js
- **Z-Index Management**: Automatic layer ordering

**3D Globe** (`src/essence/Basics/Globe_/Globe_.js`):
- **Library**: Cesium 1.121 / LithoSphere 1.5.5
- **Supported Layers**: All layer types
- **Terrain**: DEM-based elevation via demtileurl
- **3D Features**: Models, clamped vectors, curtain geometries

**Synchronization**: ViewSync system keeps 2D and 3D views aligned

### Storage Backend Implementations

#### 1. Flat File Serving

**Server**: Express.js static file serving
**Location**: `API/public/` and `Missions/` directories
**Routes** (`API/Backend/APIs/routes.js`):
```javascript
// Tile serving
app.get('/Missions/:mission/Layers/*', serveTile);

// DEM serving
app.get('/Missions/:mission/DEMs/*', serveDEM);

// GeoJSON serving
app.get('/Missions/:mission/Layers/*.geojson', serveGeoJSON);
```

**Performance**:
- GZIP compression via Express middleware
- ETags for browser caching
- Range request support for COG

#### 2. PostGIS Geodatasets

**Database**: PostgreSQL with PostGIS extension
**Models**: `API/Backend/Databases/models/geodatasets.js`

**Table Schema**:
```javascript
{
  id: INTEGER PRIMARY KEY,
  file_id: INTEGER,        // DrawTool file ID
  feature_id: INTEGER,     // Unique feature ID within file
  group_id: INTEGER,       // Optional group ID
  properties: JSONB,       // Feature properties
  geometry: GEOMETRY,      // PostGIS geometry (EPSG:4326)
  start_time: TIMESTAMPTZ, // Optional start time
  end_time: TIMESTAMPTZ,   // Optional end time
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

**Spatial Indexing**:
```sql
CREATE INDEX idx_geometry ON geodatasets USING GIST (geometry);
CREATE INDEX idx_start_time ON geodatasets (start_time);
CREATE INDEX idx_end_time ON geodatasets (end_time);
```

**API Endpoints** (`API/Backend/APIs/Geodatasets.js`):
- `GET /api/geodatasets/:name` - Retrieve features as GeoJSON
- `POST /api/geodatasets/:name` - Bulk insert features
- `PUT /api/geodatasets/:name/:id` - Update feature
- `DELETE /api/geodatasets/:name/:id` - Delete feature
- `GET /api/geodatasets/:name/mvt/:z/:x/:y` - Generate vector tiles

**Spatial Queries**:
```javascript
// Bounding box query
SELECT ST_AsGeoJSON(geometry), properties
FROM geodatasets
WHERE ST_Intersects(
  geometry,
  ST_MakeEnvelope($minx, $miny, $maxx, $maxy, 4326)
);

// Temporal query
SELECT * FROM geodatasets
WHERE start_time <= $currentTime
  AND (end_time IS NULL OR end_time >= $currentTime);

// Vector tile generation
SELECT ST_AsMVT(q, 'layer_name', 4096, 'geom')
FROM (
  SELECT
    id,
    properties,
    ST_AsMVTGeom(geometry, bbox, 4096, 256, true) AS geom
  FROM geodatasets
  WHERE ST_Intersects(geometry, bbox)
) q;
```

#### 3. Local File System Storage

**Integration**: `API/Backend/APIs/Files.js`
**Configuration**: Uses `Missions/` directory

**Operations**:
```javascript
// Upload file
async function uploadFile(missionName, filePath, fileData) {
  const destPath = path.join('Missions', missionName, 'Data', filePath);
  await fs.writeFile(destPath, fileData);
}

// Read file
async function readFile(missionName, filePath) {
  const srcPath = path.join('Missions', missionName, 'Data', filePath);
  return await fs.readFile(srcPath);
}

// List files
async function listFiles(missionName, directory) {
  const dirPath = path.join('Missions', missionName, directory);
  return await fs.readdir(dirPath);
}
```

**Directories**:
- `Missions/{mission}/Data/` - Mission data files
- `Missions/{mission}/public/` - Public web-accessible files
- `Missions/{mission}/Layers/` - Layer configuration

#### 4. Remote Server Integration

**HTTP Client**: node-fetch (backend), fetch API (frontend)
**CORS**: Handled by browser with preflight OPTIONS requests
**Caching**: Browser cache + optional service worker

**WMS/WMTS Support**:
- URL parsing and parameter injection
- GetCapabilities parsing for layer metadata
- GetFeatureInfo for feature queries

---

## Layer Type Implementations

### 1. Vector Layer

**Frontend**: `Layers_.js` vector layer handlers
**Format Parsing**: Native browser GeoJSON parsing
**Rendering**:
- **Leaflet**: L.geoJSON with custom styling
- **Cesium**: GeoJsonDataSource with per-feature styling

**Key Features**:

**Styling System**:
```javascript
function getFeatureStyle(feature, layerConfig) {
  // Layer-level defaults
  let style = {
    strokeColor: layerConfig.strokeColor || '#000000',
    strokeOpacity: layerConfig.strokeOpacity || 1,
    strokeWeight: layerConfig.strokeWeight || 2,
    fillColor: layerConfig.fillColor || '#ffffff',
    fillOpacity: layerConfig.fillOpacity || 0.3
  };

  // Per-feature overrides
  if (feature.properties.style) {
    style = {...style, ...feature.properties.style};
  }

  return style;
}
```

**Attachment System** (`Layers_.js` L.attachmentHandlers):
- **Labels**: L.marker with divIcon
- **Pairings**: L.polyline connecting features across layers
- **Uncertainty**: L.ellipse or Cesium EllipsoidGraphics
- **Models**: Cesium Model with position/rotation
- **Images**: L.imageOverlay with transform

**Time Filtering** (Local Mode):
```javascript
function filterFeaturesByTime(features, currentTime, startProp, endProp) {
  return features.filter(feature => {
    const startTime = getNestedProperty(feature.properties, startProp);
    const endTime = endProp ? getNestedProperty(feature.properties, endProp) : null;

    if (!startTime) return true; // No time property

    const start = parseTime(startTime);
    if (endTime) {
      const end = parseTime(endTime);
      return start <= currentTime && currentTime <= end;
    }
    return start <= currentTime;
  });
}
```

**Dynamic Extent** (Controlled Mode):
```javascript
function updateControlledLayer(layer, viewport) {
  const url = layer.controlledUrl
    .replace('{minx}', viewport.west)
    .replace('{miny}', viewport.south)
    .replace('{maxx}', viewport.east)
    .replace('{maxy}', viewport.north)
    .replace('{zoom}', viewport.zoom);

  // Check move threshold
  const movement = calculateMovement(layer.lastViewport, viewport);
  if (movement < layer.controlledMoveThreshold) return;

  // Fetch new data
  fetch(url)
    .then(res => res.json())
    .then(geojson => updateLayerFeatures(layer, geojson));

  layer.lastViewport = viewport;
}
```

### 2. Tile Layer

**Frontend**: `Layers_.js` tile layer handlers
**Rendering**:
- **Leaflet**: L.tileLayer with standard XYZ tile loading
- **Cesium**: UrlTemplateImageryProvider or WebMapServiceImageryProvider

**Time-Enabled Tiles**:
```javascript
function getTileUrl(template, z, x, y, time, timeFormat) {
  let url = template
    .replace('{z}', z)
    .replace('{x}', x)
    .replace('{y}', y);

  if (time && timeFormat) {
    const formattedTime = formatTime(time, timeFormat);
    url = url
      .replace('{time}', formattedTime)
      .replace('{starttime}', formattedTime)
      .replace('{endtime}', formattedTime);
  }

  return url;
}
```

**DEM Integration** (Cesium Terrain):
```javascript
function createTerrainProvider(demtileurl, demParser) {
  if (demParser === '1bto4b') {
    return new Cesium.CustomHeightmapTerrainProvider({
      url: demtileurl,
      parser: parse1bto4b
    });
  } else {
    return new Cesium.CesiumTerrainProvider({
      url: demtileurl
    });
  }
}
```

**Tile Server Proxy**:
When `throughTileServer: true`, requests routed through:
```
/api/tiles/{mission}/{layer}/{z}/{x}/{y}.{ext}
```
Backend handles coordinate transformation, caching, and format conversion.

### 3. Data Layer

**Frontend**: `Layers_.js` data layer with WebGL shader
**Format**: Custom 1bto4b binary DEM format

**1bto4b Parser**:
```javascript
function parse1bto4b(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);
  const bands = view.getUint8(4);

  const data = new Float32Array(width * height);
  let offset = 5;

  for (let i = 0; i < width * height; i++) {
    // Decompress elevation value
    data[i] = view.getFloat32(offset, true);
    offset += 4;
  }

  return {width, height, data};
}
```

**Colorize Shader** (WebGL):
```glsl
// Vertex Shader
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}

// Fragment Shader
precision mediump float;
uniform sampler2D u_demTexture;
uniform vec3 u_colorRamp[10];
uniform float u_colorRampValues[10];
uniform int u_colorRampLength;
uniform float u_noDataValue;
varying vec2 v_texCoord;

void main() {
  float elevation = texture2D(u_demTexture, v_texCoord).r;

  // NoData check
  if (abs(elevation - u_noDataValue) < 0.1) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // Transparent
    return;
  }

  // Find color ramp position
  vec3 color = u_colorRamp[0];
  for (int i = 0; i < 9; i++) {
    if (i >= u_colorRampLength - 1) break;
    if (elevation >= u_colorRampValues[i] && elevation <= u_colorRampValues[i+1]) {
      float t = (elevation - u_colorRampValues[i]) /
                (u_colorRampValues[i+1] - u_colorRampValues[i]);
      color = mix(u_colorRamp[i], u_colorRamp[i+1], t);
      break;
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
```

**Viewport-Adaptive Range**:
```javascript
function calculateViewportRange(tiles) {
  let min = Infinity, max = -Infinity;

  tiles.forEach(tile => {
    tile.data.forEach(value => {
      if (value !== tile.noDataValue) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
  });

  return {min, max};
}
```

### 4. Model Layer

**Frontend**: `Layers_.js` model layer (Globe only)
**Rendering**: Cesium.Model with position/rotation

**Model Loading**:
```javascript
function loadModel(url, position, rotation, scale) {
  const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
    Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.elevation
    ),
    new Cesium.HeadingPitchRoll(rotation.z, rotation.y, rotation.x)
  );

  Cesium.Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

  return Cesium.Model.fromGltf({
    url: url,
    modelMatrix: modelMatrix,
    scale: scale
  });
}
```

**Format Support**:
- **OBJ**: Converted to glTF on load via three.js OBJLoader
- **glTF/GLB**: Native Cesium support
- **DAE**: Converted to glTF via three.js ColladaLoader

### 5. Image Layer

**Frontend**: `Layers_.js` image layer with TiTiler integration
**Backend**: TiTiler service (separate Docker container)

**COG Transformation**:
```javascript
function buildCOGUrl(baseUrl, cogConfig) {
  const params = new URLSearchParams({
    url: cogConfig.url,
    rescale: `${cogConfig.cogMin},${cogConfig.cogMax}`,
    colormap_name: cogConfig.colormap,
    return_mask: cogConfig.hideNoData
  });

  return `${baseUrl}/cog/tiles/{z}/{x}/{y}.png?${params}`;
}
```

**TiTiler Integration** (`API/Backend/APIs/routes.js`):
```javascript
app.get('/api/cog/tiles/:z/:x/:y.png', async (req, res) => {
  const {z, x, y} = req.params;
  const {url, rescale, colormap_name, return_mask} = req.query;

  // Proxy to TiTiler service
  const titilerUrl = `${process.env.TITILER_ENDPOINT}/cog/tiles/${z}/${x}/${y}.png`;
  const response = await fetch(titilerUrl + '?' + querystring);

  res.set('Content-Type', 'image/png');
  response.body.pipe(res);
});
```

### 6. VectorTile Layer

**Frontend**: `Layers_.js` vectortile layer
**Rendering**:
- **Leaflet**: L.vectorGrid.protobuf
- **Cesium**: Cesium3DTileset with custom MVT loader

**MVT Parsing**:
```javascript
// Using @mapbox/vector-tile library
function parseMVT(buffer) {
  const tile = new VectorTile(new Pbf(buffer));
  const layers = {};

  for (let layerName in tile.layers) {
    const layer = tile.layers[layerName];
    layers[layerName] = {
      features: []
    };

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i).toGeoJSON(x, y, z);
      layers[layerName].features.push(feature);
    }
  }

  return layers;
}
```

**Dynamic MVT Generation** (PostGIS):
```sql
-- Generate MVT tile from geodatasets
SELECT ST_AsMVT(tile, 'layer_name', 4096, 'geom') AS mvt
FROM (
  SELECT
    id,
    properties::json AS props,
    ST_AsMVTGeom(
      geometry,
      ST_TileEnvelope($1, $2, $3), -- z, x, y
      4096,
      256,
      true
    ) AS geom
  FROM geodatasets
  WHERE geometry && ST_TileEnvelope($1, $2, $3)
    AND ST_Intersects(geometry, ST_TileEnvelope($1, $2, $3))
) tile;
```

### 7. Velocity Layer

**Frontend**: `Layers_.js` velocity layer
**Libraries**:
- **Streamlines**: leaflet-velocity plugin
- **Particles**: Leaflet.Rain plugin (custom)

**Streamlines Implementation**:
```javascript
function createStreamlines(velocityData, config) {
  return L.velocityLayer({
    data: velocityData,
    minVelocity: config.velocityMin,
    maxVelocity: config.velocityMax,
    velocityScale: config.particleMultiplier,
    particleAge: config.particleAge,
    lineWidth: config.lineWidth,
    frameRate: config.frameRate,
    colorScale: config.colorScale,
    displayValues: config.displayValues,
    displayOptions: {
      position: config.displayPosition
    }
  });
}
```

**Particle System**:
```javascript
class VelocityParticles {
  constructor(canvas, velocityData, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.velocityData = velocityData;
    this.config = config;

    this.initParticles();
  }

  initParticles() {
    for (let i = 0; i < this.config.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        age: 0,
        maxAge: this.config.particleAge
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(particle => {
      const velocity = this.getVelocityAt(particle.x, particle.y);

      particle.x += velocity.u * this.config.particleSpeed;
      particle.y += velocity.v * this.config.particleSpeed;
      particle.age++;

      if (particle.age > particle.maxAge || this.isOutOfBounds(particle)) {
        particle.x = Math.random() * this.canvas.width;
        particle.y = Math.random() * this.canvas.height;
        particle.age = 0;
      }

      this.ctx.fillStyle = this.config.particleColor;
      this.ctx.fillRect(particle.x, particle.y, this.config.particleSize, this.config.particleSize);
    });

    requestAnimationFrame(() => this.animate());
  }
}
```

### 8. Video Layer

**Frontend**: `Layers_.js` video layer
**Rendering**:
- **Leaflet**: L.videoOverlay with custom controls
- **Cesium**: Cesium.ImageryLayer with VideoElement as texture

**Video Overlay**:
```javascript
function createVideoOverlay(url, bounds, config) {
  const video = document.createElement('video');
  video.src = url;
  video.autoplay = config.autoplay;
  video.loop = config.loop;
  video.muted = config.muted;
  video.playsInline = config.playsInline;
  video.controls = config.controls;

  const videoOverlay = L.videoOverlay(video, bounds, {
    opacity: config.opacity,
    interactive: true
  });

  return videoOverlay;
}
```

**Cesium Video Texture**:
```javascript
function createCesiumVideoLayer(url, bounds, config) {
  const video = document.createElement('video');
  video.src = url;
  video.autoplay = config.autoplay;
  video.loop = config.loop;
  video.muted = config.muted;

  return new Cesium.ImageryLayer(
    new Cesium.SingleTileImageryProvider({
      url: video,
      rectangle: Cesium.Rectangle.fromDegrees(
        bounds[0], bounds[1], bounds[2], bounds[3]
      )
    })
  );
}
```

### 9. Header Layer

**Frontend**: `Layers_.js` header layer (UI only)
**No Rendering**: Purely organizational

**Implementation**:
```javascript
function createHeaderLayer(config) {
  // Create UI group in Layers Tool
  const headerGroup = createLayerGroup(config.name);

  // Add sublayers
  config.sublayers.forEach(sublayer => {
    const layer = createLayer(sublayer);
    headerGroup.addLayer(layer);
  });

  // Toggle behavior
  headerGroup.on('toggle', (visible) => {
    headerGroup.getLayers().forEach(layer => {
      layer.setVisible(visible);
    });
  });

  return headerGroup;
}
```

### 10. Query Layer

**Frontend**: `Layers_.js` query layer (internal)
**Rendering**: Same as Vector layer

**Management**:
```javascript
class QueryLayerManager {
  constructor() {
    this.queryLayer = null;
  }

  updateQueryResults(geojson) {
    if (this.queryLayer) {
      this.clearQueryLayer();
    }

    this.queryLayer = L.geoJSON(geojson, {
      style: this.getQueryStyle(),
      onEachFeature: (feature, layer) => {
        layer.on('click', () => this.showFeatureInfo(feature));
      }
    });

    Map_.map.addLayer(this.queryLayer);
  }

  clearQueryLayer() {
    if (this.queryLayer) {
      Map_.map.removeLayer(this.queryLayer);
      this.queryLayer = null;
    }
  }
}
```

---

## Time System Implementation

**Core Module**: `src/essence/Ancillary/TimeControl.js`

**Architecture**:
```javascript
const TimeControl = {
  currentTime: null,
  timeType: 'global', // or 'individual'
  listeners: [],

  setTime(newTime) {
    this.currentTime = newTime;
    this.notifyListeners();
  },

  registerListener(callback) {
    this.listeners.push(callback);
  },

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.currentTime));
  }
};
```

**Layer Time Updates**:
```javascript
// In Layers_.js
TimeControl.registerListener((newTime) => {
  Object.values(activeLayers).forEach(layer => {
    if (layer.time && layer.time.type === 'global') {
      updateLayerForTime(layer, newTime);
    }
  });
});

function updateLayerForTime(layer, time) {
  if (layer.time.mode === 'requery') {
    // Refetch data with new time
    const url = layer.url.replace('{time}', formatTime(time, layer.time.format));
    fetch(url).then(res => res.json()).then(data => {
      updateLayerData(layer, data);
    });
  } else if (layer.time.mode === 'local') {
    // Filter existing features
    const filteredFeatures = filterFeaturesByTime(
      layer.features,
      time,
      layer.time.startProp,
      layer.time.endProp
    );
    updateLayerDisplay(layer, filteredFeatures);
  }
}
```

---

## Performance Optimizations

### Vector Layer Optimizations

**Feature Clustering**:
```javascript
function clusterFeatures(features, zoom) {
  if (features.length < 100 || zoom > 14) {
    return features; // No clustering
  }

  // Use supercluster library
  const index = new Supercluster({
    radius: 40,
    maxZoom: 16
  });

  index.load(features.map(f => ({
    type: 'Feature',
    properties: f.properties,
    geometry: f.geometry
  })));

  const bounds = Map_.map.getBounds();
  const clusters = index.getClusters(
    [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    zoom
  );

  return clusters;
}
```

**Canvas Rendering** (for dense points):
```javascript
function renderPointsAsCanvas(features, bounds, zoom) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const point = Map_.latLngToContainerPoint([lat, lng]);

    ctx.fillStyle = feature.properties.color || '#ff0000';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  return L.imageOverlay(canvas.toDataURL(), bounds);
}
```

### Tile Layer Optimizations

**Tile Caching**:
```javascript
const tileCache = new Map();

function getTile(url) {
  if (tileCache.has(url)) {
    return tileCache.get(url);
  }

  return fetch(url)
    .then(res => res.blob())
    .then(blob => {
      tileCache.set(url, blob);
      if (tileCache.size > 500) {
        // LRU eviction
        const firstKey = tileCache.keys().next().value;
        tileCache.delete(firstKey);
      }
      return blob;
    });
}
```

**Tile Preloading**:
```javascript
function preloadTiles(bounds, zoom, layerUrl) {
  const tiles = getTileCoordinates(bounds, zoom);

  tiles.forEach(({z, x, y}) => {
    const url = layerUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y);

    // Preload with low priority
    fetch(url, {priority: 'low'})
      .then(res => res.blob())
      .then(blob => tileCache.set(url, blob));
  });
}
```

### Geodataset Optimizations

**Spatial Index Strategy**:
```sql
-- Create GIST index with appropriate settings
CREATE INDEX idx_geometry_gist ON geodatasets
USING GIST (geometry)
WITH (fillfactor = 90);

-- Cluster table by spatial index for better I/O
CLUSTER geodatasets USING idx_geometry_gist;

-- Analyze for query planner
ANALYZE geodatasets;
```

**Query Optimization**:
```sql
-- Use bounding box pre-filter before expensive ST_Intersects
SELECT * FROM geodatasets
WHERE geometry && ST_MakeEnvelope($minx, $miny, $maxx, $maxy, 4326)
  AND ST_Intersects(geometry, ST_MakeEnvelope($minx, $miny, $maxx, $maxy, 4326))
LIMIT 10000;
```

---

## Testing Strategy

### Unit Tests

**Layer Configuration Parsing** (`Layers_.test.js`):
```javascript
describe('Layer Configuration', () => {
  test('Parse vector layer config', () => {
    const config = {
      name: 'Test Layer',
      type: 'vector',
      url: 'test.geojson'
    };
    const layer = Layers_.parseConfig(config);
    expect(layer.type).toBe('vector');
    expect(layer.url).toBe('test.geojson');
  });

  test('Time-enabled layer config', () => {
    const config = {
      name: 'Time Layer',
      type: 'tile',
      url: 'tiles/{z}/{x}/{y}_{time}.png',
      time: {
        type: 'global',
        format: '%Y%m%d'
      }
    };
    const layer = Layers_.parseConfig(config);
    expect(layer.time.type).toBe('global');
  });
});
```

**Geodataset Model** (`geodatasets.test.js`):
```javascript
describe('Geodataset Model', () => {
  test('Create geodataset feature', async () => {
    const feature = {
      file_id: 1,
      feature_id: 1,
      properties: {name: 'Test'},
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    };

    const created = await Geodataset.create(feature);
    expect(created.file_id).toBe(1);
    expect(created.geometry).toBeDefined();
  });

  test('Spatial query', async () => {
    const bbox = {west: -1, south: -1, east: 1, north: 1};
    const features = await Geodataset.findInBounds(bbox);
    expect(features.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

**End-to-End Layer Loading** (`e2e/layers.test.js`):
```javascript
describe('Layer Loading E2E', () => {
  test('Load and display vector layer', async () => {
    // Navigate to mission page
    await page.goto('http://localhost:8888/#mission=Test');

    // Enable test layer
    await page.click('.layer-toggle[data-layer="Test Layer"]');

    // Wait for features to load
    await page.waitForSelector('.leaflet-interactive');

    // Verify features rendered
    const features = await page.$$('.leaflet-interactive');
    expect(features.length).toBeGreaterThan(0);
  });
});
```

---

## Deployment Considerations

### Database Setup

**Initial Migration**:
```sql
-- Run via scripts/init-db.js
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create geodatasets tables
-- (Dynamically created per geodataset, managed by backend)
```

**Backup Strategy**:
```bash
# Daily geodataset backups
pg_dump -U mmgis -t 'g*_geodatasets' mmgis_db > geodatasets_backup.sql

# Full database backup
pg_dump -U mmgis mmgis_db > mmgis_full_backup.sql
```

### TiTiler Service

**Docker Compose** (`docker-compose.yml`):
```yaml
titiler:
  image: ghcr.io/developmentseed/titiler:latest
  ports:
    - "8000:8000"
  environment:
    - WORKERS=4
    - GDAL_CACHEMAX=512
    - VSI_CACHE=TRUE
```

### File System Configuration

**Setup**: No special configuration required

**Mission Directory Structure**:
```
Missions/
  {mission_name}/
    config.json           # Mission configuration
    Data/                 # Geodata files
      *.geojson
      *.tif
      *.png
    Layers/               # Layer definitions
      *.json
    public/               # Web-accessible assets
      images/
      models/
```

**Permissions**: Ensure MMGIS process has read/write access to `Missions/` directory

---

## Configuration Management

### Mission Configuration Structure

**Database Table**: `missions` (managed by Configure page)

**Schema**:
```javascript
{
  id: INTEGER,
  name: STRING,
  configuration: JSONB,  // Full mission config including layers
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

**Configuration JSON**:
```json
{
  "msv": 4,
  "configuration": {
    "projection": {...},
    "initialView": {...},
    "layers": [
      {/* Layer config */},
      ...
    ],
    "tools": {...},
    "time": {...}
  }
}
```

### API Endpoints

**Configure API** (`API/Backend/APIs/Configure.js`):
- `GET /api/configure/:mission` - Get mission configuration
- `POST /api/configure/:mission` - Create mission
- `PUT /api/configure/:mission` - Update configuration
- `DELETE /api/configure/:mission` - Delete mission

---

## Security Implementation

### Authentication Middleware

**Layer Access Control** (`API/Backend/Utils/authenticate.js`):
```javascript
function checkLayerAccess(req, res, next) {
  const mission = req.params.mission;
  const user = req.user;

  // Check mission permissions
  Mission.findOne({where: {name: mission}})
    .then(mission => {
      if (!mission) return res.status(404).send('Mission not found');

      // Public missions
      if (mission.public) return next();

      // Check user permission
      return UserMission.findOne({
        where: {
          user_id: user.id,
          mission_id: mission.id
        }
      }).then(permission => {
        if (!permission) return res.status(403).send('Access denied');
        next();
      });
    });
}
```

### Input Validation

**GeoJSON Validation** (`API/Backend/Utils/validation.js`):
```javascript
const geojsonValidation = require('geojson-validation');

function validateGeoJSON(geojson) {
  if (!geojsonValidation.valid(geojson)) {
    throw new Error('Invalid GeoJSON');
  }

  // Additional checks
  if (geojson.type === 'FeatureCollection') {
    geojson.features.forEach(feature => {
      // Sanitize properties
      feature.properties = sanitizeObject(feature.properties);

      // Validate geometry
      if (!isValidGeometry(feature.geometry)) {
        throw new Error('Invalid geometry');
      }
    });
  }

  return geojson;
}

function sanitizeObject(obj) {
  // Remove potentially dangerous properties
  const sanitized = {};
  for (let key in obj) {
    if (typeof obj[key] === 'string') {
      // XSS prevention
      sanitized[key] = escapeHtml(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
}
```

---

## Monitoring & Debugging

### Layer Loading Diagnostics

**Console Logging** (development mode):
```javascript
function loadLayer(config) {
  console.group(`Loading layer: ${config.name}`);
  console.log('Config:', config);
  console.time('Layer load time');

  try {
    const layer = createLayer(config);
    console.log('Layer created:', layer);
    console.timeEnd('Layer load time');
    console.groupEnd();
    return layer;
  } catch (error) {
    console.error('Layer load failed:', error);
    console.groupEnd();
    throw error;
  }
}
```

### Performance Monitoring

**Layer Render Time**:
```javascript
const layerMetrics = new Map();

function recordLayerMetric(layerName, metric, value) {
  if (!layerMetrics.has(layerName)) {
    layerMetrics.set(layerName, {});
  }
  layerMetrics.get(layerName)[metric] = value;
}

// Usage
const startTime = performance.now();
loadLayer(config);
recordLayerMetric(config.name, 'loadTime', performance.now() - startTime);
```

---

## Future Enhancements

### Planned Features

1. **3D Vector Extrusion**: Extrude polygons by property value in Globe
2. **Animation Support for Models**: Cesium model animations
3. **Wind Barbs Visualization**: Complete implementation for velocity layer
4. **Point Cloud Layer**: LAS/LAZ point cloud support
5. **Streaming Geodata**: WebSocket-based real-time feature streaming
6. **Client-Side Tiling**: Generate vector tiles in browser for offline use

### Performance Improvements

1. **Worker-Based Parsing**: Move GeoJSON parsing to Web Workers
2. **Virtualization**: Render only visible features using spatial index
3. **Progressive Loading**: Stream large GeoJSON files in chunks
4. **IndexedDB Caching**: Persistent browser cache for offline use

---

## Revision History

**Version**: 1.0
**Date**: 2025-12-22
**Status**: Active

**Changes**:
- Initial technical implementation plan
- Documented all layer type implementations
- Storage backend architecture
- Time system implementation
- Performance optimizations
- Security implementation
- Testing strategy
