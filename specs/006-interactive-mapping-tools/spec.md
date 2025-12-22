# Interactive Mapping Tools - Comprehensive Technical Specification

## Overview

The MMGIS Interactive Mapping Tools system is a comprehensive plugin-based architecture providing users with 15 specialized geospatial analysis, measurement, drawing, and visualization tools. Each tool follows a unified lifecycle interface, enabling consistent integration, configuration, and user experience across diverse mapping functionalities for planetary science missions.

This specification documents all user-facing interactive tools (15 total), excluding deprecated tools in the `_OLD` directory and plugin-specific tools not in the public repository.

## System Architecture

### Tool Plugin Architecture

Each tool in the system follows a standardized plugin pattern that enables:
- Dynamic tool loading and registration
- Consistent lifecycle management (make/destroy)
- Configuration-driven behavior
- Independent or toolbar-integrated presentation
- State management and URL persistence

#### Core Tool Interface

All tools implement the following interface contract:

```javascript
{
    height: Number,           // Panel height in pixels (0 for variable)
    width: Number,            // Panel width in pixels
    MMGISInterface: Object,   // Interface with MMGIS core
    make: function(),         // Initialize and render tool
    destroy: function(),      // Clean up and remove tool
    getUrlString: function()  // Serialize tool state to URL
}
```

####

 ToolController Integration

The `ToolController_` (`src/essence/Basics/ToolController_/ToolController_.js`) manages all tool plugins through:

1. **Tool Registration**: Tools are loaded from `toolModules` and `toolConfigs` exported from the build system
2. **Lifecycle Management**: Handles `make()` and `destroy()` calls based on user interaction
3. **UI Positioning**: Supports two presentation modes:
   - **Toolbar Tools**: Integrated into left-hand expandable toolbar
   - **Separated Tools**: Floating icons with independent panels (left/center/right justification)
4. **State Coordination**: Ensures only one toolbar tool active at a time; separated tools can coexist

### Configuration System

Each tool provides a configuration definition in `configure/public/toolConfigs.json` that includes:
- **Metadata**: name, description, icon, toolbar priority
- **Variables**: Runtime configuration options
- **UI Config**: Form fields for administrative configuration interface
- **Expandable**: Whether tool supports panel expansion/collapse
- **Separated Tool**: Whether tool lives outside main toolbar

### Kinds System (Configuration Plugin)

**Note**: The Kinds system (`src/essence/Tools/Kinds/Kinds.js`) is a configuration plugin that defines layer interaction behaviors, not a user-facing tool. It specifies how layers respond to click events:
- **`info`** kind: Opens Info Tool with feature properties
- **`waypoint`** kind: Shows rover/vehicle overlays with rotation
- **`chemistry_tool`** kind: Activates Chemistry Tool for clicked feature
- **`draw_tool`** kind: Enables Draw Tool editing for clicked feature

The Kinds system is extensible for custom layer interaction patterns but is not directly exposed to end users.

---

## Tool 1: Animation Tool

**Location**: `src/essence/Tools/Animation/AnimationTool.js`
**Purpose**: Create animated map sequences with custom time ranges and export options
**Toolbar Priority**: 1002
**Expandable**: Yes

### Key Features

- **4-Step Wizard Interface**: Guides users through animation creation
  1. Select bounding box area for animation
  2. Define time range and interval
  3. Configure playback options (FPS, looping)
  4. Export as GIF, MP4, or PNG sequence
- **Multiple Export Formats**:
  - **GIF**: Animated GIF using `gifshot` library
  - **MP4**: H.264 video using FFmpeg (via `@ffmpeg/ffmpeg`)
  - **PNG Sequence**: Individual frame export as ZIP
- **Time-Enabled Layer Support**: Automatically updates layers with time configuration
- **Custom Frame Rates**: 1-60 FPS playback
- **Progress Tracking**: Real-time rendering progress bar

### Architecture

**Technology Stack**:
- **HTML2Canvas**: Captures map canvas for each frame
- **gifshot**: Client-side GIF encoding
- **@ffmpeg/ffmpeg**: WebAssembly-based video encoding
- **JSZip**: PNG sequence packaging

**Workflow**:
1. User draws bounding box on map
2. Tool hides UI elements and zooms to bbox
3. For each time step:
   - Update TimeControl to target time
   - Wait for layer rendering
   - Capture canvas with HTML2Canvas
   - Store frame in memory
4. Encode frames to selected format
5. Trigger browser download

### Configuration Options

**Variables** (from toolConfigs.json):
- None - tool is self-contained with UI-driven configuration

**Runtime Configuration** (UI-driven):
- **Bounding Box**: Interactive map selection
- **Start Time**: Date/time picker or Sol number
- **End Time**: Date/time picker or Sol number
- **Time Interval**: Step size (seconds, minutes, hours, days)
- **Frame Rate**: 1-60 FPS
- **Loop**: Enable/disable looping
- **Export Format**: GIF, MP4, or PNG sequence

### Integration Points

- **TimeControl**: Drives time-enabled layer updates
- **Map_**: Canvas capture source
- **Layers_**: Ensures proper layer visibility during capture
- **ToolController_**: Manages tool visibility during rendering

### Performance Considerations

- Large animations (100+ frames) consume significant memory
- MP4 encoding is CPU-intensive (uses Web Workers)
- GIF encoding limited to 256 colors
- Recommended max: 1920x1080 resolution, 10 second duration

---

## Tool 2: Chemistry Tool

**Location**: `src/essence/Tools/Chemistry/ChemistryTool.js`
**Purpose**: Display chemical composition charts from clicked point features
**Toolbar Priority**: (default)
**Expandable**: No

### Key Features

- **Chemical Composition Charts**: D3-based bar/pie charts showing element percentages
- **Single & Multi-Mode Selection**: Click single point or select multiple for comparison
- **Custom Chart Library**: Uses `chemistrychart.js` and `chemistryplot.js` for specialized visualization
- **Dataset Integration**: Reads chemistry data from feature properties or linked datasets

### Architecture

**Chart Types**:
- **Bar Chart**: Element percentages as vertical bars
- **Pie Chart**: Proportional element distribution
- **Scatter Plot**: Multi-point comparison (multi-mode)

**Data Sources**:
- Feature properties with chemistry keys (e.g., `SiO2`, `Fe2O3`, `Al2O3`)
- Linked CSV datasets via `properties.datasets`
- Remote chemistry data endpoints

### Configuration Options

**Variables** (from toolConfigs.json):
- None - chemistry data driven by layer configuration and feature properties

**Expected Feature Properties**:
```javascript
{
  "name": "Sample Site A",
  "SiO2": 45.2,
  "Fe2O3": 15.8,
  "Al2O3": 10.3,
  "MgO": 8.5,
  // ... additional oxide percentages
}
```

### Integration Points

- **Map_**: Receives feature click events
- **Layers_**: Identifies chemistry-enabled layers via `kind: "chemistry_tool"`
- **Info Tool**: Can display chemistry charts inline with feature properties

### Use Cases

- Planetary geology: Analyze rock/soil composition from rover instruments
- Mineralogy: Compare chemistry across multiple sample sites
- Temporal analysis: Track chemistry changes in time-enabled datasets

---

## Tool 3: Curtain Tool

**Location**: `src/essence/Tools/Curtain/CurtainTool.js`
**Purpose**: Visualize Ground Penetrating Radar (GPR) subsurface data as vertical curtains
**Toolbar Priority**: (default)
**Expandable**: No

