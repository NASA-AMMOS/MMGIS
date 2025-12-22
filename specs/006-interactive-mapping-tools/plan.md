# Interactive Mapping Tools - Technical Implementation Plan

## Overview

This plan documents the technical implementation of MMGIS's comprehensive tool plugin architecture. The system provides 15 user-facing interactive tools through a unified plugin interface, enabling consistent integration while allowing domain-specific functionality.

## Architecture

### Tool Plugin System

**Core Module**: `src/essence/Basics/ToolController_/ToolController_.js`

**Responsibilities**:
- Tool registration and lifecycle management
- Dynamic loading via `toolModules` exports
- UI positioning (toolbar vs separated tools)
- State coordination and mutual exclusion
- URL state persistence

**Key Functions**:
- `activateTool(toolName)` - Initialize and display tool
- `deactivateTool(toolName)` - Clean up and hide tool
- `getToolState()` - Retrieve tool configuration
- `setToolState(state)` - Restore tool from URL

### Tool Interface Contract

All tools implement standardized interface:

```javascript
{
    height: Number,           // Panel height (0 = variable)
    width: Number,            // Panel width in pixels
    MMGISInterface: Object,   // Core interface object
    make: function(),         // Initialize tool
    destroy: function(),      // Clean up resources
    getUrlString: function()  // Serialize state to URL
}
```

### Configuration System

**Location**: `configure/public/toolConfigs.json`

**Structure per tool**:
```json
{
  "name": "Tool Name",
  "description": "Tool description",
  "icon": "mdi-icon-name",
  "toolbarPriority": 1000,
  "expandable": true,
  "separatedTool": false,
  "variables": {
    "configOption": "default value"
  },
  "uiConfig": [
    {
      "type": "text",
      "field": "configOption",
      "label": "Configuration Option"
    }
  ]
}
```

### Kinds System Integration

**Module**: `src/essence/Tools/Kinds/Kinds.js`

**Purpose**: Configuration plugin defining layer click behaviors

**Behavior Types**:
- `info` - Open Info Tool with feature properties
- `waypoint` - Display rover/vehicle overlays
- `chemistry_tool` - Activate Chemistry Tool
- `draw_tool` - Enable Draw Tool editing

**Implementation**: Maps layer configuration to tool activation patterns

---

## Tool Implementations

### 1. Animation Tool

**Location**: `src/essence/Tools/Animation/AnimationTool.js`

**Technology Stack**:
- HTML2Canvas for map canvas capture
- gifshot for GIF encoding
- @ffmpeg/ffmpeg (WebAssembly) for MP4 encoding
- JSZip for PNG sequence packaging

**Key Functions**:
```javascript
function captureFrame(bbox, time) {
  // Hide UI elements
  hideUIForCapture();

  // Zoom to bbox
  Map_.fitBounds(bbox);

  // Update time-enabled layers
  TimeControl.setTime(time);
  await waitForLayerRender();

  // Capture with HTML2Canvas
  const canvas = await html2canvas(mapElement);
  return canvas.toDataURL();
}

function exportAnimation(frames, format, fps) {
  if (format === 'gif') {
    return gifshot.createGIF({
      images: frames,
      gifWidth: width,
      gifHeight: height,
      interval: 1000 / fps
    });
  } else if (format === 'mp4') {
    // FFmpeg WebAssembly encoding
    return ffmpeg.encode(frames, fps);
  } else if (format === 'png') {
    // ZIP packaging
    const zip = new JSZip();
    frames.forEach((frame, i) => {
      zip.file(`frame_${i}.png`, frame, {base64: true});
    });
    return zip.generateAsync({type: 'blob'});
  }
}
```

**Performance Considerations**:
- Large animations (100+ frames) consume significant memory
- MP4 encoding is CPU-intensive (uses Web Workers)
- Recommended max: 1920x1080 resolution, 10 second duration

---

### 2. Chemistry Tool

**Location**: `src/essence/Tools/Chemistry/ChemistryTool.js`

**Technology Stack**:
- D3.js for chart rendering
- Custom `chemistrychart.js` and `chemistryplot.js` libraries

**Chart Types**:
- Bar chart (element percentages)
- Pie chart (proportional distribution)
- Scatter plot (multi-point comparison)

**Data Sources**:
- Feature properties with chemistry keys (SiO2, Fe2O3, etc.)
- Linked CSV datasets via `properties.datasets`
- Remote chemistry endpoints

**Expected Feature Properties**:
```javascript
{
  "name": "Sample Site A",
  "SiO2": 45.2,
  "Fe2O3": 15.8,
  "Al2O3": 10.3,
  "MgO": 8.5
  // Additional oxide percentages...
}
```

---

### 3. Curtain Tool

**Location**: `src/essence/Tools/Curtain/CurtainTool.js`

**Technology Stack**:
- OpenSeadragon for high-resolution radargram viewing
- Cesium for 3D curtain rendering
- Custom shaders for vertical positioning

**Data Format**:
- Georeferenced radar imagery with depth metadata
- Sol number and Rover Motion Counter (RMC) metadata

