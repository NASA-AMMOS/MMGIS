# Vector Drawing & Collaboration - Feature Specification

## Overview

The MMGIS Vector Drawing & Collaboration system provided a comprehensive geospatial vector data creation, editing, and sharing platform. The feature was implemented to enable mission teams to collaboratively create, annotate, and manage geographic features with real-time history tracking, advanced geometric operations, and flexible sharing controls for planetary exploration missions.

## Feature Description

### Core Capabilities

The drawing system supported seven primary vector geometry types, each with customizable styling and metadata:

1. **Polygon Drawing** - Multi-vertex polygon creation with clip-over/clip-under operations
2. **Circle Drawing** - Radius-based circles with optional forced dimensions
3. **Rectangle Drawing** - Axis-aligned bounding boxes
4. **Line Drawing** - Multi-segment polylines with optional snapping
5. **Point Drawing** - Georeferenced point features with customizable symbols
6. **Text Annotations** - Positioned text labels with rich styling options
7. **Arrow Annotations** - Directional indicators with customizable arrowhead geometry

### File Organization & Intents

<!-- HUMAN REVIEW NEEDED: Verify the business logic behind the intent system - is this still the desired categorization model or should it be more flexible? -->

The system organized drawings into typed files called "intents" which categorized features by operational purpose:

- **ROI (Region of Interest)** - L1 Polygons for primary areas of scientific interest
- **Campaign** - L2 Polygons for mission campaign boundaries
- **Campsite** - L3 Polygons for operational staging areas
- **Trail** - Polyline features representing traverse paths
- **Signpost** - Point features for waypoints and markers
- **Note** - Standalone text annotations
- **All (Map)** - Generic geospatial features (polygons, lines, points)
- **Master Files** - Lead-controlled shared files per intent type

### Collaboration & Sharing

The feature implemented a sophisticated multi-level sharing model:

#### File Ownership Modes
- **Private (default)** - Only the creator can view and edit
- **Public Read-Only** - Anyone can view, only owner can edit
- **Public List-Edit** - Owner designates specific users who can edit
- **Public All-Edit** - Anyone authenticated can edit
- **Group Ownership** - Files owned by user groups rather than individuals
- **Master Files** - System-managed shared files owned by the lead group

#### Real-Time Collaboration
- Multiple users could view and edit the same file simultaneously
- File history tracked all edits with author attribution
- Changes propagated to all users viewing the file via websocket events
- Optimistic UI updates with server reconciliation on conflicts

<!-- HUMAN REVIEW NEEDED: Was real-time websocket synchronization fully implemented for concurrent edits, or was this primarily history-based post-hoc collaboration? -->

### Feature Organization & Filtering

