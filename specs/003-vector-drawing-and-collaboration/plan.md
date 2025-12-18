# Vector Drawing & Collaboration - Implementation Plan

## Overview

This document outlines the implementation approach that was followed for the MMGIS Vector Drawing & Collaboration feature. It captures the architectural decisions, development phases, and technical strategies used to build a robust collaborative geospatial editing system.

## Design Principles

The implementation followed these guiding principles:

1. **Spatial-First Architecture** - Leveraged PostGIS for all geometric operations rather than client-side computation
2. **Optimistic UI Updates** - Immediate visual feedback with eventual server consistency
3. **Non-Destructive Editing** - Soft-delete and temporal validity model preserved historical data
4. **Modular Components** - Separate concerns for drawing, editing, files, history, and publishing
5. **Progressive Enhancement** - Core features worked without plugins; plugins added specialized capabilities
6. **Permission Inheritance** - Files inherited permissions from owners; features inherited from files

## Architecture Decisions

### Spatial Database as Single Source of Truth

**Decision**: Use PostGIS as the authoritative data store for all geometries and perform all spatial operations server-side.

**Rationale**:
- PostGIS provided battle-tested implementations of complex spatial operations (ST_DIFFERENCE, ST_UNION, ST_SPLIT)
- Server-side spatial operations ensured consistency across clients
- Reduced client-side computational requirements for large datasets
- Enabled efficient spatial indexing with GIST indexes

**Trade-offs**:
- Network latency for every geometric operation
- Server CPU/memory requirements scaled with number of concurrent operations
- Client could not perform spatial operations offline

**Alternative Considered**: Turf.js for all client-side spatial operations
- **Rejected because**: Browser performance degraded with complex polygons, inconsistent results across implementations, difficult to maintain feature parity

### History as Event Log vs Snapshot-Based

**Decision**: Store history as an array of active feature IDs per action rather than full geometry snapshots.

**Rationale**:
- Dramatically reduced storage requirements (IDs vs full geometries)
- Enabled efficient time-travel by reconstructing state from feature table
- Allowed querying features that existed at any historical point
- Simplified undo operations to array manipulation

**Trade-offs**:
- Reconstructing historical state required joining features table
- Permanently deleted features could not be visualized in history (only feature IDs)
- History queries became slower as feature table grew

**Alternative Considered**: Full geometry snapshots in history table
- **Rejected because**: 100MB file would generate gigabytes of history; impractical for long-running missions

### Soft-Delete with Temporal Validity

**Decision**: Implement `extant_start/extant_end` rather than hard deletes, with additional `trimmed_*` arrays for undo operations.

**Rationale**:
- Preserved complete edit history even for deleted features
- Allowed "undo delete" operations without backup tables
- Enabled temporal queries (show features between timestamps)
- Provided audit trail for mission-critical data

**Trade-offs**:
- Features table grew unbounded (never truly deleted)
- Queries required `WHERE extant_end IS NULL` filters for active features
- Complex trimmed array logic for handling multiple undo operations

**Alternative Considered**: Hard delete with separate history snapshots
- **Rejected because**: Undelete operations would require complex restoration logic; lost metadata on permanently deleted features

### Collaboration Model: Eventual Consistency

**Decision**: Websocket broadcasts triggered client-side refetches rather than pushing full feature updates.

**Rationale**:
- Simpler implementation than operational transforms
- Avoided complex conflict resolution algorithms
- Leveraged existing file fetch mechanisms
- Reduced websocket message size (just notification, not data)

**Trade-offs**:
- Multiple clients editing same file could overwrite each other's changes (last-write-wins)
- Rapid concurrent edits led to excessive refetches
- No visual indication of other users' active edits

**Alternative Considered**: Operational Transform (OT) or CRDT-based real-time sync
- **Rejected because**: Implementation complexity too high for initial release; required complete rewrite of edit logic

<!-- HUMAN REVIEW NEEDED: Should this be revisited for true real-time collaboration in future versions? -->

### File-Based Organization vs Layer-Based

**Decision**: Organize features into files (containers) with associated intent types rather than free-form layers.

**Rationale**:
- Matched mission workflow where teams created thematic datasets
- Enabled permission control at file level rather than per-feature
- Simplified UI (manage files, not thousands of individual features)
- Allowed batch operations on entire file contents

**Trade-offs**:
- Moving features between files required copy+paste
- Couldn't have mixed-intent features in same file (e.g., ROI + Trail in "Mission 1" file)
- File proliferation if users created one file per feature

**Alternative Considered**: Flat feature database with arbitrary layer groupings
- **Rejected because**: Permission model became complex; UI organization unclear; no natural grouping for history/undo