**Layer Configuration Example**:
```json
{
  "name": "GPR Data Sol 015",
  "type": "vector",
  "kind": "curtain",
  "curtainImagery": "path/to/radargram.png",
  "curtainDepth": 10,
  "curtainMetadata": {
    "sol": 15,
    "rmc_start": 1000,
    "rmc_end": 1500
  }
}
```

---

### 4. Draw Tool

**Location**: `src/essence/Tools/Draw/DrawTool.js`

**Component Structure**:
```
DrawTool.js               // Main controller
├── DrawTool_Drawing.js   // Drawing UI and Leaflet.draw integration
├── DrawTool_Editing.js   // Feature editing and properties
├── DrawTool_Files.js     // File list and operations
├── DrawTool_History.js   // History timeline and undo
├── DrawTool_Shapes.js    // Feature list and selection
├── DrawTool_Publish.js   // Publishing and master files
├── DrawTool_FileModal.js // File creation/upload modal
└── DrawTool_Templater.js // Template designer
```

**Database Schema**:

**user_files**:
```sql
CREATE TABLE user_files (
  id SERIAL PRIMARY KEY,
  file_owner VARCHAR(50) NOT NULL,
  file_owner_group STRING[],
  file_name VARCHAR(355) NOT NULL,
  file_description VARCHAR(10000),
  is_master BOOLEAN DEFAULT false,
  intent ENUM('roi','campaign','campsite','trail','signpost','all'),
  public ENUM('0','1') DEFAULT '0',
  hidden ENUM('0','1') DEFAULT '0',
  template JSON,
  publicity_type VARCHAR(255),
  public_editors TEXT[],
  created_on TIMESTAMP NOT NULL,
  updated_on TIMESTAMP NOT NULL
);
```

**user_features**:
```sql
CREATE TABLE user_features (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES user_files(id),
  level INTEGER,
  intent ENUM('roi','campaign','campsite','trail','signpost','polygon','line','point','text','arrow'),
  properties JSON,
  geom GEOMETRY(GEOMETRY,4326),
  extant_start BIGINT,
  extant_end BIGINT,
  trimmed_start BIGINT[],
  trimmed_at STRING[],
  trimmed_at_final BIGINT
);
```

**file_histories**:
```sql
CREATE TABLE file_histories (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES user_files(id),
  history_id INTEGER,
  time BIGINT,
  action_index INTEGER, -- 0=add, 1=edit, 2=delete, 3=undo, 5=clip-over, 6=merge, 7=clip-under, 8=split
  history INT[],
  author VARCHAR(255)
);
```

**API Endpoints**:

**Drawing Operations** (`/api/draw`):
```javascript
// Add feature
POST /api/draw/add
Body: { file_id, geometry, properties, intent, clip: 'over'|'under'|null }
Returns: { status, message, body: { id, intent } }

// Edit feature
POST /api/draw/edit
Body: { file_id, feature_id, geometry, properties, intent }
Returns: { status, message, body: { id, uuid, intent } }

// Remove feature (soft delete)
POST /api/draw/remove
Body: { file_id, id }
Returns: { status, message }

// Undo to timestamp
POST /api/draw/undo
Body: { file_id, undo_time }
Returns: { status, message }

// Merge features
POST /api/draw/merge
Body: { file_id, prop_id, ids: [id1, id2, ...] }
Returns: { status, message, body: { ids: [new_ids] } }

// Split features
POST /api/draw/split
Body: { file_id, split: line_geojson, ids: [id1, id2, ...] }
Returns: { status, message, body: { ids: [new_ids] } }
```

**File Management** (`/api/files`):
```javascript
POST /api/files/get        // Retrieve user's files list
POST /api/files/getfile    // Retrieve specific file with features
POST /api/files/make       // Create new file
POST /api/files/change     // Update file metadata
POST /api/files/remove     // Delete file and features
POST /api/files/gethistory // Retrieve file edit history
POST /api/files/modifykeyword // Rename/remove folder/tag
```

**Geometric Operations**:

**Clipping** (PostGIS ST_DIFFERENCE):
```javascript
async function clipFeatures(newGeometry, existingFeatures, clipMode) {
  if (clipMode === 'over') {
    // New geometry clips existing
    for (const feature of existingFeatures) {
      const clipped = await db.query(
        `SELECT ST_AsGeoJSON(ST_Difference(
          ST_GeomFromGeoJSON($1),
          ST_Buffer(ST_GeomFromGeoJSON($2), 0)
        ))`,
        [feature.geometry, newGeometry]
      );
      await updateFeature(feature.id, clipped);
    }
  } else if (clipMode === 'under') {
    // New geometry is clipped by existing
    let resultGeometry = newGeometry;
    for (const feature of existingFeatures) {
      resultGeometry = await db.query(
        `SELECT ST_AsGeoJSON(ST_Difference(
          ST_GeomFromGeoJSON($1),
          ST_Buffer(ST_GeomFromGeoJSON($2), 0)
        ))`,
        [resultGeometry, feature.geometry]
      );
    }
    return resultGeometry;
  }
}
```