### Key Features

- **Vertical Imagery Curtains**: Display GPR radargrams aligned under terrain surface
- **3D Subsurface Visualization**: Render radar data in Globe view beneath rover paths
- **Sol/RMC Metadata Display**: Show mission Sol number and Rover Motion Counter
- **Vertical Exaggeration Controls**: Adjust depth scale for emphasis
- **Offset Controls**: Fine-tune curtain positioning relative to surface
- **"Keep On in 3D" Toggle**: Persist curtain visibility when switching to Globe view

### Architecture

**Technology Stack**:
- **OpenSeadragon**: High-resolution imagery viewing (for 2D curtain inspection)
- **Cesium**: 3D curtain rendering beneath terrain
- **Custom Shaders**: Position radar imagery vertically in 3D space

**Data Format**:
- **Input**: Georeferenced radar imagery with depth metadata
- **Positioning**: Lat/lon path with depth extent
- **Metadata**: Sol number, RMC range, acquisition parameters

### Configuration Options

**Variables** (from toolConfigs.json):
- **`withCredentials`** (boolean): Enable CORS credentials for remote imagery, default false

**Layer Configuration**:
Curtain data typically configured as vector layer with custom `kind`:
```json
{
  "name": "GPR Data Sol 015",
  "type": "vector",
  "url": "geodatasets:gpr_sol015",
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

### Integration Points

- **Map_**: Display curtain path as polyline
- **Globe_**: Render 3D curtain geometry
- **Viewer_**: High-resolution radargram inspection in Viewer panel
- **Layers_**: Manage curtain visibility per-layer

### Use Cases

- Rover GPR data analysis: Visualize subsurface stratigraphy
- Ice detection: Identify subsurface ice layers in polar regions
- Hazard assessment: Detect buried rocks or voids along traverse

---

## Tool 4: Draw Tool

**Location**: `src/essence/Tools/Draw/DrawTool.js`
**Purpose**: Advanced collaborative vector drawing and annotation with comprehensive file management
**Toolbar Priority**: 1001
**Expandable**: Yes
**Test Coverage**: `DrawTool.test.js`

### Overview

The Draw Tool is MMGIS's most complex tool, providing a comprehensive geospatial vector data creation, editing, and sharing platform. It enables mission teams to collaboratively create, annotate, and manage geographic features with real-time history tracking, advanced geometric operations, and flexible sharing controls.

### Core Capabilities

The drawing system supports seven primary vector geometry types:

1. **Polygon Drawing** - Multi-vertex polygon creation with clip-over/clip-under operations
2. **Circle Drawing** - Radius-based circles with optional forced dimensions
3. **Rectangle Drawing** - Axis-aligned bounding boxes
4. **Line Drawing** - Multi-segment polylines with optional snapping
5. **Point Drawing** - Georeferenced point features with customizable symbols
6. **Text Annotations** - Positioned text labels with rich styling options
7. **Arrow Annotations** - Directional indicators with customizable arrowhead geometry

### File Organization & Intents

The system organizes drawings into typed files called **"intents"** which categorize features by operational purpose:

- **ROI (Region of Interest)** - L1 Polygons for primary areas of scientific interest
- **Campaign** - L2 Polygons for mission campaign boundaries
- **Campsite** - L3 Polygons for operational staging areas
- **Trail** - Polyline features representing traverse paths
- **Signpost** - Point features for waypoints and markers
- **Note** - Standalone text annotations
- **All (Map)** - Generic geospatial features (polygons, lines, points)
- **Master Files** - Lead-controlled shared files per intent type

### Collaboration & Sharing

#### File Ownership Modes
- **Private (default)** - Only the creator can view and edit
- **Public Read-Only** - Anyone can view, only owner can edit
- **Public List-Edit** - Owner designates specific users who can edit
- **Public All-Edit** - Anyone authenticated can edit
- **Group Ownership** - Files owned by user groups rather than individuals
- **Master Files** - System-managed shared files owned by the lead group

#### Real-Time Collaboration
- Multiple users can view and edit the same file simultaneously
- File history tracks all edits with author attribution
- Changes propagate to all users viewing the file via WebSocket events
- Optimistic UI updates with server reconciliation

### Feature Organization & Filtering

#### File Grouping
- **By Folder** - User-defined folders with elevated folder support for leads (syntax: `~@folder_name` in description)
- **By Tag** - Hashtag-based categorization (syntax: `#tagname` in description)
- **By Author** - Grouped by file creator
- **Alphabetical** - A-Z sorted file names
- **Ungrouped** - Flat file list

#### Advanced Filtering
- Text search across file names, authors, and descriptions
- Tag-based search using `#tagname` syntax
- Intent-based filtering (show only ROIs, campaigns, etc.)
- Visibility filters (on/off, public/private, owned)
- Multi-criteria advanced filter builder with AND/OR grouping

### Geometric Operations

The backend provides advanced PostGIS-powered spatial operations:

#### Clipping Operations
- **Clip Over** - New geometry clips/removes overlapping portions of existing features
- **Clip Under** - New geometry is clipped to avoid overlapping existing features
- Both operations utilize recursive PostGIS `ST_DIFFERENCE` with buffering for precision

#### Merge Operation
- Combines multiple selected features into a single unified geometry
- `ST_UNION` for polygons with mitered buffering to prevent gaps
- `ST_LineMerge` for connected line segments
- Properties inherited from designated "prop_id" feature

#### Split Operation
- Divides features using a user-drawn line
- `ST_SPLIT` operation against all selected feature geometries
- Creates multiple new features from split results
- Preserves original feature properties on all split children

### History & Undo System

The feature implements a comprehensive temporal database architecture:

#### History Tracking
- Every add, edit, delete, merge, split, and clip operation recorded
- History entries stored with:
  - Unique `history_id` per file
  - Millisecond timestamp
  - Action index (0=add, 1=edit, 2=delete, 3=undo, 5=clip-over, 6=merge, 7=clip-under, 8=split)
  - Array of feature IDs active at that point in time
  - Author username

#### Time Travel
- Users can scrub through file history to any past timestamp
- Map visualization updates to show features as they existed at selected time
- "Undo to Time" operation reverts all changes after selected timestamp
- History UI displays chronological action list with author attribution

#### Feature Trimming
Rather than deleting features, the system implements soft-delete with temporal validity:
- `extant_start` - Timestamp when feature was created
- `extant_end` - Timestamp when feature was removed (NULL if still active)
- `trimmed_start[]` - Array of undo timestamps affecting this feature
- `trimmed_at[]` - Array of timestamps when trims were applied
- `trimmed_at_final` - Most recent trim operation timestamp

### Template System

The system supports JSON-based feature templates that enforce metadata schemas:

#### Template Features
- **Field Types**: text, number, date, incrementer, dropdown, checkbox, textarea
- **Auto-Incrementing Fields** - Sequentially numbered features (e.g., SOL001, SOL002)
- **Collision Detection** - Prevents duplicate incrementer values
- **Template Enforcement** - Backend validates and auto-populates template fields
- **Reusable Templates** - Saved templates shared across files
- **Template Designer UI** - Visual template builder in file settings modal

#### Incrementer Logic
- Syntax: `prefix#suffix` (e.g., `SOL#` becomes `SOL001`)
- Scans all features in file to find used values
- Auto-assigns next available number
- Collision detection during edits prevents duplicates
- Manual value changes validated against existing features

### Drawing Tools & Interaction