## Implementation Phases

### Phase 1: Core Drawing & Storage (MVP)

**Scope**:
- Basic polygon, line, point drawing with Leaflet.draw
- PostgreSQL tables (user_files, user_features)
- Simple file CRUD operations
- Private files only (no sharing)
- Single-user editing (no collaboration)

**Duration**: Approximately 4-6 weeks

**Key Milestones**:
1. Database schema design and PostGIS setup
2. Express API endpoints for add/edit/remove features
3. Leaflet.draw integration with custom handlers
4. File list UI with create/delete operations
5. Basic feature styling (color, opacity, weight)

**Technical Challenges**:
- Leaflet coordinate system (lng,lat) vs PostGIS (lat,lng) - resolved with coordinate swapping
- GeoJSON CRS handling for ST_GeomFromGeoJSON - added explicit EPSG:4326 CRS objects
- Feature rendering performance with 1000+ features - implemented layer grouping

### Phase 2: Advanced Geometry Operations

**Scope**:
- Clip-over and clip-under drawing modes
- Merge multiple features
- Split features with line tool
- PostGIS spatial queries for operations

**Duration**: Approximately 3-4 weeks

**Key Milestones**:
1. PostGIS ST_DIFFERENCE implementation for clipping
2. ST_UNION with buffering for merge operations
3. ST_SPLIT for line-based feature division
4. Recursive CTE for clip-under against multiple features
5. UI for operation mode selection

**Technical Challenges**:
- ST_DIFFERENCE producing null geometries on edge cases - added ST_MakeValid wrappers
- Merge buffer parameters affecting geometry precision - experimented with micron-level buffers
- Split operation creating invalid geometries - implemented ST_Dump to handle multi-part results

### Phase 3: History & Temporal Features

**Scope**:
- File history tracking with action indexing
- History UI with timeline scrubbing
- Undo to timestamp functionality
- Author attribution for edits

**Duration**: Approximately 2-3 weeks

**Key Milestones**:
1. file_histories table design and implementation
2. pushToHistory() function for all mutating operations
3. History timeline UI with chronological display
4. Time-travel query implementation
5. Undo operation with feature trimming logic

**Technical Challenges**:
- Efficient history queries for files with 10,000+ actions - added file_id+time composite index
- Rendering historical state without degrading performance - cached reconstructed feature sets
- Undo operation complexity with nested trimming arrays - developed recursive trimming algorithm

### Phase 4: Collaboration & Sharing

**Scope**:
- Public/private file permissions
- List-edit and all-edit modes
- Group ownership for files
- Master files system
- Websocket integration for multi-user updates

**Duration**: Approximately 3-4 weeks

**Key Milestones**:
1. Extended user_files table with public, publicity_type, public_editors columns
2. Permission middleware in API endpoints
3. File sharing UI with editor selection
4. Master file creation and review workflow
5. Websocket 'drawFileChange' event broadcasting

**Technical Challenges**:
- Permission validation across owner, group, and public_editors - created complex Sequelize OR queries
- Race condition with concurrent edits - implemented optimistic locking with timestamp checks (partial)
- Master file review UI state management - designed modal with preview+approve workflow

<!-- HUMAN REVIEW NEEDED: Race condition handling may need strengthening with database-level locks -->

### Phase 5: Organization & Filtering

**Scope**:
- Tag and folder system using description field
- Advanced multi-criteria filtering
- Alphabetical and author-based grouping
- Search across names, descriptions, and tags

**Duration**: Approximately 2 weeks

**Key Milestones**:
1. Tag/folder encoding in file_description (`~#tag ~@folder ~^elevatedfolder`)
2. Client-side parsing and display of tags/folders
3. Grouping UI with collapsible folder headers
4. Advanced filter builder with AND/OR logic
5. Real-time filter application on file list

**Technical Challenges**:
- Special character encoding in descriptions without breaking freeform text - settled on tilde prefix
- Efficient client-side filtering for 500+ files - implemented incremental DOM updates
- Filter persistence across sessions - stored in window._toolStates

### Phase 6: Template System & Metadata

**Scope**:
- JSON-based feature templates
- Template designer UI
- Auto-incrementing fields with collision detection
- Template enforcement on backend

**Duration**: Approximately 2-3 weeks

**Key Milestones**:
1. Template JSON schema design
2. Template storage in user_files.template column
3. Visual template designer in file edit modal
4. Backend _templateConform() validation function
5. Incrementer field logic with duplicate prevention

**Technical Challenges**:
- Incrementer collision detection during edits - required scanning all features in file
- Template validation errors communicated to client - developed error response format
- Preserving non-template properties during enforcement - implemented selective field merging