**Merge** (PostGIS ST_UNION):
```javascript
async function mergeFeatures(fileId, featureIds, propFeatureId) {
  const merged = await db.query(
    `SELECT ST_AsGeoJSON(ST_Union(
      ST_Buffer(geom, 0.000001, 'endcap=mitre join=mitre')
    )) as geometry
    FROM user_features
    WHERE file_id = $1 AND id = ANY($2)`,
    [fileId, featureIds]
  );

  const properties = await getFeatureProperties(propFeatureId);
  return createFeature(fileId, merged.geometry, properties);
}
```

**Split** (PostGIS ST_SPLIT):
```javascript
async function splitFeatures(fileId, featureIds, splitLine) {
  const results = [];
  for (const featureId of featureIds) {
    const split = await db.query(
      `SELECT ST_AsGeoJSON(
        (ST_Dump(ST_Split(geom, ST_GeomFromGeoJSON($1)))).geom
      ) as geometry
      FROM user_features
      WHERE id = $2`,
      [splitLine, featureId]
    );

    const properties = await getFeatureProperties(featureId);
    for (const geom of split.rows) {
      results.push(await createFeature(fileId, geom.geometry, properties));
    }

    await softDeleteFeature(featureId);
  }
  return results;
}
```

**Template System**:

**Template Structure**:
```javascript
{
  "fields": [
    {
      "name": "site_name",
      "type": "text",
      "required": true,
      "default": ""
    },
    {
      "name": "sol",
      "type": "incrementer",
      "prefix": "SOL",
      "suffix": "",
      "length": 3
    },
    {
      "name": "observation_type",
      "type": "dropdown",
      "options": ["Image", "Spectra", "ChemCam", "Sample"]
    },
    {
      "name": "observation_date",
      "type": "date",
      "format": "YYYY-MM-DD"
    }
  ]
}
```

**Incrementer Logic**:
```javascript
function getNextIncrementerValue(fileId, field) {
  // Get all feature properties for this file
  const features = getFileFeatures(fileId);

  // Extract used values
  const usedValues = features
    .map(f => f.properties[field.name])
    .filter(v => v && v.match(new RegExp(`^${field.prefix}\\d+${field.suffix}$`)))
    .map(v => parseInt(v.replace(field.prefix, '').replace(field.suffix, '')));

  // Find next available
  let next = 1;
  while (usedValues.includes(next)) {
    next++;
  }

  // Format with padding
  return `${field.prefix}${next.toString().padStart(field.length, '0')}${field.suffix}`;
}
```

**Leaflet Integration**:
```javascript
// Drawing with clip-over/under
L.Draw.Polygon.prototype.addHooks = function() {
  // Original Leaflet.draw logic
  // ...

  // Custom clipping on finish
  this._finishShape = async function() {
    const drawnGeometry = this._poly.toGeoJSON();

    if (DrawTool.clipMode === 'over' || DrawTool.clipMode === 'under') {
      const existingFeatures = getIntersectingFeatures(drawnGeometry);
      drawnGeometry = await clipFeatures(drawnGeometry, existingFeatures, DrawTool.clipMode);
    }

    DrawTool.addFeature(drawnGeometry);
  };
};
```

**Cesium Integration**:
```javascript
Globe_.litho.addLayer('clamped', {
  name: 'camptool_DrawTool_' + fileId,
  on: true,
  geojson: normalizedFeatures,
  opacity: 1,
  style: { letPropertiesStyleOverride: true }
});
```

---

### 5. Identifier Tool

**Location**: `src/essence/Tools/Identifier/IdentifierTool.js`

**Technology Stack**:
- GDAL backend for raster queries (`/api/gdal/raster`)
- Debounced mousemove events
- LRU cache for recent queries

**Query Workflow**:
```javascript
async function queryRasterValue(lat, lon, layerConfig) {
  // Check cache
  const cacheKey = `${lat},${lon},${layerConfig.url}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Format URL with time if time-enabled
  let url = layerConfig.url;
  if (layerConfig.time) {
    const formattedTime = formatTime(TimeControl.currentTime, layerConfig.timeFormat);
    url = url.replace('{time}', formattedTime);
  }

  // Query GDAL backend
  const response = await fetch(`/api/gdal/raster`, {
    method: 'POST',
    body: JSON.stringify({
      url: url,
      lat: lat,
      lon: lon,
      bands: layerConfig.bands
    })
  });

  const data = await response.json();

  // Apply scale factor
  const values = data.values.map(v => v * (layerConfig.scalefactor || 1));

  // Format with sigfigs
  const formatted = values.map(v => v.toFixed(layerConfig.sigfigs || 2));

  // Cache result
  cache.set(cacheKey, formatted);

  return formatted;
}
```

**Configuration Per Layer**:
```javascript
{
  "identifier": {
    "layer-uuid-1": {
      "url": "path/to/raster.tif",
      "bands": 3,
      "sigfigs": 2,
      "unit": "meters",
      "scalefactor": 1.0,
      "timeFormat": "%Y-%m-%dT%H:%M:%SZ"
    }
  }
}
```

---

### 6. Info Tool

**Location**: `src/essence/Tools/Info/InfoTool.js`

**Key Functions**:
```javascript
function displayFeatureProperties(feature) {
  // Sort if configured
  let properties = feature.properties;
  if (config.sortAlphabetically) {
    properties = sortObjectKeys(properties);
  }

  // Format as JSON with syntax highlighting
  const formattedJSON = syntaxHighlight(JSON.stringify(properties, null, 2));

  // Render in panel
  $('#infoToolContent').html(formattedJSON);

  // Add action buttons
  addCopyButton(feature);
  addLocateButton(feature);
  addToggleVisibilityButton(feature);
}