#### Drawing Settings
- **Draw Clipping** - Over/Under/Off modes for new geometry clipping
- **Draw Resolution** - Auto-vertex insertion at specified pixel intervals
- **Edit Snapping** - Snap vertices to nearby features during editing
- **Circle Radius** - Force circles to specific meter radius

#### Editing Modes
- **Vertex Editing** - Drag vertices to reshape geometries
- **Style Editing** - Color picker, opacity sliders, stroke width, fill patterns
- **Property Editing** - Key-value metadata editor with template validation
- **Bulk Operations** - Multi-select for merge, split, delete, copy operations

#### Geologic Symbology Plugin
Specialized plugin for geologic mapping:
- Pattern fills (dots, lines, hashes) for geologic units
- FGDC-compliant line symbology (contacts, faults, boundaries)
- Color-coded stratigraphic units
- SVG-based pattern rendering

### Import/Export

#### Export Formats
- **GeoJSON** - Native format with MMGIS metadata preservation
- **KML** - Google Earth compatible with timestamp support
- **SHP (Shapefile)** - ESRI format with .prj projection files

#### Export Options
- Source coordinate system or converted to primary CRS
- Force template schema on export (strip non-template fields)
- Include/exclude metadata tables
- Batch export for multiple files

#### Import
- GeoJSON file upload into new or existing files
- Automatic intent detection based on geometry types
- Property preservation and UUID assignment
- Bulk upload with drag-and-drop support

### Master File System & Review

Master files implement a lead-controlled review process:

#### Master File Characteristics
- One master file per intent type (ROI, Campaign, Campsite, Trail, Signpost)
- Owned by `mmgis-group` with elevated permissions
- Always public and visible in "Lead Maps" section
- Read-only for non-lead users
- Review workflow for lead approval of user submissions

#### Review Process
1. Users create features in personal files
2. Lead users open Review modal from Master Files section
3. Review UI displays all pending files for that intent
4. Lead can preview features on map
5. Lead approves (copy to master) or rejects submissions
6. Approved features copied with metadata preservation

### Database Schema

#### User Files Table
```sql
user_files {
  id: SERIAL PRIMARY KEY
  file_owner: VARCHAR(50) NOT NULL
  file_owner_group: STRING[] -- Group ownership
  file_name: VARCHAR(355) NOT NULL
  file_description: VARCHAR(10000) -- Supports tags/folders via ~# ~@ ~^ syntax
  is_master: BOOLEAN DEFAULT false
  intent: ENUM('roi','campaign','campsite','trail','signpost','all')
  public: ENUM('0','1') DEFAULT '0'
  hidden: ENUM('0','1') DEFAULT '0'
  template: JSON -- Feature template schema
  publicity_type: VARCHAR(255) -- 'read_only'|'list_edit'|'all_edit'
  public_editors: TEXT[] -- Usernames with edit access
  created_on: TIMESTAMP NOT NULL
  updated_on: TIMESTAMP NOT NULL
}
```

#### User Features Table
```sql
user_features {
  id: SERIAL PRIMARY KEY
  file_id: INTEGER REFERENCES user_files(id)
  level: INTEGER -- Z-order for rendering
  intent: ENUM('roi','campaign','campsite','trail','signpost','polygon','line','point','text','arrow')
  properties: JSON -- Feature metadata including 'uuid', 'style', custom fields
  geom: GEOMETRY(GEOMETRY,4326) -- PostGIS spatial column
  extant_start: BIGINT -- Creation timestamp
  extant_end: BIGINT -- Deletion timestamp, NULL if active
  trimmed_start: BIGINT[] -- Array of undo timestamps
  trimmed_at: STRING[] -- Array of trim application timestamps
  trimmed_at_final: BIGINT -- Most recent trim timestamp
}
```

#### File Histories Table
```sql
file_histories {
  id: SERIAL PRIMARY KEY
  file_id: INTEGER REFERENCES user_files(id)
  history_id: INTEGER -- Sequential per file
  time: BIGINT -- Epoch milliseconds
  action_index: INTEGER -- 0=add, 1=edit, 2=delete, 3=undo, 5=clip-over, 6=merge, 7=clip-under, 8=split
  history: INT[] -- Array of feature IDs active at this point
  author: VARCHAR(255) -- Username who performed action
}
```

### Properties Schema

Every feature stores a standardized properties object:

```javascript
{
  uuid: "generated-uuid-v4",  // Unique identifier
  _: {                        // MMGIS metadata
    id: 123,                  // Feature database ID
    file_id: 45,              // Parent file ID
    intent: "roi"             // Feature intent
  },
  style: {                    // Rendering style
    color: "rgb(255,255,255)",
    fillColor: "rgb(0,0,0)",
    opacity: 1,
    fillOpacity: 0.4,
    weight: 2,
    radius: 4,               // For points/circles
    geologic: {              // Optional geologic symbology
      type: "pattern",
      tag: "601",
      color: "K",
      size: 1,
      fillColor: "#fff",
      fillOpacity: 1
    }
  },
  name: "User-defined name",
  description: "User notes",
  // ...additional template or custom fields
}
```

### API Endpoints

#### Drawing Operations (`/api/draw`)

- **POST /add** - Create a new feature in a file
  - Body: `{ file_id, geometry, properties, intent, clip: 'over'|'under'|null }`
  - Returns: `{ status, message, body: { id, intent } }`

- **POST /edit** - Modify an existing feature
  - Body: `{ file_id, feature_id, geometry, properties, intent }`
  - Returns: `{ status, message, body: { id, uuid, intent } }`

- **POST /remove** - Soft-delete a feature
  - Body: `{ file_id, id }`
  - Returns: `{ status, message }`

- **POST /undo** - Revert file to a past timestamp
  - Body: `{ file_id, undo_time }`
  - Returns: `{ status, message }`

- **POST /merge** - Combine multiple features
  - Body: `{ file_id, prop_id, ids: [id1, id2, ...] }`
  - Returns: `{ status, message, body: { ids: [new_ids] } }`

- **POST /split** - Divide features with a line
  - Body: `{ file_id, split: line_geojson, ids: [id1, id2, ...] }`
  - Returns: `{ status, message, body: { ids: [new_ids] } }`

#### File Management (`/api/files`)

- **POST /get** - Retrieve user's files list
- **POST /getfile** - Retrieve specific file with features
- **POST /make** - Create a new file
- **POST /change** - Update file metadata
- **POST /remove** - Delete a file and all its features
- **POST /gethistory** - Retrieve file's edit history
- **POST /modifykeyword** - Rename or remove folder/tag

#### Publishing (`/api/publish`)

- **POST /on** - Publish selected features to "Latest Map"
- **POST /off** - Unpublish features from "Latest Map"

### Architecture

**Component Structure**:
```
DrawTool.js               // Main tool controller
├── DrawTool_Drawing.js   // Drawing mode UI and Leaflet.draw integration
├── DrawTool_Editing.js   // Feature editing and property modification
├── DrawTool_Files.js     // File list, filtering, and file operations
├── DrawTool_History.js   // History timeline and undo interface
├── DrawTool_Shapes.js    // Feature list, selection, and shape management
├── DrawTool_Publish.js   // Publishing and master file review
├── DrawTool_FileModal.js // File creation/upload modal
└── DrawTool_Templater.js // Template designer and enforcement
```