### Phase 7: Import/Export & Interoperability

**Scope**:
- GeoJSON import with file upload
- Export to GeoJSON, KML, SHP formats
- Coordinate system transformation
- Metadata preservation in exports

**Duration**: Approximately 2 weeks

**Key Milestones**:
1. File upload UI with drag-and-drop
2. GeoJSON parsing and feature insertion
3. tokml library integration for KML export
4. shp-write integration for shapefile generation
5. proj4-to-WKT conversion for .prj files

**Technical Challenges**:
- KML timestamp field mapping from template - required template introspection
- Shapefile .prj generation - called /api/proj42wkt endpoint
- Preserving MMGIS metadata in roundtrip export/import - embedded _metadata in GeoJSON

### Phase 8: Specialized Plugins

**Scope**:
- Geologic symbology plugin
- Set operations plugin (boolean geometry operations)
- Science intent plugin (planned, not fully implemented)
- MTTTT plugin (planned, not implemented)

**Duration**: Approximately 2-3 weeks per plugin

**Key Milestones** (Geologic Plugin):
1. FGDC geologic pattern library integration
2. SVG pattern rendering in Leaflet
3. Geologic line symbolization (contacts, faults, boundaries)
4. Pattern configuration UI in style editor
5. Legend generation for geologic units

**Technical Challenges**:
- SVG pattern rendering performance with 100+ polygon features - implemented pattern caching
- Pattern coordinate system scaling - required transform matrix calculations
- Color mapping for geologic unit codes - built lookup table from FGDC standards

## API Design Strategy

### RESTful Principles with GeoSpatial Extensions

The API followed REST conventions while accommodating spatial operations:

**Resource Model**:
- `/api/files` - File (container) resources
- `/api/draw` - Feature (geometry) resources
- `/api/publish` - Publishing (aggregation) resources

**Verb Mapping**:
- `POST /files/get` - List files (not GET due to body filters)
- `POST /files/getfile` - Retrieve file (POST due to time/filter params)
- `POST /files/make` - Create file
- `POST /files/change` - Update file metadata
- `POST /files/remove` - Delete file
- `POST /draw/add` - Create feature
- `POST /draw/edit` - Update feature geometry/properties
- `POST /draw/remove` - Delete feature
- `POST /draw/merge` - Spatial operation (multi-feature input)
- `POST /draw/split` - Spatial operation (feature + line input)
- `POST /draw/undo` - Temporal operation (revert to timestamp)

**Response Format**:
```json
{
  "status": "success" | "failure",
  "message": "Human-readable description",
  "body": { ... } // Operation-specific data
}
```

### Spatial Operation Patterns

All spatial operations followed this pattern:

1. **Validate Permissions** - Check user owns/can-edit file
2. **Execute PostGIS Query** - Perform geometric operation
3. **Create New Features** - Insert results into user_features
4. **Update History** - Record operation in file_histories
5. **Broadcast Change** - Trigger websocket event
6. **Return IDs** - Send new feature IDs to client

Example (Merge Operation):
```javascript
// 1. Validate
Files.findOne({ where: { id: file_id, file_owner: req.user } })

// 2. Execute PostGIS
sequelize.query(`
  SELECT ST_AsGeoJSON(ST_BUFFER(ST_UNION(...), -0.000001))
  FROM user_features WHERE id IN (:ids)
`)

// 3. Create New Features
Features.create({ file_id, geom: mergedGeom, properties: ... })

// 4. Update History
pushToHistory(Histories, file_id, [newIds], [oldIds], time, 6, req.user)

// 5. Broadcast
triggerWebhooks('drawFileChange', { id: file_id, res })

// 6. Return
res.send({ status: 'success', body: { ids: newIds } })
```

## Database Optimization Strategy

### Indexing Plan

Spatial indexes for geometry columns:
```sql
CREATE INDEX idx_userfeatures_geom ON user_features USING GIST(geom);
```

Foreign key indexes for joins:
```sql
CREATE INDEX idx_userfeatures_file_id ON user_features(file_id);
CREATE INDEX idx_filehistories_file_id ON file_histories(file_id);
```

Temporal query indexes:
```sql
CREATE INDEX idx_filehistories_time ON file_histories(file_id, time);
CREATE INDEX idx_userfeatures_extant ON user_features(file_id, extant_start, extant_end);
```

### Query Optimization Patterns

**Feature Retrieval**:
```sql
-- Get active features for file
SELECT id, properties, ST_AsGeoJSON(geom) AS geojson_geom
FROM user_features
WHERE file_id = :file_id
  AND (extant_end IS NULL OR extant_end > :time)
  AND (trimmed_at_final IS NULL OR trimmed_at_final < :time)
```