function syntaxHighlight(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    function (match) {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}
```

**Multi-Feature Handling**:
```javascript
Map_.on('click', function(e) {
  const features = Map_.queryRenderedFeatures(e.point);

  if (features.length === 0) {
    return;
  } else if (features.length === 1) {
    InfoTool.displayFeatureProperties(features[0]);
  } else {
    // Show dropdown for selection
    showFeatureSelector(features, function(selectedFeature) {
      InfoTool.displayFeatureProperties(selectedFeature);
    });
  }
});
```

---

### 7. Isochrone Tool

**Location**: `src/essence/Tools/Isochrone/IsochroneTool.js`

**Key Files**:
- `IsochroneTool_Manager.js` - Manages multiple isochrone instances
- `IsochroneTool_Query.js` - Data fetching from tile sources
- `IsochroneTool_Algorithm.js` - Cost computation algorithms

**Algorithm** (Dijkstra's on tile grid):
```javascript
function computeIsochrone(startPoint, costBudget, tileSources) {
  // Build graph from tiles
  const graph = buildGraphFromTiles(startPoint, tileSources);

  // Dijkstra's algorithm
  const distances = new Map();
  const priorityQueue = new PriorityQueue();

  distances.set(startPoint, 0);
  priorityQueue.enqueue(startPoint, 0);

  while (!priorityQueue.isEmpty()) {
    const current = priorityQueue.dequeue();
    const currentCost = distances.get(current);

    if (currentCost > costBudget) continue;

    // Check neighbors
    for (const neighbor of getNeighbors(current, graph)) {
      const edgeCost = calculateEdgeCost(current, neighbor, tileSources);
      const newCost = currentCost + edgeCost;

      if (!distances.has(neighbor) || newCost < distances.get(neighbor)) {
        distances.set(neighbor, newCost);
        priorityQueue.enqueue(neighbor, newCost);
      }
    }
  }

  // Generate contour polygons
  return generateContours(distances, costBudget);
}

function calculateEdgeCost(from, to, tileSources) {
  let cost = 0;

  // Distance component
  cost += distance(from, to);

  // Slope component
  if (tileSources.slope) {
    const slope = getSlopeValue(to, tileSources.slope);
    cost *= (1 + slope / 45); // Scale by slope angle
  }

  // Obstacle component
  if (tileSources.obstacle) {
    const obstacle = getObstacleValue(to, tileSources.obstacle);
    if (obstacle > 0.8) cost = Infinity; // Impassable
  }

  // Custom cost layer
  if (tileSources.cost) {
    const customCost = getCostValue(to, tileSources.cost);
    cost *= customCost;
  }

  return cost;
}
```

**Least-Cost Path** (on hover):
```javascript
function computeLeastCostPath(startPoint, hoverPoint, distances) {
  const path = [hoverPoint];
  let current = hoverPoint;

  while (current !== startPoint) {
    const neighbors = getNeighbors(current);

    // Find neighbor with lowest distance
    let minNeighbor = null;
    let minDistance = Infinity;

    for (const neighbor of neighbors) {
      if (distances.has(neighbor) && distances.get(neighbor) < minDistance) {
        minDistance = distances.get(neighbor);
        minNeighbor = neighbor;
      }
    }

    if (!minNeighbor) break; // No path found

    path.unshift(minNeighbor);
    current = minNeighbor;
  }

  return path;
}
```

---

### 8. Layers Tool

**Location**: `src/essence/Tools/Layers/LayersTool.js`

**Key Functions**:
```javascript
function buildLayerTree(layers) {
  const tree = $('<ul class="layer-tree"></ul>');

  layers.forEach(layer => {
    const item = $('<li></li>');

    // Toggle checkbox
    const checkbox = $('<input type="checkbox">')
      .prop('checked', layer.on)
      .on('change', () => L_.toggleLayer(layer.uuid));

    // Opacity slider
    const opacitySlider = $('<input type="range" min="0" max="100">')
      .val(layer.opacity * 100)
      .on('input', (e) => L_.setLayerOpacity(layer.uuid, e.target.value / 100));

    // Info button
    const infoButton = $('<button class="mdi mdi-information"></button>')
      .on('click', () => showLayerInfo(layer));

    // Download button (vector layers only)
    if (layer.type === 'vector') {
      const downloadButton = $('<button class="mdi mdi-download"></button>')
        .on('click', () => downloadLayer(layer));
      item.append(downloadButton);
    }

    item.append(checkbox, layer.name, opacitySlider, infoButton);

    // Sublayers
    if (layer.sublayers) {
      item.append(buildLayerTree(layer.sublayers));
    }

    tree.append(item);
  });

  return tree;
}
```

**Feature Filtering**:
```javascript
function applyFeatureFilter(layer, filterExpression) {
  // Parse filter expression (SQL-like syntax)
  const filter = parseFilterExpression(filterExpression);

  // Filter features
  const filteredFeatures = layer.features.filter(feature => {
    return evaluateFilter(feature.properties, filter);
  });

  // Update layer display
  L_.updateLayerFeatures(layer.uuid, filteredFeatures);
}

function parseFilterExpression(expression) {
  // Example: "temperature > 300 AND sample_type IN ('soil', 'rock')"
  // Returns: { conditions: [...], logic: 'AND' }
  // ... parsing logic
}
```

**Data Shader Controls**:
```javascript
function updateDataShader(layer, config) {
  // Update colormap
  if (config.colormap) {
    layer.colormap = config.colormap;
  }

  // Update value range
  if (config.min !== undefined || config.max !== undefined) {
    layer.range = {
      type: 'fixed',
      min: config.min,
      max: config.max
    };
  }

  // Trigger re-render with new shader config
  L_.updateDataLayer(layer.uuid, {
    colormap: layer.colormap,
    range: layer.range
  });
}
```

---

### 9. Legend Tool

**Location**: `src/essence/Tools/Legend/LegendTool.js`

**Legend Sources** (priority order):
1. CSV file (`layer.legend` property)
2. JSON array (`layer.Raw Variables.legend`)
3. Auto-generated from layer styling
4. COG colormap from TiTiler metadata

**Legend Rendering**:
```javascript
function renderLegend(layer) {
  const legendContainer = $('<div class="legend-item"></div>');

  // Header
  legendContainer.append(`<h3>${layer.name}</h3>`);

  if (layer.legend) {
    // Discrete legend
    layer.legend.forEach(item => {
      const row = $(`
        <div class="legend-row">
          <div class="legend-swatch" style="background-color: ${item.color}"></div>
          <div class="legend-label">${item.label}</div>
        </div>
      `);
      legendContainer.append(row);
    });
  } else if (layer.colorRamp) {
    // Gradient legend
    const gradient = buildGradient(layer.colorRamp);
    const gradientBar = $(`
      <div class="legend-gradient" style="background: ${gradient}"></div>
    `);
    legendContainer.append(gradientBar);

    // Min/max labels
    legendContainer.append(`
      <div class="legend-range">
        <span>${layer.range.min} ${layer.units}</span>
        <span>${layer.range.max} ${layer.units}</span>
      </div>
    `);
  }

  $('#legendToolContent').append(legendContainer);
}

function buildGradient(colorRamp) {
  const stops = colorRamp.map((stop, i) => {
    const percent = (i / (colorRamp.length - 1)) * 100;
    return `${stop.color} ${percent}%`;
  }).join(', ');

  return `linear-gradient(to right, ${stops})`;
}
```

**CSV Legend Format**:
```csv
value,color,label
0,#0000ff,Ice
1,#00ff00,Vegetation
2,#ffff00,Sand
3,#ff0000,Rock
```

**JSON Legend Format**:
```javascript
{
  "legend": [
    {"value": 0, "color": "#0000ff", "label": "Ice"},
    {"value": 1, "color": "#00ff00", "label": "Vegetation"},
    {"value": 2, "color": "#ffff00", "label": "Sand"},
    {"value": 3, "color": "#ff0000", "label": "Rock"}
  ]
}
```

---

### 10. Measure Tool

**Location**: `src/essence/Tools/Measure/MeasureTool.js`

**Key Files**:
- `MeasureTool.js` - Main controller
- `MeasureComponents.js` - React profile chart components

**Technology Stack**:
- React for UI components
- Chart.js for elevation profiles
- GDAL backend for DEM queries (`/api/gdal/raster`)

**Measurement Modes**:
```javascript
const MODES = {
  SEGMENT: 'segment',          // Individual segments
  CONTINUOUS: 'continuous',     // Cumulative distance
  CONTINUOUS_COLOR: 'continuous_color' // Colored by elevation
};
```

**Elevation Profile Generation**:
```javascript
async function generateElevationProfile(points, demUrl) {
  const profile = [];
  let cumulativeDistance = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    // Query elevation from DEM
    const elevation = await queryDEM(point.lat, point.lng, demUrl);

    // Calculate distance from previous point
    if (i > 0) {
      const prevPoint = points[i - 1];
      const segmentDistance = haversineDistance(prevPoint, point);
      cumulativeDistance += segmentDistance;
    }

    profile.push({
      lat: point.lat,
      lng: point.lng,
      elevation: elevation,
      distance: cumulativeDistance,
      elevationGain: i > 0 ? elevation - profile[i-1].elevation : 0
    });
  }

  return profile;
}