**Leaflet Integration**:
- `L.Draw.Polygon` - Extended for clip-over/under support
- `L.Draw.Circle` - Modified for forced radius mode
- `L.Draw.Rectangle` - Standard Leaflet.draw implementation
- `L.Draw.Polyline` - Extended with auto-vertex resolution
- `L.Draw.Marker` - Symbol-based point placement
- `L.Edit.Poly` - Vertex editing with optional snapping

**Cesium Integration**:
```javascript
Globe_.litho.addLayer('clamped', {
  name: 'camptool_DrawTool_' + fileId,
  on: true,
  geojson: normalizedFeatures,
  opacity: 1,
  style: { letPropertiesStyleOverride: true }
})
```

### Configuration Options

**Variables** (from toolConfigs.json):
- **`intents`** (object): Custom intent type names/aliases
- **`leadsCanEditFileInfo`** (boolean): Allow leads to edit any file metadata
- **`masterFileIds`** (array): IDs of master files per intent
- **`templates`** (object): Pre-defined property templates

### Integration Points

- **Map_**: Drawing canvas, feature rendering
- **Globe_**: 3D feature visualization
- **Layers_**: Published features as vector layers
- **Authentication**: User ownership and permissions
- **WebSocket**: Real-time file synchronization
- **Configure API**: File and feature CRUD operations

### Performance Considerations

- Files with 1000+ features may experience rendering lag
- History table grows unbounded (no archival strategy)
- Geometric operations (merge, split, clip) are computationally expensive
- Real-time sync triggers full file refetch (not operational transforms)

### Known Limitations

1. **Real-Time Sync** - WebSocket events trigger refetch, not operational transforms
2. **Conflict Resolution** - Last-write-wins, no CRDT-style merging
3. **Large File Performance** - No pagination for files with 1000+ features
4. **Undo Granularity** - Undo reverts entire file to timestamp, not single operation

---

## Tool 5: Identifier Tool

**Location**: `src/essence/Tools/Identifier/IdentifierTool.js`
**Purpose**: Real-time pixel value querying from raster datasets via mouse-over
**Toolbar Priority**: 1
**Separated Tool**: Yes (persistent floating panel)

### Key Features

- **Real-Time Pixel Queries**: Display raster pixel values on mouse-over
- **Multi-Band Raster Support**: Query and display all bands from GeoTIFF
- **Configurable Significant Figures**: Control decimal precision per layer
- **Unit Display & Scale Factors**: Convert raw values to meaningful units
- **Time-Enabled Datasets**: URL template substitution for time-varying rasters
- **Legend-Based Color Matching**: Match pixel colors to legend for non-queryable layers
- **Layer-Specific Configuration**: Per-layer UUID mapping for query parameters

### Architecture

**Technology Stack**:
- **Backend GDAL**: Raster pixel extraction via `/api/gdal/raster` endpoint
- **Frontend Debouncing**: Throttle mousemove events to reduce query load
- **Cache Layer**: Cache recent queries for performance

**Query Workflow**:
1. User hovers over map location
2. Tool identifies active raster layers with Identifier configuration
3. Constructs GDAL query with lat/lon and layer URL
4. Backend extracts pixel values for all bands
5. Frontend formats and displays values with units

### Configuration Options

**Variables** (from toolConfigs.json):
Per-layer configuration object mapping layer UUIDs to query parameters:

```javascript
{
  "layer-uuid-1": {
    "url": "path/to/raster.tif",     // GeoTIFF file path
    "bands": 3,                       // Number of bands
    "sigfigs": 2,                     // Decimal places
    "unit": "meters",                 // Unit label
    "scalefactor": 1.0,               // Value multiplier
    "timeFormat": "%Y-%m-%dT%H:%M:%SZ" // Time URL format
  }
}
```

**Layer Configuration Fields**:
- **`url`** (string): Path to GeoTIFF raster file
- **`bands`** (number): Number of bands to query (1-N)
- **`sigfigs`** (number): Significant figures for display, default 2
- **`unit`** (string): Unit label (e.g., "meters", "°C", "mGal")
- **`scalefactor`** (number): Multiply raw pixel value by this factor
- **`timeFormat`** (string): strftime format string for time-enabled layers

### Integration Points

- **Map_**: Mousemove event listener
- **Layers_**: Identify active raster layers
- **GDAL Backend**: Pixel value extraction
- **TimeControl**: Time-enabled URL substitution

### Use Cases

- DEM elevation queries: Display terrain elevation under cursor
- Temperature mapping: Show surface temperature from thermal imagery
- Spectral analysis: Query multi-band spectral reflectance data
- Gravity/magnetic: Display geophysical measurements

### Performance Considerations

- Queries debounced to 100ms to reduce server load
- Large rasters (>10GB) may have slow query response
- Cache layer stores last 50 queries for instant re-display

---

## Tool 6: Info Tool

**Location**: `src/essence/Tools/Info/InfoTool.js`
**Purpose**: Display GeoJSON properties of clicked features
**Toolbar Priority**: 3
**Expandable**: Yes

### Key Features

- **JSON Property Display**: Show all feature properties in formatted JSON
- **Feature Filtering**: Text search to filter displayed properties
- **Hide/Show Feature Visibility**: Toggle feature rendering on map
- **Copy to Clipboard**: Export feature as GeoJSON
- **Locate Feature**: Pan/zoom map to feature extent
- **Navigate Overlapping Features**: Dropdown for multi-feature selection at click point
- **Hidden Properties Toggle**: Show/hide properties starting with `_`
- **Alphabetical Sorting**: Option to sort properties A-Z

### Architecture

**Event Flow**:
1. User clicks feature on map
2. Map_ emits feature click event
3. Info Tool receives feature data
4. Tool formats properties as JSON with syntax highlighting
5. Displays in expandable panel

**Multi-Feature Handling**:
- When multiple features at click point, dropdown shows all features
- User selects desired feature from list
- Info panel updates to show selected feature properties

### Configuration Options

**Variables** (from toolConfigs.json):
- **`sortAlphabetically`** (boolean): Sort properties alphabetically, default false

### Integration Points

- **Map_**: Feature click events
- **Globe_**: 3D feature click events
- **Layers_**: Feature visibility management
- **Kinds System**: Respects layer `kind` to control Info Tool activation

### Display Features

**Property Formatting**:
- Nested objects displayed with indentation
- Arrays shown with element count
- Long strings truncated with "Show More" button
- Coordinates displayed with precision controls

**Action Buttons**:
- **Copy**: Copy feature GeoJSON to clipboard
- **Locate**: Zoom map to feature bounds
- **Hide/Show**: Toggle feature visibility
- **Filter**: Text search across property keys/values

### Use Cases

- Feature inspection: View metadata for clicked science targets
- Quality control: Verify feature properties match expected schema
- Data exploration: Browse feature attributes without external tools

---

## Tool 7: Isochrone Tool

**Location**: `src/essence/Tools/Isochrone/IsochroneTool.js`
**Purpose**: Terrain-aware traversability and travel time analysis
**Toolbar Priority**: 10
**Expandable**: No

### Key Features

- **Cost-Based Traversability Modeling**: Calculate reachable areas within cost budget
- **Multiple Cost Models**:
  - **Traverse Time**: Time-based accessibility from start point
  - **Isodistance**: Distance-based reachability
  - **Custom Models**: Pluggable cost functions
- **Path Visualization**: Display cost gradients with color ramps
- **Hover for Least-Cost Path**: Show optimal path from start point to hover location
- **Multiple Data Inputs**: DEM, slope, obstacles, cost, shade tilesets
- **Configurable Data Sources**: Per-zoom-level tile URLs
- **Real-Time Computation**: Client-side tile-based processing