**Historical Reconstruction**:
```sql
-- Get features that existed at timestamp
SELECT uf.* FROM user_features uf
JOIN file_histories fh ON fh.file_id = uf.file_id
WHERE fh.file_id = :file_id
  AND fh.time <= :time
  AND uf.id = ANY(fh.history)
ORDER BY fh.time DESC LIMIT 1
```

**Spatial Intersection**:
```sql
-- Find features intersecting with new geometry
SELECT id FROM user_features
WHERE file_id = :file_id
  AND ST_INTERSECTS(geom, ST_GeomFromGeoJSON(:new_geom))
  AND id IN (:active_history)
```

## Frontend Architecture Patterns

### Component Communication

The DrawTool used a centralized state pattern with event-driven updates:

```javascript
// Central state in DrawTool.js
DrawTool = {
  files: [],
  filesOn: [],
  currentFileId: null,
  // ... other state
}

// Sub-components initialized with reference to parent
DrawTool_Files.init(DrawTool)

// Sub-components called parent methods
DrawTool.populateFiles()
DrawTool.refreshFile(fileId)

// Parent delegated to sub-components
DrawTool.populateFiles = Files.populateFiles
DrawTool.populateHistory = History.populateHistory
```

### UI Update Patterns

**Immediate Feedback**:
```javascript
// User clicks draw polygon
Map_.map.on('draw:created', (e) => {
  // 1. Immediately add to map
  let layer = e.layer
  layer.addTo(Map_.map)

  // 2. Send to server
  calls.api('draw_add', { geometry, file_id }, (response) => {
    // 3. Update layer with server-assigned ID
    layer.feature.properties._.id = response.body.id

    // 4. Refresh file to get any server-side modifications
    DrawTool.refreshFile(file_id)
  })
})
```

**Bulk Operations**:
```javascript
// Select multiple features, click merge
$('#mergeButton').on('click', () => {
  let selectedIds = DrawTool.contextMenuLayers.map(l => l.feature.properties._.id)

  // Show loading spinner
  showSpinner()

  calls.api('draw_merge', { file_id, ids: selectedIds }, (response) => {
    hideSpinner()

    // Clear selection
    DrawTool.contextMenuLayers = []

    // Refresh file to show merged result
    DrawTool.refreshFile(file_id, null, true)
  })
})
```

### Leaflet Layer Management

Features stored in hierarchical layer groups:

```javascript
L_.layers.layer = {
  'DrawTool_123': [           // File ID 123
    L.geoJSON(feature1),      // Feature layers
    L.geoJSON(feature2),
    LayerGeologic.marker(f3), // Custom layer types
    L.divIcon(annotation)     // Annotation divs
  ],
  'DrawTool_456': [...]       // File ID 456
}

// Refresh = remove all + re-add
for (let layer of L_.layers.layer['DrawTool_123']) {
  Map_.rmNotNull(layer)
}
L_.layers.layer['DrawTool_123'] = []

// Then add fresh from server data
```

## Security Implementation

### Permission Validation Pattern

Every mutating endpoint used this validation sequence:

```javascript
router.post('/edit', async (req, res) => {
  // 1. Get user's groups
  let groups = req.groups ? Object.keys(req.groups) : []

  // 2. Find file with permission check
  let file = await Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },                              // Owner
        { file_owner: 'group',
          file_owner_group: { [Op.overlap]: groups } },        // Group member
        { public: '1', publicity_type: 'all_edit' },          // Public all-edit
        { public: '1', publicity_type: 'list_edit',
          public_editors: { [Op.contains]: [req.user] } }      // Listed editor
      ]
    }
  })

  if (!file) return res.send({ status: 'failure', message: 'Access denied' })

  // 3. Proceed with operation
  // ...
})
```

### Input Sanitization

Geometry inputs validated before PostGIS operations:

```javascript
// Parse and validate GeoJSON
let geom = JSON.parse(req.body.geometry)

// Add explicit CRS to prevent ambiguity
geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } }

// Let PostGIS validate structure
sequelize.query(`SELECT ST_IsValid(ST_GeomFromGeoJSON(:geom))`, {
  replacements: { geom: JSON.stringify(geom) }
})
```

Properties sanitized in template enforcement:

```javascript
// Remove server-internal metadata
delete properties['_']

// Validate template fields if template exists
if (template) {
  properties = validateAgainstTemplate(properties, template)
}
```

## Testing Strategy

### Parallel Test Environment

Implemented complete duplicate schema for testing:

```javascript
// Development tables
Userfiles = sequelize.define('user_files', ...)
Userfeatures = sequelize.define('user_features', ...)
Filehistories = sequelize.define('file_histories', ...)

// Test tables
UserfilesTEST = sequelize.define('user_files_tests', ...)
UserfeaturesTEST = sequelize.define('user_features_tests', ...)
FilehistoriesTEST = sequelize.define('file_histories_tests', ...)

// Route to appropriate table based on test flag
let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles
```

### Test Cleanup

```javascript
// POST /api/draw/clear_test endpoint
sequelize.query('TRUNCATE TABLE "user_features_tests" RESTART IDENTITY')
sequelize.query('TRUNCATE TABLE "file_histories_tests" RESTART IDENTITY')
sequelize.query('TRUNCATE TABLE "user_files_tests" RESTART IDENTITY')

// Recreate master files
makeMasterFilesTEST(leadGroupName, callback)
```

## Integration Points

### Authentication System
- Relied on `req.user` from session middleware
- Used `req.groups` for group-based permissions
- Checked `mmgis-group` membership for lead features
- Validated long-term tokens for API access

### Websocket System
- Called `triggerWebhooks('drawFileChange', { id, res })` after mutations
- Clients listened for event and refetched affected files
- No direct websocket message sending from draw module

### Layer Management
- Registered layers with `L_.layers.layer[layerId]`
- Participated in visibility cutoff system via `L_.enforceVisibilityCutoffs()`
- Maintained layer order with `DrawTool.maintainLayerOrder()`

### Globe Rendering
- Pushed features to Globe via `Globe_.litho.addLayer('clamped', ...)`
- Normalized geologic patterns to flat fills for 3D (no pattern support)
- Removed layers with `Globe_.litho.removeLayer('camptool_' + layerId)`

## Deployment Considerations

### Database Migrations

Implemented via `up()` functions in models:

```javascript
// userfiles.js
const up = async () => {
  await sequelize.query(`
    ALTER TABLE user_files
    ADD COLUMN IF NOT EXISTS template json NULL
  `)
  await sequelize.query(`
    ALTER TABLE user_files
    ADD COLUMN IF NOT EXISTS publicity_type varchar(255) NULL
  `)
  // ... more migrations
}

module.exports = { Userfiles, UserfilesTEST, up }
```

Called during server startup:
```javascript
// In server initialization
const { up: upUserfiles } = require('./API/Backend/Draw/models/userfiles')
const { up: upFilehistories } = require('./API/Backend/Draw/models/filehistories')

await upUserfiles()
await upFilehistories()
```

### Data Migration Scripts

No explicit migration scripts implemented. Recommendations:

1. **Add Author to Existing History**: Backfill `file_histories.author` with file owner
2. **Migrate Old Templates**: Convert any legacy template formats to new schema
3. **Rebuild Spatial Indexes**: `REINDEX INDEX idx_userfeatures_geom;`

### Backup Considerations

Critical data to preserve:
- `user_files` - File metadata and templates
- `user_features` - All feature geometries and properties
- `file_histories` - Complete edit history

Less critical:
- Test tables (can be recreated)
- Session tables (ephemeral)

## Lessons Learned

### What Worked Well

1. **PostGIS for Spatial Operations** - Offloading complexity to database paid dividends
2. **Modular Component Structure** - Separate files for Drawing/Editing/Files/History kept code maintainable
3. **Soft-Delete Architecture** - Preserved data integrity and enabled powerful undo features
4. **File-Based Organization** - Natural grouping for mission workflows
5. **Template System** - Provided structure without over-constraining users

### What Could Be Improved

1. **Conflict Resolution** - Last-write-wins led to data loss in concurrent editing scenarios
2. **History Storage** - Array-of-IDs approach became inefficient for large files
3. **Permission Model Complexity** - OR-based permission queries difficult to reason about and optimize
4. **Frontend State Management** - Global DrawTool object grew unwieldy; Redux/Vuex would help
5. **Error Handling** - Many error cases silently failed rather than providing user feedback

### Technical Debt Incurred

1. **No Operation Locking** - Race conditions possible with rapid concurrent edits
2. **Unbounded History Growth** - No archival or pruning strategy implemented
3. **Client-Side Caching** - Aggressive caching led to stale data after websocket events
4. **Hardcoded Intent Types** - ENUM in database prevented runtime configuration
5. **Undo All-or-Nothing** - Undo reverted entire file rather than single operation

<!-- HUMAN REVIEW NEEDED: Which technical debt items should be prioritized for future development cycles? -->

---

*This implementation plan documents the approach used to build the Vector Drawing & Collaboration feature as reflected in the codebase.*