async function queryDEM(lat, lng, demUrl) {
  const response = await fetch('/api/gdal/raster', {
    method: 'POST',
    body: JSON.stringify({ url: demUrl, lat, lng, bands: 1 })
  });
  const data = await response.json();
  return data.values[0];
}
```

**Line-of-Sight Analysis**:
```javascript
function calculateLineOfSight(observer, target, profile, observerHeight, targetHeight) {
  const los = {
    visible: true,
    obstructions: []
  };

  // Observer and target adjusted elevations
  const obsElev = profile[0].elevation + observerHeight;
  const targElev = profile[profile.length - 1].elevation + targetHeight;

  // Check each intermediate point
  for (let i = 1; i < profile.length - 1; i++) {
    const point = profile[i];

    // Interpolate line-of-sight elevation at this distance
    const t = point.distance / profile[profile.length - 1].distance;
    const losElev = obsElev + t * (targElev - obsElev);

    // Check if terrain obstructs
    if (point.elevation > losElev) {
      los.visible = false;
      los.obstructions.push(point);
    }
  }

  return los;
}
```

**Chart.js Profile Chart**:
```javascript
function createProfileChart(profile) {
  const ctx = document.getElementById('profileChart').getContext('2d');

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: profile.map(p => p.distance.toFixed(2)),
      datasets: [{
        label: 'Elevation (m)',
        data: profile.map(p => p.elevation),
        borderColor: 'rgb(75, 192, 192)',
        fill: {
          target: 'origin',
          above: 'rgba(75, 192, 192, 0.3)'
        }
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Distance (m)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Elevation (m)'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = profile[context.dataIndex];
              return [
                `Elevation: ${point.elevation.toFixed(2)} m`,
                `Distance: ${point.distance.toFixed(2)} m`,
                `Gain: ${point.elevationGain.toFixed(2)} m`
              ];
            }
          }
        }
      }
    }
  });
}
```

---

### 11. Shade Tool

**Location**: `src/essence/Tools/Shade/ShadeTool.js`

**Key Files**:
- `ShadeTool.js` - Main controller
- `ShadeTool_Manager.js` - Manages multiple shade instances
- `ShadeTool_Algorithm.js` - Shadow computation

**Backend Scripts**:
- `ll2aerll.py` - Lat/lon to azimuth/elevation conversion using SPICE
- `chronos.py` - Time conversion (UTC ↔ spacecraft time)

**SPICE Integration**:
```python
# ll2aerll.py - Calculate azimuth/elevation to source body
import spiceypy as spice