### Architecture

**Technology Stack**:
- **Tile-Based Algorithm**: Dijkstra's algorithm on tile grid
- **Web Workers**: Offload computation to background threads
- **Multiple Tileset Sources**: DEM, slope, obstacle, cost, shade

**Key Files**:
- `IsochroneTool_Manager.js` - Manages multiple isochrone instances
- `IsochroneTool_Query.js` - Data fetching from tile sources
- `IsochroneTool_Algorithm.js` - Cost computation algorithms

**Computation Workflow**:
1. User places start point on map
2. Tool fetches relevant tiles (DEM, slope, cost, etc.) for viewport
3. Web Worker constructs graph with edge costs from tile data
4. Runs Dijkstra's algorithm to find all reachable cells within budget
5. Renders isochrone contours as colored overlay
6. On hover, backtraces least-cost path to start

### Configuration Options

**Variables** (from toolConfigs.json):

**Data Sources** (array of tileset objects):
```javascript
{
  "dem": "path/to/dem/{z}/{x}/{y}.tif",
  "data": [
    {
      "name": "High Res DEM",
      "demtileurl": "Missions/Mars/DEMs/HighRes/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 18,
      "resolution": 0.5
    },
    {
      "name": "Slope",
      "demtileurl": "Missions/Mars/Slope/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 18
    },
    {
      "name": "Obstacle",
      "demtileurl": "Missions/Mars/Obstacles/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 18
    }
  ]
}
```

**Cost Model Configuration**:
- **Enabled Models**: Array of active cost model names
- **Seam Interpolation**: Smoothing across tile boundaries
- **Cost Functions**: Custom JavaScript functions for cost calculation

### Integration Points

- **Map_**: Click for start point, hover for path display
- **Layers_**: Overlay rendering for isochrone zones
- **DEM Sources**: Multiple tileset queries
- **Web Workers**: Background computation

### Use Cases

- Rover traverse planning: Determine reachable area within energy budget
- Emergency egress: Find accessible safe zones within time limit
- Communication range: Calculate line-of-sight visibility zones
- Resource accessibility: Identify areas reachable for sampling

### Performance Considerations

- Tile-based approach limits computation to visible/cached tiles
- Web Workers prevent UI blocking during long computations
- Seam interpolation can introduce small artifacts at tile edges
- High-resolution DEMs (>1m/pixel) significantly increase compute time

---

## Tool 8: Layers Tool

**Location**: `src/essence/Tools/Layers/LayersTool.js`
**Purpose**: Hierarchical layer management and visibility control
**Toolbar Priority**: 1
**Expandable**: Yes

### Key Features

- **Hierarchical Layer Organization**: Tree-based structure with header/sublayer grouping
- **Toggle Layers On/Off**: Checkbox visibility controls
- **Opacity Sliders**: Per-layer opacity adjustment (0-100%)
- **Search Layers**: Text search by name or tags (`#tag` syntax)
- **Filter by Layer Type**: Show only vector, tile, vectortile, query, data, or model layers
- **Show/Hide Off Layers Toggle**: Collapse inactive layers for cleaner UI
- **Layer Info Modal**: Display layer metadata (CRS, bounds, data source)
- **Download Layers**: Export vector layers as GeoJSON, KML, or Shapefile
- **Feature Filtering**: SQL-like query builder for vector layer filtering
- **Data Shader Controls**: Adjust colormap and value ranges for Data layers
- **Colormap Selection**: Choose from scientific colormaps for Image/Data layers
- **Sortable Layer Order**: Drag-and-drop to change z-index rendering order

### Architecture

**Technology Stack**:
- **jQuery UI**: Drag-and-drop layer reordering
- **D3**: DOM manipulation and data binding
- **SortableJS**: Layer order management

**Component Structure**:
- Layer tree renderer with recursive header/sublayer expansion
- Search filter with debounced text input
- Layer type filter with multi-select checkboxes
- Feature filter modal with query builder interface
- Data shader control panel with sliders and dropdowns

### Configuration Options

**Variables** (from toolConfigs.json):
- **`expanded`** (boolean): Whether layer groups default to expanded state, default false

### Integration Points

- **Layers_**: Direct interface to layer visibility, opacity, and configuration
- **Map_**: Layer z-index reordering
- **Globe_**: Synchronized layer visibility in 3D
- **LegendTool**: Update legend when layers change
- **TimeUI**: Display time controls for time-enabled layers
- **DataShaders**: Dynamic colormap and range adjustment for Data layers

### Feature Filtering

**Query Builder**:
- Field selector (property name)
- Operator selector (=, !=, <, >, <=, >=, LIKE, IN)
- Value input (text, number, dropdown)
- AND/OR logic for multiple conditions
- SQL query preview
- Apply/Reset buttons

**Example Filter**:
```sql
SELECT * FROM features
WHERE temperature > 300
  AND sample_type IN ('soil', 'rock')
  AND name LIKE '%Site A%'
```

### Data Shader Controls

**Colormap Selection**:
- Dropdown of scientific colormaps (viridis, plasma, turbo, etc.)
- Live preview of colormap gradient
- Apply to Data or Image layers

**Value Range Adjustment**:
- Min/max sliders for data value range
- Viewport-adaptive or fixed range modes
- NoData value toggle

### Download Options

**Export Formats**:
- **GeoJSON**: Native format with all properties
- **KML**: Google Earth compatible
- **Shapefile**: ESRI format with .prj, .shp, .shx, .dbf files

**Export Configuration**:
- Choose coordinate system (layer CRS or project CRS)
- Include/exclude hidden properties
- File naming conventions

### Use Cases

- Mission operations: Toggle Sol-specific layers on/off
- Data exploration: Search for layers by mission phase tags
- Quality control: Filter features by validation status
- Export: Download science target layers for external analysis

---

## Tool 9: Legend Tool

**Location**: `src/essence/Tools/Legend/LegendTool.js`
**Purpose**: Display map legend for active layers with symbology
**Toolbar Priority**: 2
**Separated Tool**: Yes (left or right justification)

### Key Features

- **Auto-Generate Legends**: Create legends from layer configuration
- **CSV Legend Files**: Load external legend definitions
- **JSON Legend Arrays**: Define legends in layer Raw Variables
- **Gradient Scales**: Display continuous data ranges with color ramps
- **Discrete Symbology**: Show categorical symbols with labels
- **Header Layer Display**: Option to include header layer names
- **COG Colormap Legends**: Auto-generate legends from Cloud Optimized GeoTIFF colormaps
- **Layer-Synchronized Visibility**: Show/hide legend items based on layer state
- **Collapsible Legend Items**: Expand/collapse individual legend sections

### Architecture

**Legend Sources** (priority order):
1. **CSV File**: `layer.legend` property pointing to CSV file
2. **JSON Array**: `layer.Raw Variables.legend` array
3. **Auto-Generated**: From layer styling configuration
4. **COG Colormap**: TiTiler colormap metadata

**Legend Format**:

**CSV Legend**:
```csv
value,color,label
0,#0000ff,Ice
1,#00ff00,Vegetation
2,#ffff00,Sand
3,#ff0000,Rock
```

**JSON Legend**:
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

### Configuration Options

**Variables** (from toolConfigs.json):
- **`displayOnStart`** (boolean): Auto-display legend on load, default false
- **`justification`** (string): Panel placement - `"left"` or `"right"`, default "left"
- **`showHeadersInLegend`** (boolean): Include header layer names, default false