#### File Grouping
- **By Folder** - User-defined folders with elevated folder support for leads
- **By Tag** - Hashtag-based categorization (e.g., #geology, #hazards)
- **By Author** - Grouped by file creator
- **Alphabetical** - A-Z sorted file names
- **Ungrouped** - Flat file list

#### Advanced Filtering
The system provided multiple filtering mechanisms:
- Text search across file names, authors, and descriptions
- Tag-based search using `#tagname` syntax
- Intent-based filtering (show only ROIs, campaigns, etc.)
- Visibility filters (on/off, public/private, owned)
- Multi-criteria advanced filter builder with AND/OR grouping

### Geometric Operations

The backend provided advanced PostGIS-powered spatial operations:

#### Clipping Operations
- **Clip Over** - New geometry clips/removes overlapping portions of existing features
- **Clip Under** - New geometry is clipped to avoid overlapping existing features
- Both operations utilized recursive PostGIS ST_DIFFERENCE with buffering for precision

#### Merge Operation
- Combined multiple selected features into a single unified geometry
- ST_UNION for polygons with mitered buffering to prevent gaps
- ST_LineMerge for connected line segments
- Properties inherited from designated "prop_id" feature

#### Split Operation
- Divided features using a user-drawn line
- ST_SPLIT operation against all selected feature geometries
- Created multiple new features from split results
- Preserved original feature properties on all split children

### History & Undo System

The feature implemented a comprehensive temporal database architecture:

#### History Tracking
- Every add, edit, delete, merge, split, and clip operation recorded
- History entries stored with:
  - Unique history_id per file
  - Millisecond timestamp
  - Action index (0=add, 1=edit, 2=delete, 3=undo, 5=clip-over, 6=merge, 7=clip-under, 8=split)
  - Array of feature IDs active at that point in time
  - Author username

#### Time Travel
- Users could scrub through file history to any past timestamp
- Map visualization updated to show features as they existed at selected time
- "Undo to Time" operation reverted all changes after selected timestamp
- History UI displayed chronological action list with author attribution

#### Feature Trimming
Rather than deleting features, the system implemented soft-delete with temporal validity:
- `extant_start` - Timestamp when feature was created
- `extant_end` - Timestamp when feature was removed (NULL if still active)
- `trimmed_start[]` - Array of undo timestamps affecting this feature
- `trimmed_at[]` - Array of timestamps when trims were applied
- `trimmed_at_final` - Most recent trim operation timestamp

### Template System

<!-- HUMAN REVIEW NEEDED: The template system appears to be a powerful metadata enforcement tool - verify if this is still the desired approach for structured data entry or if a more flexible schema is needed -->

The system supported JSON-based feature templates that enforced metadata schemas:

#### Template Features
- **Field Types**: text, number, date, incrementer, dropdown, checkbox, textarea
- **Auto-Incrementing Fields** - Sequentially numbered features (e.g., SOL001, SOL002)
- **Collision Detection** - Prevented duplicate incrementer values
- **Template Enforcement** - Backend validated and auto-populated template fields
- **Reusable Templates** - Saved templates shared across files
- **Template Designer UI** - Visual template builder in file settings modal

#### Incrementer Logic
The system intelligently handled auto-incrementing fields:
- Syntax: `prefix#suffix` (e.g., `SOL#` becomes `SOL001`)
- Scanned all features in file to find used values
- Auto-assigned next available number
- Collision detection during edits prevented duplicates
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

#### Geologic Symbology
Specialized plugin for geologic mapping:
- Pattern fills (dots, lines, hashes) for geologic units
- FGDC-compliant line symbology (contacts, faults, boundaries)
- Color-coded stratigraphic units
- SVG-based pattern rendering

### Import/Export

The system supported multiple geospatial formats:

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

### Visualization & Labeling

#### Map Rendering
- Leaflet-based 2D rendering with L.geoJSON
- Cesium-based 3D Globe rendering with clamped geometry
- Pattern fill support via SVG rasterization
- Geologic line symbolization with custom SVG markers
- Layer ordering by intent priority

#### Labels & Popups
- Feature labels bound to geometry centroids
- Toggle labels on/off per file
- Popup templates from feature properties
- Active feature highlighting in gold (`rgb(255, 221, 92)`)
- Hover effects with property tooltips

### Master File System & Review

<!-- HUMAN REVIEW NEEDED: Confirm that the "Lead Review" workflow is still the intended process for master file updates, or if a more democratic collaborative model is desired -->

Master files implemented a lead-controlled review process:

#### Master File Characteristics
- One master file per intent type (ROI, Campaign, Campsite, Trail, Signpost)
- Owned by `mmgis-group` with elevated permissions
- Always public and visible in "Lead Maps" section
- Read-only for non-lead users
- Review workflow for lead approval of user submissions

#### Review Process
1. Users created features in personal files
2. Lead users opened Review modal from Master Files section
3. Review UI displayed all pending files for that intent
4. Lead could preview features on map
5. Lead approved (copy to master) or rejected submissions
6. Approved features copied with metadata preservation

### Database Schema

#### User Files Table
```sql
user_files {
  id: SERIAL PRIMARY KEY
  file_owner: VARCHAR(50) NOT NULL
  file_owner_group: STRING[] (nullable, group ownership)
  file_name: VARCHAR(355) NOT NULL
  file_description: VARCHAR(10000) (nullable, supports tags/folders via ~# ~@ ~^ syntax)
  is_master: BOOLEAN NOT NULL DEFAULT false
  intent: ENUM('roi','campaign','campsite','trail','signpost','all') (nullable)
  public: ENUM('0','1') NOT NULL DEFAULT '0'
  hidden: ENUM('0','1') NOT NULL DEFAULT '0'
  template: JSON (nullable, feature template schema)
  publicity_type: VARCHAR(255) (nullable, 'read_only'|'list_edit'|'all_edit')
  public_editors: TEXT[] (nullable, usernames with edit access)
  created_on: TIMESTAMP NOT NULL
  updated_on: TIMESTAMP NOT NULL
}
```

#### User Features Table
```sql
user_features {
  id: SERIAL PRIMARY KEY
  file_id: INTEGER NOT NULL REFERENCES user_files(id)
  level: INTEGER (nullable, z-order for rendering)
  intent: ENUM('roi','campaign','campsite','trail','signpost','polygon','line','point','text','arrow') (nullable)
  properties: JSON (nullable, feature metadata including 'uuid', 'style', custom fields)
  geom: GEOMETRY(GEOMETRY,4326) (nullable, PostGIS spatial column)
  extant_start: BIGINT (nullable, creation timestamp)
  extant_end: BIGINT (nullable, deletion timestamp, NULL if active)
  trimmed_start: BIGINT[] (nullable, array of undo timestamps)
  trimmed_at: STRING[] (nullable, array of trim application timestamps)
  trimmed_at_final: BIGINT (nullable, most recent trim timestamp)
}
```

#### File Histories Table
```sql
file_histories {
  id: SERIAL PRIMARY KEY
  file_id: INTEGER NOT NULL REFERENCES user_files(id)
  history_id: INTEGER NOT NULL (sequential per file)
  time: BIGINT NOT NULL (epoch milliseconds)
  action_index: INTEGER NOT NULL (0=add, 1=edit, 2=delete, 3=undo, 5=clip-over, 6=merge, 7=clip-under, 8=split)
  history: INT[] (nullable, array of feature IDs active at this point)
  author: VARCHAR(255) (nullable, username who performed action)
}
```

### Properties Schema

Every feature stored a standardized properties object:

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

## API Endpoints

### Drawing Operations (`/api/draw`)

- **POST /add** - Create a new feature in a file
  - Body: `{ file_id, geometry, properties, intent, clip: 'over'|'under'|null }`
  - Returns: `{ status, message, body: { id, intent } }`
  - Triggers: History update, websocket broadcast

- **POST /edit** - Modify an existing feature
  - Body: `{ file_id, feature_id, geometry, properties, intent }`
  - Returns: `{ status, message, body: { id, uuid, intent } }`
  - Triggers: History update, websocket broadcast

- **POST /remove** - Soft-delete a feature
  - Body: `{ file_id, id }`
  - Returns: `{ status, message }`
  - Triggers: History update with action_index=2

- **POST /undo** - Revert file to a past timestamp
  - Body: `{ file_id, undo_time }`
  - Returns: `{ status, message }`
  - Triggers: Feature trimming, history update with action_index=3

- **POST /merge** - Combine multiple features
  - Body: `{ file_id, prop_id, ids: [id1, id2, ...] }`
  - Returns: `{ status, message, body: { ids: [new_ids] } }`
  - Triggers: History update with action_index=6

- **POST /split** - Divide features with a line
  - Body: `{ file_id, split: line_geojson, ids: [id1, id2, ...] }`
  - Returns: `{ status, message, body: { ids: [new_ids] } }`
  - Triggers: History update with action_index=8

- **POST /clear_test** - Clear test database tables (testing only)

### File Management (`/api/files`)

- **POST /get** - Retrieve user's files list
  - Body: `{}`
  - Returns: `{ status, body: { files: [...] } }`

- **POST /getfile** - Retrieve specific file with features
  - Body: `{ id, time: timestamp|null, published: true|false }`
  - Returns: `{ status, body: { file: [...], geojson: {...} } }`

- **POST /make** - Create a new file
  - Body: `{ file_name, file_description, intent, public, template }`
  - Returns: `{ status, body: { file_id } }`

- **POST /change** - Update file metadata
  - Body: `{ id, file_name, file_description, public, publicity_type, public_editors, template }`
  - Returns: `{ status, message }`

- **POST /remove** - Delete a file and all its features
  - Body: `{ id }`
  - Returns: `{ status, message }`

- **POST /gethistory** - Retrieve file's edit history
  - Body: `{ file_id }`
  - Returns: `{ status, body: { history: [...] } }`

- **POST /modifykeyword** - Rename or remove folder/tag
  - Body: `{ keyword, type: 'folders'|'tags', newKeyword }`
  - Returns: `{ status, message }`

### Publishing (`/api/publish`)

<!-- HUMAN REVIEW NEEDED: Clarify the distinction between "Latest Map" published view and regular master files - is this redundant functionality or serving a specific operational need? -->

- **POST /on** - Publish selected features to "Latest Map"
  - Body: `{ files: [file_ids] }`
  - Returns: `{ status, message }`

- **POST /off** - Unpublish features from "Latest Map"
  - Body: `{ files: [file_ids] }`
  - Returns: `{ status, message }`

## Frontend Architecture

### Component Structure

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

### State Management

The DrawTool maintained global state across components:

```javascript
{
  files: [],                     // Array of user file objects
  filesOn: [],                   // Array of visible file IDs
  currentFileId: null,           // Active file for drawing
  intentType: null,              // Current drawing intent
  fileGeoJSONFeatures: {},       // Cached features by file_id
  labelsOn: [],                  // File IDs with labels enabled
  copyFileId: null,              // Source file for copy operation
  isEditing: false,              // Edit mode active
  contextMenuLayer: null,        // Right-click selected feature
  contextMenuLayers: [],         // Multi-select features
  timeInHistory: null,           // Current history timeline position
  masterFileIds: [],             // IDs of master files
  userGroups: [],                // Current user's group memberships
}
```

### Leaflet Integration

The system extended Leaflet with custom drawing handlers:

- `L.Draw.Polygon` - Extended for clip-over/under support
- `L.Draw.Circle` - Modified for forced radius mode
- `L.Draw.Rectangle` - Standard Leaflet.draw implementation
- `L.Draw.Polyline` - Extended with auto-vertex resolution
- `L.Draw.Marker` - Symbol-based point placement
- `L.Edit.Poly` - Vertex editing with optional snapping
- Custom annotation divs for text/arrow features

### Cesium Integration

3D rendering delegated to Globe_:

```javascript
Globe_.litho.addLayer('clamped', {
  name: 'camptool_DrawTool_' + fileId,
  on: true,
  geojson: normalizedFeatures,
  opacity: 1,
  style: { letPropertiesStyleOverride: true }
})
```

## Configuration

### Tool Variables (`config/tools.json`)

```json
{
  "draw": {
    "templates": {
      "TemplateName": [
        { "field": "name", "type": "text", "default": "" },
        { "field": "id", "type": "incrementer", "default": "SOL#" },
        { "field": "type", "type": "dropdown", "default": ["A", "B", "C"] }
      ]
    },
    "intents": {
      "roi": "Region of Interest",
      "campaign": "Campaign Boundary"
    },
    "leadsCanEditFileInfo": true,
    "masterFileIds": [1,2,3,4,5]
  }
}
```

### Environment Variables

```bash
# No drawing-specific env vars
# Relies on AUTH settings for user authentication
# Websocket config from WEBSOCKET_ROOT_PATH
```

## Security Considerations

### Access Control

- File operations validated against owner, group membership, or public_editors list
- Master files restricted to lead group (mmgis-group) for edit operations
- History undo operations require file edit permissions
- Feature properties sanitized to prevent XSS in templates

### SQL Injection Prevention

- All PostGIS queries use Sequelize replacements for parameterization
- User-provided geometries validated as valid JSON before ST_GeomFromGeoJSON
- Feature IDs validated as integers before SQL array operations

### Data Integrity

- UUID generation prevents feature ID collisions across systems
- History tracking provides audit trail for all modifications
- Soft-delete architecture allows recovery of accidentally deleted features
- Optimistic locking via timestamp comparison (not explicitly implemented, potential race condition)

<!-- HUMAN REVIEW NEEDED: Should concurrent edit collision detection be added to prevent overwrite races? -->

## Performance Optimization

### Database Indexing

Recommended indexes (not explicitly defined in code):
```sql
CREATE INDEX idx_userfeatures_file_id ON user_features(file_id);
CREATE INDEX idx_userfeatures_geom ON user_features USING GIST(geom);
CREATE INDEX idx_filehistories_file_id ON file_histories(file_id);
CREATE INDEX idx_filehistories_time ON file_histories(time);
```

### Frontend Caching

- File lists cached on initial load, refreshed only on modifications
- Feature geometries cached in `fileGeoJSONFeatures[file_id]`
- Layer objects reused rather than recreated on toggle
- History timeline paginated (not implemented, potential future optimization)

### Spatial Query Optimization

- PostGIS ST_INTERSECTS for spatial overlap detection
- Recursive CTE with iteration limit (n < 1) for clip-under operations
- ST_BUFFER with mitered joins for merge operations
- ST_Dump to handle multi-geometry results

## Known Limitations

1. **Real-Time Sync** - Websocket events trigger refetch, not operational transforms
2. **Conflict Resolution** - Last-write-wins, no CRDT-style merging
3. **Large File Performance** - No pagination for files with 1000+ features
4. **History Size** - History table grows unbounded, no archival strategy
5. **Geologic Symbols** - Limited to predefined FGDC symbol set
6. **Template Validation** - Backend validation occurs on save, not during editing
7. **Undo Granularity** - Undo reverts entire file to timestamp, not single operation
8. **Export Limitations** - KML/SHP exports lose some MMGIS-specific metadata

<!-- HUMAN REVIEW NEEDED: Which limitations are acceptable technical debt versus critical issues requiring architectural changes? -->

## Testing Approach

The system implemented a parallel test environment:

- **Test Tables**: `user_files_tests`, `user_features_tests`, `file_histories_tests`
- **Test Flag**: `test: 'true'` in request body routes to test tables
- **Test Reset**: `/api/draw/clear_test` truncates all test tables
- **Master File Recreation**: Test environment recreates master files on reset

## Dependencies

### Backend
- **express** - REST API routing
- **sequelize** - ORM for PostgreSQL
- **postgis** - Spatial database extension
- **uuid** - Feature UUID generation

### Frontend
- **leaflet** - 2D map rendering
- **leaflet.draw** - Drawing and editing tools
- **turf.js** - Client-side geospatial operations
- **d3** - DOM manipulation and data binding
- **tokml** - GeoJSON to KML conversion
- **shp-write** - GeoJSON to Shapefile conversion
- **file-saver** - Client-side file downloads

## Future Considerations

Potential enhancements not yet implemented:

1. **Operational Transform** - True real-time collaborative editing with conflict-free replicated data types
2. **Feature Locking** - Prevent simultaneous edits to same feature
3. **Version Branching** - Save multiple versions of a file with merge capabilities
4. **Raster Clipping** - Clip features against raster data boundaries
5. **Measurement Tools** - Built-in area/distance calculations
6. **Import Validation** - Topology checks on imported geometries
7. **Bulk Operations** - Multi-file export, deletion, permission changes
8. **API Rate Limiting** - Per-user drawing operation quotas
9. **Feature Comments** - Discussion threads on individual features
10. **Change Notifications** - Email/webhook alerts for file modifications

---

*This specification documents the implemented state of the Vector Drawing & Collaboration feature as of the codebase snapshot.*