def ll2aerll(observer_body, target_body, time, lat, lon, height):
    # Load SPICE kernels
    spice.furnsh('kernels/lsk/naif0012.tls')
    spice.furnsh('kernels/pck/pck00010.tpc')
    spice.furnsh('kernels/spk/de430.bsp')

    # Observer position on surface
    observer_pos = spice.georec(lon, lat, height, observer_body_radii, observer_body_flattening)

    # Target position at time
    target_state, _ = spice.spkezr(target_body, time, 'IAU_MARS', 'NONE', observer_body)

    # Vector from observer to target
    vector = target_state[:3] - observer_pos

    # Convert to azimuth/elevation
    azimuth, elevation, range = spice.recazl(vector)

    return {
        'azimuth': np.degrees(azimuth),
        'elevation': np.degrees(elevation),
        'range': range
    }
```

**Shadow Calculation**:
```javascript
async function computeShadowMap(observer, sourceBody, time, demTiles) {
  // Get source position from SPICE
  const sourcePos = await fetch('/api/spice/ll2aerll', {
    method: 'POST',
    body: JSON.stringify({
      observer: observer,
      target: sourceBody,
      time: time,
      lat: observer.lat,
      lon: observer.lon,
      height: observer.height
    })
  }).then(r => r.json());

  const sourceAzimuth = sourcePos.azimuth;
  const sourceElevation = sourcePos.elevation;

  // For each tile pixel
  const shadowMap = [];
  for (const tile of demTiles) {
    for (let i = 0; i < tile.width; i++) {
      for (let j = 0; j < tile.height; j++) {
        const pixel = tile.getPixel(i, j);

        // Ray-trace from pixel to source
        const shadowed = raytrace(pixel, sourceAzimuth, sourceElevation, demTiles);

        shadowMap.push({
          lat: pixel.lat,
          lon: pixel.lon,
          visible: !shadowed,
          color: shadowed ? 'red' : 'green'
        });
      }
    }
  }

  return shadowMap;
}

function raytrace(pixel, azimuth, elevation, demTiles) {
  // Cast ray from pixel towards source
  const direction = {
    x: Math.cos(elevation) * Math.sin(azimuth),
    y: Math.cos(elevation) * Math.cos(azimuth),
    z: Math.sin(elevation)
  };

  let current = pixel;
  const stepSize = 1; // meter

  while (current.elevation < 10000) { // Max height
    current.x += direction.x * stepSize;
    current.y += direction.y * stepSize;
    current.z += direction.z * stepSize;

    // Get terrain height at current position
    const terrainHeight = sampleDEM(current.x, current.y, demTiles);

    // Check if ray is below terrain
    if (current.z < terrainHeight) {
      return true; // Shadowed
    }
  }

  return false; // Visible
}
```

---

### 12. Sites Tool

**Location**: `src/essence/Tools/Sites/SitesTool.js`

**Configuration**:
```javascript
{
  "sites": [
    {
      "name": "Landing Site",
      "code": "LS",
      "lat": 18.445,
      "lng": 77.451,
      "zoom": 14
    },
    {
      "name": "Sample Cache",
      "code": "SC",
      "lat": 18.450,
      "lng": 77.455,
      "zoom": 16
    }
  ]
}
```

**Implementation**:
```javascript
function createSiteButtons(sites) {
  const buttonBar = $('<div class="site-buttons"></div>');

  sites.forEach(site => {
    const button = $(`
      <button class="site-button" data-code="${site.code}">
        ${site.name}
      </button>
    `);

    button.on('click', () => navigateToSite(site));

    buttonBar.append(button);
  });

  $('#sitesToolContent').append(buttonBar);
}