### Integration Points

- **Layers_**: Synchronize legend visibility with layer state
- **LayersTool**: Update legend when layers toggled
- **Data Layers**: Read colormap configuration
- **Image Layers**: Read COG colormap metadata

### Legend Types

**Gradient Legend**:
- Vertical color bar with min/max labels
- Smooth color transitions
- Unit label at top

**Categorical Legend**:
- Symbol/color swatch with text label
- One row per category
- Optional group headers

**Pattern Legend** (Geologic):
- SVG pattern swatch with label
- FGDC geologic unit symbols

### Use Cases

- Basemap understanding: Show elevation ranges for DEM layers
- Science data: Display temperature or spectr

al reflectance scales
- Geologic mapping: Show stratigraphic unit symbology
- Vector styling: Display category color codes

---

## Tool 10: Measure Tool

**Location**: `src/essence/Tools/Measure/MeasureTool.js`
**Purpose**: Distance measurement and elevation profiling
**Toolbar Priority**: 5
**Expandable**: No

### Key Features

- **Three Measurement Modes**:
  - **Segment**: Measure individual line segments
  - **Continuous**: Cumulative distance along path
  - **Continuous Color**: Color-coded elevation profile
- **DEM-Based Elevation Profiling**: Interactive elevation charts from DEM data
- **Multi-DEM Support**: Layer-specific DEM associations
- **Line-of-Sight (LOS) Analysis**: Visibility analysis with configurable observer/target heights
- **Distance Units**: Meters, kilometers, miles, feet
- **Interactive Profile Charts**: Chart.js with React for hover details
- **Works in Map, Globe, and Viewer**: Measurements across all rendering modes

### Architecture

**Technology Stack**:
- **React**: UI components for profile charts
- **Chart.js**: Interactive elevation profile visualization
- **metrics-graphics**: Alternative charting library
- **GDAL Backend**: DEM querying via `/api/gdal/raster` endpoint
- **Leaflet Layer**: Measurement geometry visualization

**Key Files**:
- `MeasureTool.js` - Main tool controller
- `MeasureComponents.js` - React profile chart components

**Workflow**:
1. User clicks points on map to define measurement path
2. Tool queries DEM at each point for elevation
3. Calculates distances between points accounting for elevation
4. Renders interactive profile chart with distance vs elevation
5. LOS mode draws visibility line considering terrain obstruction

### Configuration Options

**Variables** (from toolConfigs.json):
- **`dem`** (string): Primary DEM path for elevation queries
- **`layerDems`** (object): Object mapping layer names to DEM paths
- **`onlyShowDemIfLayerOn`** (boolean): Filter DEMs by layer visibility, default false
- **`defaultMode`** (string): Starting measurement mode - `"segment"`, `"continuous"`, or `"continuous_color"`, default "segment"

**Layer-Specific DEM Configuration**:
```javascript
{
  "layerDems": {
    "High Res Basemap": "Missions/Mars/DEMs/HighRes/dem.tif",
    "Global Context": "Missions/Mars/DEMs/Global/dem.tif"
  }
}
```

### Integration Points

- **Map_**: Click events for point placement, polyline rendering
- **Globe_**: 3D measurement support
- **Viewer_**: Image-space measurements (pixel coordinates)
- **GDAL Backend**: Elevation queries
- **Layers_**: DEM visibility filtering

### Measurement Features

**Distance Calculation**:
- Great circle distance for long distances
- Elevation-adjusted distance (slant distance)
- Cumulative distance display

**Elevation Profile**:
- Chart displays distance (X-axis) vs elevation (Y-axis)
- Hover shows exact values at any point
- Color-coded by elevation or slope
- Exportable as PNG or CSV

**Line-of-Sight**:
- Observer height above terrain
- Target height above terrain
- Visibility determination accounting for terrain obstruction
- Green = visible, Red = obstructed

### Use Cases

- Rover traverse planning: Measure path distance and elevation gain
- Communication range: Determine line-of-sight between lander and rover
- Slope analysis: Calculate maximum slope along proposed path
- Energy estimation: Estimate power requirements based on terrain profile

### Performance Considerations

- DEM queries are rate-limited to prevent server overload
- Long paths (>100 points) may have slower profile generation
- High-resolution DEMs (>1m/pixel) increase query time

---

## Tool 11: Shade Tool

**Location**: `src/essence/Tools/Shade/ShadeTool.js`
**Purpose**: Sun and orbiter shadow/illumination mapping with SPICE integration
**Toolbar Priority**: 102
**Expandable**: No

### Key Features

- **SPICE-Based Position Calculation**: Accurate spacecraft/body positions from SPICE kernels
- **Shadow Casting**: Visualize shadows from Sun or orbiting spacecraft
- **Line-of-Sight Visibility**: Determine visibility to celestial bodies or orbiters
- **Observer Time Conversion**: Convert between spacecraft time and UTC
- **Multiple Source Entities**: Sun, orbiters, moons, other bodies
- **Height-Above-Surface Parameter**: Adjust observer elevation
- **Dynamic Tile Generation**: Real-time visibility map from DEM data
- **Color-Coded Visibility**: Green = visible, Red = shadowed

### Architecture

**Technology Stack**:
- **SPICE Toolkit**: NASA's navigation and ancillary information system
- **Python Backend Scripts**:
  - `ll2aerll.py` - Lat/lon to azimuth/elevation conversion
  - `chronos.py` - Time conversion (UTC ↔ spacecraft time)
- **DEM Tileset Processing**: Visibility calculation from elevation data

**Key Files**:
- `ShadeTool.js` - Main tool controller
- `ShadeTool_Manager.js` - Manages multiple shade instances
- `ShadeTool_Algorithm.js` - Shading computation algorithms

**Workflow**:
1. User selects source entity (Sun, orbiter) and time
2. Tool queries SPICE backend for entity position (azimuth, elevation)
3. For each DEM tile pixel:
   - Calculate line-of-sight vector to source
   - Ray-trace against terrain to detect obstruction
   - Color pixel based on visibility (green/red)
4. Render colored overlay on map

### Configuration Options

**Variables** (from toolConfigs.json):

**DEM Configuration**:
```javascript
{
  "dem": "path/to/dem.tif",
  "data": [
    {
      "name": "High Res DEM",
      "demtileurl": "Missions/Mars/DEMs/HighRes/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 18,
      "resolution": 0.5
    }
  ]
}
```

**SPICE Source Configuration**:
```javascript
{
  "sources": [
    {
      "name": "Sun",
      "spice_id": "10",
      "color": "#ffff00"
    },
    {
      "name": "Mars Reconnaissance Orbiter",
      "spice_id": "-74",
      "color": "#00ff00"
    }
  ]
}
```

**Observer Configuration**:
```javascript
{
  "observers": [
    {
      "name": "Perseverance Rover",
      "spice_id": "-168",
      "time_system": "LMST"
    }
  ]
}
```

**Other Variables**:
- **`defaultHeight`** (number): Default observer height above surface in meters, default 0
- **`observerTimePlaceholder`** (string): Placeholder text for observer time input
- **`utcTimeFormat`** (string): strftime format for UTC time display, default `"%Y-%m-%dT%H:%M:%SZ"`

### Integration Points

- **SPICE Backend**: Position and time conversion queries
- **DEM Sources**: Elevation data for shadow calculation
- **Map_**: Overlay rendering for visibility maps
- **TimeControl**: Time-driven shading updates

### SPICE Integration

**SPICE Kernels Required**:
Located in `/private/api/spice/kernels`:
- **SPK** (Spacecraft and Planet Kernel): Ephemeris data
- **CK** (C-Kernel): Spacecraft attitude
- **LSK** (Leapseconds Kernel): Time conversions
- **PCK** (Planetary Constants Kernel): Body physical parameters
- **FK** (Frame Kernel): Reference frame definitions

**Backend APIs**:
- **`/api/spice/ll2aerll`**: Convert lat/lon to azimuth/elevation for source body
- **`/api/spice/chronos`**: Convert time between UTC and spacecraft time systems

### Use Cases

- Solar panel planning: Determine sunlight availability for power generation
- Communication windows: Calculate visibility to orbiters for data relay
- Thermal analysis: Identify shadowed regions for temperature prediction
- Landing site selection: Assess illumination conditions for proposed sites

### Performance Considerations

- SPICE queries are computationally expensive (cache results)
- High-resolution DEMs significantly increase ray-tracing time
- Multiple source entities multiply computation cost
- Recommend limiting to single source entity for real-time updates

---

## Tool 12: Sites Tool

**Location**: `src/essence/Tools/Sites/SitesTool.js`
**Purpose**: Quick navigation to preset map locations
**Toolbar Priority**: 4
**Expandable**: No

### Key Features

- **Button Bar Interface**: Radio buttons for rapid site selection
- **Preset Views**: Pre-configured lat/lon/zoom combinations
- **Header Layer Toggling**: Auto-toggle associated header layers by site code
- **Single-Click Navigation**: Instant map pan/zoom to site

### Architecture

**Technology Stack**:
- Simple button bar with radio button styling
- Direct Map_ integration for view changes
- Layer_ integration for header layer toggling

**Workflow**:
1. User clicks site button
2. Tool calls `Map_.setView(lat, lng, zoom)`
3. If site has `code`, tool toggles header layers matching that code
4. Radio button highlights active site

### Configuration Options

**Variables** (from toolConfigs.json):
- **`sites`** (array): Array of site configuration objects

**Site Object Structure**:
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

**Site Properties**:
- **`name`** (string, required): Display name for button
- **`code`** (string, optional): Site code matching header layer codes
- **`lat`** (number, required): Latitude in degrees
- **`lng`** (number, required): Longitude in degrees
- **`zoom`** (number, required): Target zoom level

### Integration Points

- **Map_**: View control (pan/zoom)
- **Layers_**: Header layer visibility toggling
- **URL State**: Site selection persisted in URL parameters

### Header Layer Code Matching

Header layers can have a `code` property. When a site with matching code is selected:
1. All header layers with that code are toggled on
2. Other header layers may be toggled off (configurable)
3. Sublayers within header inherit visibility

**Example**:
```javascript
// Site configuration
{"name": "Sol 015", "code": "SOL015", "lat": 18.445, "lng": 77.451, "zoom": 14}

// Matching header layer
{
  "name": "Sol 015 Imagery",
  "type": "header",
  "code": "SOL015",
  "sublayers": [...]
}
```

### Use Cases

- Mission operations: Quickly navigate to Sols or mission phases
- Region of interest: Jump to pre-defined science target areas
- Landing site analysis: Compare multiple candidate sites
- Traverse waypoints: Navigate to planned rover stops

---

## Tool 13: Viewshed Tool

**Location**: `src/essence/Tools/Viewshed/ViewshedTool.js`
**Purpose**: Real-time user-generated viewsheds (line-of-sight visibility analysis)
**Toolbar Priority**: 101
**Expandable**: No

### Key Features

- **Dynamic Viewshed Generation**: Real-time visibility analysis from observer points
- **Camera Presets**: Pre-configured height, azimuth FOV, elevation FOV settings
- **Multiple Simultaneous Viewsheds**: Create and manage multiple viewshed overlays
- **Planetary Curvature Consideration**: Optional curvature calculation for large viewsheds
- **Color-Coded Visibility Zones**: Green = visible, Red = obstructed, Yellow = edge
- **Observer Marker & Camera Wedge**: Visualize observer location and field-of-view
- **DEM Tile-Based Computation**: Efficient processing of elevation data

### Architecture

**Technology Stack**:
- **Ray-Tracing Algorithm**: Cast rays from observer to all visible cells
- **DEM Tileset Processing**: Load relevant elevation tiles for computation
- **Canvas Overlay**: Render visibility map as colored overlay

**Key Files**:
- `ViewshedTool.js` - Main tool controller
- `ViewshedTool_Manager.js` - Manages multiple viewshed instances
- `ViewshedTool_Algorithm.js` - Visibility computation algorithms

**Workflow**:
1. User places observer point on map
2. User configures camera parameters (height, FOV, orientation)
3. Tool loads DEM tiles covering viewshed area
4. For each cell within max range:
   - Calculate line-of-sight from observer to cell
   - Ray-trace against terrain to detect obstruction
   - Color cell based on visibility
5. Render overlay with camera wedge visualization

### Configuration Options

**Variables** (from toolConfigs.json):

**DEM Tileset Configuration**:
```javascript
{
  "data": [
    {
      "name": "High Res DEM",
      "demtileurl": "Missions/Mars/DEMs/HighRes/{z}/{x}/{y}.1bto4b",
      "minZoom": 10,
      "maxZoom": 18,
      "resolution": 0.5
    }
  ]
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

**Other Variables**:
- **`curvature`** (boolean): Enable planetary curvature calculations, default false
- **`defaultObserverHeight`** (number): Default observer height in meters, default 2.0
- **`defaultTargetHeight`** (number): Default target height in meters, default 0.0

### Integration Points

- **Map_**: Observer placement, overlay rendering
- **DEM Sources**: Elevation data for visibility calculation
- **Camera Controls**: Azimuth/elevation sliders, FOV inputs

### Viewshed Parameters

**Observer Parameters**:
- **Height**: Observer elevation above terrain (meters)
- **Azimuth Center**: Horizontal direction center (degrees, 0 = North)
- **Azimuth FOV**: Horizontal field-of-view (degrees)
- **Elevation Center**: Vertical direction center (degrees, 0 = horizon)
- **Elevation FOV**: Vertical field-of-view (degrees)
- **Max Range**: Maximum visibility distance (meters)

**Visibility Calculation**:
- **Green**: Cell is visible from observer
- **Red**: Cell is obstructed by terrain
- **Yellow**: Cell is at edge of FOV
- **Transparent**: Cell outside FOV or max range

### Use Cases

- Camera planning: Determine what's visible from rover camera positions
- Site reconnaissance: Assess what can be observed from proposed locations
- Communication analysis: Identify locations with line-of-sight to lander
- Hazard assessment: Detect blind spots where obstacles are hidden

### Performance Considerations

- Viewshed computation scales with FOV and max range
- High-resolution DEMs increase computation time
- Multiple simultaneous viewsheds multiply processing cost
- Curvature calculations add 20-30% overhead

---

## Tool Lifecycle

### Initialization (make)

1. **Interface Creation**: Tool creates `interfaceWithMMGIS()` to manage communication with core
2. **DOM Setup**: Injects markup into designated container:
   - Toolbar tools: `#toolPanel`
   - Separated tools: `#toolContentSeparated_{name}`
3. **Event Binding**: Attaches event listeners for user interactions
4. **State Restoration**: Parses URL parameters to restore previous state
5. **Map Integration**: Adds map layers, event handlers, or overlays as needed

### Operation