function navigateToSite(site) {
  // Pan/zoom to site
  Map_.setView([site.lat, site.lng], site.zoom);

  // Toggle header layers by site code
  if (site.code) {
    L_.getAllLayers().forEach(layer => {
      if (layer.type === 'header' && layer.code === site.code) {
        L_.toggleLayer(layer.uuid, true);
      }
    });
  }

  // Highlight active button
  $('.site-button').removeClass('active');
  $(`.site-button[data-code="${site.code}"]`).addClass('active');
}
```

---

### 13. Viewshed Tool

**Location**: `src/essence/Tools/Viewshed/ViewshedTool.js`

**Key Files**:
- `ViewshedTool.js` - Main controller
- `ViewshedTool_Manager.js` - Manages multiple viewshed instances
- `ViewshedTool_Algorithm.js` - Visibility computation

**Algorithm** (Ray-Tracing):
```javascript
function computeViewshed(observer, cameraParams, demTiles) {
  const viewshed = [];

  const {
    height,
    azimuthCenter,
    azimuthFOV,
    elevationCenter,
    elevationFOV,
    maxRange
  } = cameraParams;

  // Observer position
  const observerElev = observer.elevation + height;

  // For each cell in FOV
  for (let az = azimuthCenter - azimuthFOV/2; az <= azimuthCenter + azimuthFOV/2; az += 1) {
    for (let el = elevationCenter - elevationFOV/2; el <= elevationCenter + elevationFOV/2; el += 1) {
      // Cast ray
      const cells = castRay(observer, observerElev, az, el, maxRange, demTiles);

      cells.forEach(cell => {
        if (!viewshed.find(v => v.lat === cell.lat && v.lon === cell.lon)) {
          viewshed.push({
            lat: cell.lat,
            lon: cell.lon,
            visible: cell.visible,
            color: cell.visible ? 'green' : 'red'
          });
        }
      });
    }
  }

  return viewshed;
}

function castRay(observer, observerElev, azimuth, elevation, maxRange, demTiles) {
  const cells = [];
  const stepSize = 1; // meter

  let distance = 0;
  let visible = true;

  while (distance < maxRange) {
    distance += stepSize;

    // Calculate position along ray
    const lat = observer.lat + (distance * Math.cos(azimuth) / 111320);
    const lon = observer.lon + (distance * Math.sin(azimuth) / (111320 * Math.cos(observer.lat)));

    // Expected elevation along line-of-sight
    const losElev = observerElev + distance * Math.tan(elevation);

    // Actual terrain elevation
    const terrainElev = sampleDEM(lat, lon, demTiles);

    // Check visibility
    if (terrainElev > losElev) {
      visible = false;
    }

    cells.push({
      lat: lat,
      lon: lon,
      elevation: terrainElev,
      visible: visible
    });
  }

  return cells;
}
```

**Camera Presets**:
```javascript
{
  "cameraPresets": [
    {
      "name": "Mastcam",
      "height": 2.0,
      "azimuthCenter": 0,
      "azimuthFOV": 90,
      "elevationCenter": 0,
      "elevationFOV": 60
    },
    {
      "name": "Navcam",
      "height": 1.5,
      "azimuthCenter": 0,
      "azimuthFOV": 120,
      "elevationCenter": -10,
      "elevationFOV": 45
    }
  ]
}
```

**Planetary Curvature**:
```javascript
function applyPlanetaryCurvature(distance, planetRadius) {
  // Correction for viewing over planetary surface
  // Height of horizon at distance d from observer
  return Math.sqrt(2 * planetRadius * distance + distance * distance);
}
```

---

## Integration Points

### Map_ Integration

**Location**: `src/essence/Basics/Map_/Map_.js`

Tools interact with Map_ to:
- Add/remove Leaflet layers
- Register event handlers (click, mousemove, etc.)
- Pan/zoom programmatically
- Access map bounds and projection

**Example**:
```javascript
// Tool adds layer to map
Map_.addLayer(myLayer);

// Tool registers click handler
Map_.on('click', (e) => {
  tool.handleMapClick(e.latlng);
});

// Tool pans/zooms
Map_.setView([lat, lng], zoom);

// Tool queries map state
const bounds = Map_.getBounds();
const zoom = Map_.getZoom();
```

### Globe_ Integration

**Location**: `src/essence/Basics/Globe_/Globe_.js`

3D-enabled tools integrate with Cesium Globe:
- Add 3D features (models, clamped vectors)
- Register globe events
- Control camera
- Terrain interaction

**Example**:
```javascript
// Draw Tool adds clamped features
Globe_.litho.addLayer('clamped', {
  name: 'drawTool_layer',
  geojson: features,
  opacity: 1
});