- Tools respond to user interactions (clicks, inputs, drags)
- Update their UI and map visualizations
- Communicate with backend APIs for data processing
- Emit events for state changes (e.g., `toolChange`, `toggleSeparatedTool`)

### Cleanup (destroy)

1. **Event Unbinding**: Removes all event listeners
2. **Map Cleanup**: Removes layers, overlays, and event handlers from map
3. **DOM Removal**: Clears tool UI from panel
4. **Interface Separation**: Calls `separateFromMMGIS()` to fully disconnect

### URL State Management

Each tool implements `getUrlString()` to serialize its state to URL parameters, enabling:
- Bookmarkable tool configurations
- Session restoration on page reload
- Sharing of specific tool states

---

## Integration Points

### Map_ Integration

Tools interact with the core Map_ system (`src/essence/Basics/Map_/Map_.js`) to:
- Add/remove Leaflet layers
- Register click/mousemove/mouseout handlers
- Pan/zoom the map programmatically
- Access map bounds and projection

### Globe_ Integration

3D-enabled tools (Measure, Draw, Identifier, Viewshed, Shade, Curtain) integrate with Globe_ (`src/essence/Basics/Globe_/Globe_.js`) for:
- 3D feature rendering
- Globe click/hover events
- Camera control
- Terrain-clamped geometry

### Viewer_ Integration

Tools supporting image-based views (Measure, Curtain) integrate with Viewer_ (`src/essence/Basics/Viewer_/Viewer_.js`) for:
- Coordinate transformation
- Image click events
- Overlay rendering
- OpenSeadragon integration

### Layers_ Integration

All tools respect the layer system managed by L_ (`src/essence/Basics/Layers_/Layers_.js`):
- Check layer visibility states
- React to layer toggle events
- Filter tool behavior by active layers

### Authentication Integration

Tools with user-owned data (Draw) integrate with the authentication system:
- Check login state
- Enforce ownership and permissions
- Display user-specific data

---

## Backend API Integration

Many tools require backend services:

### GDAL Services
- DEM querying for elevation data (Measure, Identifier, Viewshed, Shade, Isochrone)
- Raster pixel value extraction (Identifier)
- Tile serving (Viewshed, Shade, Isochrone)

### File Management APIs
- Draw file CRUD operations (`/api/files`)
- File sharing and permissions
- History tracking (`/api/files/gethistory`)

### SPICE Services
- Spacecraft position calculation (Shade) (`/api/spice/ll2aerll`)
- Time conversion (Shade) (`/api/spice/chronos`)

---

## Configuration Interface

The administrative configuration interface (`configure/public/`) dynamically generates forms from each tool's configuration in `toolConfigs.json`:

**Field Types**:
- **text**, **number**, **textarea**: Simple inputs
- **checkbox**, **dropdown**: Boolean and enumerated choices
- **textarray**: Comma-separated lists
- **objectarray**: Structured arrays with nested fields

**Validation**:
- Min/max constraints
- Required fields
- Regex patterns
- Step sizes

---

## Performance Considerations

### Tile-Based Processing

Tools processing large spatial datasets (Viewshed, Shade, Isochrone) use tiled approaches to:
- Limit memory consumption
- Enable progressive rendering
- Support multiple zoom levels

### Client-Side Computation

Where possible, tools perform client-side computation to:
- Reduce server load
- Provide immediate feedback
- Work offline (partially)

### Lazy Loading

Tools are loaded on-demand rather than at application startup to:
- Reduce initial bundle size
- Improve page load time
- Load only needed dependencies

---

## Extensibility

### Creating New Tools

New tools can be added by:

1. Creating a tool directory under `src/essence/Tools/{ToolName}/`
2. Implementing the tool interface in `{ToolName}Tool.js`
3. Defining configuration in `configure/public/toolConfigs.json`
4. Registering the tool in `src/pre/tools.js`

### Tool Plugins

Some tools (notably Draw) support their own plugin systems for extended functionality:
- Draw supports Geologic and Set Operations plugins
- Plugins extend core tool capabilities without modifying base code

---

## Browser and Mobile Support

### Desktop Browsers

All tools fully support modern desktop browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Devices

Tools adapt to mobile:
- Toolbar tools switch to horizontal icon layout
- Touch event support
- Responsive panel sizing
- Some separated tools hidden on mobile for UI clarity

### Touch vs Mouse

Tools handle both input methods:
- Click/tap equivalence
- Hover alternatives on touch devices (long-press)
- Multi-touch gestures where appropriate (pinch/zoom)

---

## Security Considerations

### Authentication-Gated Tools

Tools with user-owned data (Draw) require authentication:
- Display "Please log in" state when not authenticated
- Enforce ownership on file modifications
- Validate permissions server-side

### Input Validation

All tools validate user input:
- Numeric ranges (elevation, distances, zoom levels)
- String lengths (file names, descriptions)
- File size limits (imports, uploads)
- Coordinate bounds (lat/lon validation)

### XSS Prevention

Tools properly escape user-generated content:
- Feature properties in Info tool (HTML escaping)
- Draw file names and descriptions (sanitization)
- Template field values (input validation)

---

## Testing Strategy

### Unit Tests

The Draw tool includes comprehensive unit tests (`DrawTool.test.js`) demonstrating the pattern:
- Test tool initialization
- Test state management
- Test file operations
- Test validation logic

### Integration Tests

Tools should be tested for:
- ToolController integration (lifecycle)
- Map/Globe/Viewer integration (rendering)
- Backend API integration (data operations)
- URL state persistence (bookmarking)

---

## Future Enhancements

### Planned Features

1. **Tool Presets**: Save and restore tool configurations
2. **Tool Workflows**: Chain multiple tools in sequence
3. **Tool Export**: Export tool outputs to standard formats
4. **Tool Collaboration**: Real-time collaborative tool usage
5. **Tool Analytics**: Track tool usage and performance
6. **Unified Tool State Manager**: Centralized tool state management

### API Improvements

1. **Unified Tool API**: Standardize additional lifecycle hooks (onResize, onLayerChange, etc.)
2. **Tool Communication**: Enable inter-tool messaging
3. **Tool Dependencies**: Declare and resolve tool dependencies

---

## Technical Debt

### Known Issues

1. Some tools (Animation, Chemistry) have minimal configuration options
2. Tool state persistence in URL is inconsistent across tools
3. Mobile support varies by tool
4. Accessibility features are incomplete (ARIA labels, keyboard shortcuts)
5. Testing coverage is sparse (only Draw has comprehensive tests)

### Refactoring Opportunities

1. Extract common tool patterns into base class or mixin
2. Unify separated tool positioning logic
3. Standardize backend API patterns
4. Consolidate DEM access patterns across Measure, Identifier, Viewshed, Shade, Isochrone

---

## Conclusion

The MMGIS Interactive Mapping Tools system provides a robust, extensible framework for delivering 15 specialized geospatial capabilities to users. The plugin architecture ensures consistent integration while allowing tools to implement domain-specific functionality. From collaborative drawing to terrain analysis, these tools support a wide range of planetary science and Earth observation use cases.

---

## Revision History

**Version**: 2.0
**Date**: 2025-12-22
**Status**: Active

**Changes**:
- Expanded to document all 15 user-facing tools individually
- Merged comprehensive Draw Tool content from spec 003
- Added brief architectural note about Kinds system
- Comprehensive configuration options for each tool
- Integration points documented
- Architecture notes (React vs jQuery, libraries used, file structure)
- Test coverage notes where applicable