// Measure Tool queries terrain height
const height = Globe_.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lng, lat));

// Viewshed Tool controls camera
Globe_.scene.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1000),
  orientation: {
    heading: azimuth,
    pitch: elevation,
    roll: 0
  }
});
```

### Layers_ Integration

**Location**: `src/essence/Basics/Layers_/Layers_.js`

All tools respect layer system:
- Check layer visibility
- React to layer toggle events
- Filter behavior by active layers

**Example**:
```javascript
// Identifier Tool checks which layers are active
const activeLayers = L_.getActiveLayers();
activeLayers.forEach(layer => {
  if (layer.identifier) {
    queryRasterValue(lat, lng, layer.identifier);
  }
});

// Measure Tool gets DEM from layer config
const dem = L_.getLayerDEM(layerUuid);

// Layers Tool toggles layers
L_.toggleLayer(layerUuid, true); // Turn on
L_.setLayerOpacity(layerUuid, 0.5);
```

### Backend API Integration

**GDAL Services** (`/api/gdal/raster`):
- DEM querying for elevation (Measure, Identifier, Viewshed, Shade, Isochrone)
- Raster pixel value extraction (Identifier)
- Tile serving

**File Management** (`/api/files`):
- Draw Tool CRUD operations
- File sharing and permissions
- History tracking

**SPICE Services** (`/api/spice/`):
- Spacecraft position calculation (Shade)
- Time conversion (Shade)

---

## Performance Optimizations

### Tile-Based Processing

Tools processing large spatial datasets (Viewshed, Shade, Isochrone) use tiled approaches:
- Limit memory consumption
- Enable progressive rendering
- Support multiple zoom levels

**Implementation**:
```javascript
function loadTilesForViewport(bounds, zoom) {
  const tiles = getTileCoordinates(bounds, zoom);

  return Promise.all(
    tiles.map(({z, x, y}) => {
      const url = `${demUrl}/${z}/${x}/${y}.1bto4b`;
      return fetch(url).then(r => r.arrayBuffer()).then(parse1bto4b);
    })
  );
}
```

### Client-Side Computation

Where possible, tools perform client-side computation:
- Reduce server load
- Provide immediate feedback
- Work offline (partially)

**Examples**:
- Vector styling (Draw Tool)
- Feature filtering (Layers Tool)
- Distance calculation (Measure Tool)
- Viewshed ray-tracing (Viewshed Tool)

### Lazy Loading

Tools are loaded on-demand:
- Reduce initial bundle size
- Improve page load time
- Load only needed dependencies

**Webpack Dynamic Imports**:
```javascript
// Tool only loaded when activated
const DrawTool = await import('./Tools/Draw/DrawTool.js');
```

---

## Testing Strategy

### Unit Tests

**Draw Tool** (`DrawTool.test.js`):
```javascript
describe('Draw Tool', () => {
  test('Initialize tool', () => {
    const tool = DrawTool.make();
    expect(tool).toBeDefined();
  });

  test('Create file', async () => {
    const file = await DrawTool.createFile('Test File', 'roi');
    expect(file.id).toBeDefined();
  });

  test('Clip features', async () => {
    const clipped = await DrawTool.clipFeatures(newGeom, existingGeoms, 'over');
    expect(clipped.geometry).toBeDefined();
  });
});
```

### Integration Tests

Tools should be tested for:
- ToolController integration (lifecycle)
- Map/Globe integration (rendering)
- Backend API integration (data operations)
- URL state persistence (bookmarking)

---

## Deployment Considerations

### Build Configuration

**Webpack** (`webpack.config.js`):
```javascript
module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'MMGIS.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  }
};
```

### Environment Variables

Tools may require environment-specific configuration:
- API endpoints
- SPICE kernel paths
- DEM tileset URLs
- Authentication settings

**Example** (`.env`):
```
GDAL_API_URL=http://localhost:8888/api/gdal
SPICE_API_URL=http://localhost:8888/api/spice
DEM_BASE_URL=https://tiles.example.com/dems
```

---

## Future Enhancements

### Planned Features

1. **Tool Presets** - Save and restore tool configurations
2. **Tool Workflows** - Chain multiple tools in sequence
3. **Tool Export** - Export tool outputs to standard formats
4. **Tool Collaboration** - Real-time collaborative tool usage
5. **Tool Analytics** - Track tool usage and performance
6. **Unified Tool State Manager** - Centralized tool state management

### API Improvements

1. **Unified Tool API** - Standardize additional lifecycle hooks (onResize, onLayerChange, etc.)
2. **Tool Communication** - Enable inter-tool messaging
3. **Tool Dependencies** - Declare and resolve tool dependencies

---

## Revision History

**Version**: 2.0
**Date**: 2025-12-22
**Status**: Active

**Changes**:
- Expanded to document all 15 user-facing tools individually
- Merged comprehensive Draw Tool content from spec 003
- Added brief architectural note about Kinds system
- Comprehensive implementation details for each tool
- Architecture notes (React vs jQuery, libraries used, file structure)
- Test coverage notes where applicable
