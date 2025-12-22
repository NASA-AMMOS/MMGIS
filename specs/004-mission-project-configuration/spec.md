# Mission/Project Configuration - Feature Specification

## Overview

The MMGIS Mission/Project Configuration system provides a comprehensive framework for creating, managing, and versioning mission configurations in the Multi-Mission Geographic Information System. This feature was implemented to enable administrators to define complete mission environments including map projections, layer hierarchies, tool configurations, UI customization, and time-based data visualization settings, all through both a graphical administrative interface and a robust REST API.

## Feature Description

### Core Capabilities

The configuration system enables administrators to define and manage complete mission environments through a hierarchical JSON-based configuration structure. Each mission represents a self-contained geographic information system with its own:

1. **Mission Settings (MSV)** - Core mission parameters including mission name, folder structure, site identifier, initial map view (latitude, longitude, zoom), and planetary radius specifications for proper cartographic calculations.

2. **Projection System** - Support for both Web Mercator (default) and custom projections. Custom projections can be defined using EPSG codes, Proj4 strings, tile matrix sets, and coordinate system bounds for planetary mapping scenarios.

3. **Layer Configuration** - Hierarchical layer management with support for multiple layer types (tiles, vectors, vector tiles, models, images, videos, query layers, data/DEM layers). Each layer supports comprehensive styling, visibility controls, time enablement, and metadata.

4. **Tool Configuration** - Flexible tool system allowing administrators to enable, configure, and customize interactive mapping tools. Each tool can have mission-specific variables controlling behavior, appearance, and data sources.

5. **UI Customization** - Complete control over interface appearance including colors, branding, component visibility, and layout options. Administrators can customize page names, logos, help URLs, and toggle UI components.

6. **Time System** - Optional time-based data visualization supporting temporal datasets, time sliders, and time-aware layer queries with configurable time formats and ranges.

7. **Panel Settings** - Configurable panel layouts with default widths for viewer, map, and globe panels supporting multi-panel geographic visualization workflows.

### Configuration Structure

The configuration is stored as a versioned JSON document with the following top-level structure:

```json
{
  "msv": { /* Mission-Site-View settings */ },
  "projection": { /* Projection and coordinate system */ },
  "look": { /* UI appearance and branding */ },
  "panelSettings": { /* Panel layout configuration */ },
  "panels": { /* Panel visibility flags */ },
  "time": { /* Time system configuration */ },
  "tools": [ /* Array of enabled tools */ ],
  "layers": [ /* Hierarchical layer configuration */ ]
}
```

### Layer System

#### Layer Types

The system supports eight distinct layer types, each designed for specific geospatial data visualization needs:

1. **Header** - Organizational layer for grouping other layers hierarchically. Contains `sublayers` array for nesting. Does not render data directly.

2. **Tile** - Raster tile layers supporting TMS, XYZ, and WMTS tile formats. Supports custom tile URLs, zoom ranges, opacity, and blend modes. Can be time-enabled with URL template substitution.

3. **Vector Tile** - MVT (Mapbox Vector Tile) format supporting styled vector data with client-side styling via JSON style specifications. Supports feature querying and interactive styling.

4. **Vector** - GeoJSON, TopoJSON, and other vector formats with comprehensive styling options. Supports feature filtering, clustering, time-based data, and dynamic property-based styling.

5. **Query** - Database-backed layers with server-side spatial queries. Supports elasticsearch, PostGIS, and custom query endpoints with dynamic filtering and pagination.

6. **Model** - 3D model visualization (GLTF, OBJ, COLLADA) with position, rotation, and scale controls. Supports time-based positioning for moving objects (spacecraft, rovers).

7. **Data** - Digital Elevation Model (DEM) tile layers providing elevation data. Supports hillshading, contours, and elevation querying for analysis tools.

8. **Image** - Static georeferenced images with bounding boxes. Supports opacity, rotation, and time-based visibility.

9. **Video** - Georeferenced video overlays with bounding box placement. Supports playback controls and time synchronization.

#### Layer Properties

All non-header layers share common properties:

- **uuid** - Unique identifier auto-generated for tracking and API operations
- **name** - Display name shown in layer list and UI
- **type** - One of the layer types above
- **url** - Data source URL (can be relative or absolute)
- **initialOpacity** - Starting opacity value (0-1)
- **visibility** - Initial visibility state (true/false)
- **minZoom, maxZoom, maxNativeZoom** - Zoom level constraints
- **legend** - Path to legend CSV or inline legend definition
- **description** - Markdown-formatted layer description
- **time** - Time enablement configuration
- **controlled** - Flag for server-controlled dynamic layers
- **kind** - Special interaction behavior override

#### Hierarchical Organization

Layers can be organized hierarchically using header layers with sublayers:

```json
{
  "name": "Mars Imagery",
  "type": "header",
  "sublayers": [
    { "name": "HiRISE", "type": "tile", "url": "..." },
    { "name": "CTX", "type": "tile", "url": "..." }
  ]
}
```

This structure enables:
- Logical grouping of related layers
- Cascade visibility controls
- Organized layer panel presentation
- Permission-based layer access control

### Tool System

#### Tool Configuration

Tools are configured as an array of tool definitions, each specifying:

```json
{
  "name": "Layers",
  "icon": "layers",
  "js": "LayersTool",
  "variables": {
    "expanded": false
  }
}
```

#### Available Tools

The system ships with numerous built-in tools configurable through toolConfigs.json:

**Essential Tools:**
- **Layers** - Layer visibility and opacity controls with hierarchical organization
- **Legend** - Dynamic legend rendering from layer configurations
- **Info** - Feature property inspection and display
- **Identifier** - Pixel value querying for raster datasets

**Analysis Tools:**
- **Measure** - Distance, area, and elevation profiling
- **Viewshed** - Line-of-sight visibility analysis
- **Shade** - Solar illumination and shadow modeling
- **Isochrone** - Time-distance accessibility analysis
- **Chemistry** - Chemical composition visualization
- **Curtain** - Ground-penetrating radar cross-sections

**Drawing and Annotation:**
- **Draw** - Collaborative vector drawing with file management, templates, and multi-user support
- **Sites** - Quick navigation to predefined locations

**Advanced Tools:**
- **Animation** - Temporal animation export
- **AgentChat** - AI-assisted map interaction (plugin)
- **Analysis** - Data graphing and statistical analysis (plugin)

#### Tool Variables

Each tool can define custom variables controlling its behavior:

```json
{
  "name": "Legend",
  "js": "LegendTool",
  "variables": {
    "displayOnStart": true,
    "justification": "right",
    "showHeadersInLegend": false
  }
}
```

Tool variables are defined in metaconfigurations located in:
- `/configure/src/metaconfigs/*.json` (for tabs and global settings)
- `/src/essence/Tools/{TOOL}/config.json` (for individual tools)

### Versioning System

#### Version Management

Every configuration change creates a new immutable version:

- Versions are sequential integers starting at 0
- Each version stores complete configuration snapshot
- Versions include creation timestamp
- Users can view and restore previous versions
- No version deletion (audit trail preservation)

#### Version Operations

**Creating Versions:**
- New mission creation starts at version 0
- Each `/upsert` call increments version
- API layer operations (`/addLayer`, `/updateLayer`, `/removeLayer`) automatically version
- Clone operations start new mission at version 0

**Querying Versions:**
- `/get` endpoint returns latest version by default
- `?version=N` parameter retrieves specific version
- `/versions` endpoint lists all versions with timestamps
- `/missions` endpoint lists all available missions

### Permission System

#### Permission Levels

The configuration system integrates with the user management system's three-tier permission model:

1. **SuperAdmin (111)** - Full access to all configuration operations across all missions. Can create, edit, clone, and delete any mission.

2. **Admin (110)** - Mission-specific configuration access. Can edit configurations only for missions listed in their `missions_managing` array. Cannot create or delete missions.

3. **User (001)** - Read-only access to public mission configurations. Cannot access Configure interface or modify configurations.

<!-- HUMAN REVIEW NEEDED: Verify if there are scenarios where Users (001) need to access configuration data for client-side rendering, and if caching strategies are in place for high-traffic deployments -->

#### Mission-Specific Permissions

For Admin users, access control is enforced at the mission level:

- The `missions_managing` field (array of mission names) determines accessible missions
- Middleware `checkMissionPermission()` validates mission access on every configuration operation
- SuperAdmins bypass mission-specific checks (null missions_managing = all access)
- Long-term tokens inherit creator's mission permissions

#### Permission Enforcement

**Backend Middleware:**
- `checkMissionPermission()` on all modification endpoints
- Session and token-based authentication support
- Permission checks occur before configuration retrieval
- Unauthorized access returns 403 with descriptive error

**Frontend Controls:**
- `/user-permissions` endpoint provides permission context
- Configure UI adapts based on permission level
- Mission dropdown filters to accessible missions only
- Read-only mode for insufficient permissions

### API Endpoints

#### Core Configuration Endpoints

**GET /api/configure/get**
```javascript
// Query parameters
{
  mission: "MissionName",
  version: 5,        // Optional, defaults to latest
  full: true         // Optional, returns metadata
}

// Response
{
  status: "success",
  mission: "MissionName",
  config: { /* configuration object */ },
  version: 5
}
```

**POST /api/configure/add**
```javascript
// Body
{
  mission: "NewMission",
  config: { /* optional partial config */ },
  makedir: true     // Create Missions folder structure
}

// Creates mission at version 0
// Requires SuperAdmin (111) permission
// Mission name validated (no special chars, no leading numbers)
```

**POST /api/configure/upsert**
```javascript
// Body
{
  mission: "MissionName",
  config: { /* full configuration object */ },
  version: 3,       // Optional, edit specific version
  forceClientUpdate: true  // Optional, force WebSocket update
}

// Creates new version (version + 1)
// Validates configuration structure
// Populates missing UUIDs
// Triggers WebSocket notification if enabled
```

**POST /api/configure/clone**
```javascript
// Body
{
  existingMission: "SourceMission",
  cloneMission: "NewMission",
  hasPaths: true    // Relativize file paths to new mission
}

// Creates new mission with copied configuration
// Adjusts relative paths if hasPaths=true
// Creates new mission folder structure
```

**POST /api/configure/destroy**
```javascript
// Body
{
  mission: "MissionName"
}

// Deletes all versions of mission from database
// Renames Missions/{mission} folder to {mission}_deleted_
// Requires SuperAdmin (111) permission
// Irreversible operation
```

**GET /api/configure/missions**
```javascript
// Query parameters
{
  full: true  // Optional, include configs
}

// Response
{
  status: "success",
  missions: ["Mission1", "Mission2", ...]
}

// Or with full=true:
{
  status: "success",
  missions: [
    { mission: "Mission1", version: 5, config: {...} },
    ...
  ]
}
```

**GET /api/configure/versions**
```javascript
// Query parameters
{
  mission: "MissionName"
}

// Response
{
  status: "success",
  versions: [
    { mission: "MissionName", version: 0, createdAt: "..." },
    { mission: "MissionName", version: 1, createdAt: "..." },
    ...
  ]
}
```

**GET /api/configure/user-permissions**
```javascript
// Response for SuperAdmin
{
  status: "success",
  permission: "111",
  missions_managing: null  // null = all missions
}

// Response for Admin
{
  status: "success",
  permission: "110",
  missions_managing: ["Mission1", "Mission2"]
}
```

#### Quick Configuration Endpoints

These endpoints provide simplified interfaces for common configuration operations:

**POST /api/configure/addLayer**
```javascript
// Body
{
  mission: "MissionName",
  layer: { /* layer definition */ },
  placement: {
    path: "HeaderName",  // Optional, path to parent header
    index: 2             // Optional, insertion index
  },
  forceClientUpdate: true  // Optional
}

// Adds layer to configuration
// Supports array of layers
// Automatically generates UUIDs
// Validates for duplicate UUIDs
// Returns newlyAddedUUIDs array
```

**POST /api/configure/updateLayer**
```javascript
// Body
{
  mission: "MissionName",
  layerUUID: "existing-uuid",
  layer: { /* partial layer updates */ },
  placement: { /* optional new placement */ },
  forceClientUpdate: true
}

// Finds existing layer by UUID
// Deep merges updates with existing layer
// Removes and re-adds at optionally new position
// Preserves properties not in update object
```

**POST /api/configure/removeLayer**
```javascript
// Body
{
  mission: "MissionName",
  layerUUID: "uuid-to-remove",  // Can be array
  forceClientUpdate: true
}

// Removes layer(s) by UUID
// Supports bulk removal with array
// Returns removedUUIDs and unableToRemoveUUIDs
```

**POST /api/configure/updateInitialView**
```javascript
// Body
{
  mission: "MissionName",
  latitude: 0.0,
  longitude: 0.0,
  zoom: 5
}

// Updates msv.view array
// Only creates new version if values changed
// All parameters optional (preserves existing if omitted)
```

#### General Options Endpoints

**GET /api/configure/getGeneralOptions**
```javascript
// Response
{
  status: "success",
  options: { /* general options object */ }
}

// Returns instance-wide settings
// Single record (id: 1)
// Empty object if not set
```

**POST /api/configure/updateGeneralOptions**
```javascript
// Body
{
  options: { /* general options object */ }
}

// Upserts general options
// Requires SuperAdmin permission
// Instance-wide settings affecting all missions
```

<!-- HUMAN REVIEW NEEDED: Document what general options are available, their structure, and their purpose. Are they used for instance-wide defaults, feature flags, or other global settings? -->

### Validation System

#### Configuration Validation

The validation system (`API/Backend/Config/validate.js`) ensures configuration integrity:

**Structure Validation:**
- Verifies presence of required top-level objects (msv, layers, tools)
- Checks configuration is valid JSON
- Validates all paths are properly formed

**Layer Validation:**
- Layer name validation (not null, empty, or "undefined")
- URL validation for layer types requiring data sources
- Zoom level validation (minZoom <= maxNativeZoom <= maxZoom)
- Model parameter validation (position, rotation, scale)
- Bounding box validation for video layers
- Endpoint validation for query layers

**UUID Validation:**
- Detects duplicate UUIDs across all layers
- Validates UUID format
- Flags "bad" UUIDs that were auto-replaced
- Returns detailed error messages for duplicates

**Validation Response:**
```javascript
{
  valid: true  // or false
  errors: [
    {
      type: "error",  // or "warning"
      reason: "Descriptive message",
      invalidFields: ["layers[layer].url"]
    }
  ]
}
```

#### Auto-Correction

The validation system auto-fills missing fields with sensible defaults:

- `initialOpacity`: 1
- `visibility`: true
- `tileformat`: "tms"
- `style.className`: Generated from layer name
- Layer-specific defaults based on type

### UUID System

#### Automatic UUID Generation

The UUID system (`API/Backend/Config/uuids.js`) ensures every layer has a unique identifier:

**UUID Population:**
- Scans entire layer hierarchy
- Generates v4 UUIDs for layers without them
- Validates UUID uniqueness
- Replaces duplicate/invalid UUIDs
- Returns list of newly added UUIDs

**UUID Usage:**
- Layer identification in API operations
- Drawing tool feature references
- WebSocket update targeting
- Version control and change tracking
- Cross-configuration layer references

**UUID Preservation:**
- User-defined UUIDs preserved if valid and unique
- Cloned layers receive new UUIDs
- UUID changes tracked in API responses
- `proposed_uuid` temporary field for validation

### WebSocket Integration

#### Real-Time Configuration Updates

When WebSockets are enabled (`ENABLE_MMGIS_WEBSOCKETS=true`), configuration changes trigger real-time client updates:

**Update Flow:**
1. Configuration modification via API
2. Backend sends WebSocket message with change details
3. Connected clients receive update notification
4. Clients selectively reload affected components

**WebSocket Message Structure:**
```javascript
{
  info: {
    type: "upsert|addLayer|updateLayer|removeLayer",
    route: "config",
    id: "request-id",
    mission: "MissionName",
    layerName: "LayerName" or ["Layer1", "Layer2"]
  },
  body: { /* original request body */ },
  forceClientUpdate: true
}
```

**Update Types:**
- `upsert` - Full configuration replacement
- `addLayer` - Layer addition (includes placement info)
- `updateLayer` - Layer modification
- `removeLayer` - Layer deletion

**Client Behavior:**
- Selective reloading based on update type
- Layer UUID used for targeted updates
- Force update bypasses client-side caching
- Handles concurrent editing scenarios

### Administrative Interface

#### Configure Application Structure

The Configure interface (`/configure` route) provides a comprehensive web-based administration tool built with React:

**Main Layout:**
- Left sidebar: Mission and page navigation
- Right panel: Configuration forms and controls
- Top bar: Save, preview, and action buttons
- Bottom: Status messages and notifications

**Page Organization:**
1. **Home** - Mission settings, projection, initial view
2. **UI** - Look and feel, branding, colors
3. **Coordinates** - Coordinate system display options
4. **Time** - Temporal data configuration
5. **Layers** - Layer hierarchy management
6. **Tools** - Tool enablement and configuration
7. **Datasets** - Backend dataset management
8. **GeoDatasets** - Spatial dataset management
9. **STAC** - SpatioTemporal Asset Catalog management
10. **GeneralOptions** - Instance-wide settings
11. **Users** - User account management
12. **APITokens** - Long-term API token management
13. **WebHooks** - Webhook configuration
14. **APIs** - API documentation links

#### Form Generation System

The Configure interface uses a metaconfiguration system to generate forms dynamically:

**Metaconfiguration Structure:**
- Located in `/configure/src/metaconfigs/*.json`
- Tool-specific configs in `/src/essence/Tools/{TOOL}/config.json`
- Defines form fields, validation, layout, and defaults

**Field Types:**
- `text` - Single-line text input
- `textarea` - Multi-line text input
- `number` - Numeric input with min/max/step
- `checkbox` - Boolean toggle
- `switch` - Boolean toggle (alternate style)
- `dropdown` - Select from predefined options
- `slider` - Numeric slider with visual feedback
- `colorpicker` - Color selection with preview
- `textarray` - Comma-separated array input
- `json` - JSON editor with syntax highlighting
- `markdown` - Markdown editor with preview
- `map` - Interactive map widget
- `objectarray` - Repeating structured object editor
- `keyvalue` - Key-value pair editor
- `colordropdownarray` - Color palette selector

**Form Rendering:**
- Dynamic layout based on width allocations (12-column grid)
- Automatic validation from field definitions
- Real-time preview for visual fields
- Conditional field display based on dependencies
- Help text and descriptions for complex fields

#### Layer Management Interface

**Layer List:**
- Hierarchical tree view matching configuration structure
- Drag-and-drop reordering
- Expand/collapse headers
- Quick visibility toggles
- Layer type icons

**Layer Editor:**
- Tabbed interface for different configuration aspects
- Basic properties (name, type, URL)
- Style and appearance
- Time configuration
- Advanced settings (raw variables, legend, metadata)

**Layer Operations:**
- Add new layer (with type selection)
- Edit existing layer
- Delete layer
- Duplicate layer
- Move layer (change parent/position)
- Test layer URL

#### Tool Management Interface

**Tool List:**
- Enabled tools shown in order
- Drag-and-drop reordering
- Quick enable/disable toggles
- Tool icons and descriptions

**Tool Editor:**
- Tool-specific configuration forms
- Variable editors based on tool metaconfiguration
- Documentation links
- Preview functionality (where applicable)

#### Save and Preview System

**Save Bar:**
- Persistent save button with unsaved changes indicator
- Preview button (opens MMGIS in iframe)
- Revert changes option
- Version indicator showing current and unsaved version

**Preview Functionality:**
- Iframe embedding of MMGIS with current config
- Live preview without saving
- Side-by-side comparison mode
- Cross-origin iframe support (with proper security settings)

**Validation on Save:**
- Client-side validation before submission
- Server-side validation on API
- Error highlighting in form
- Detailed error messages
- Prevention of save with validation errors

### Configuration Storage

#### Database Schema

Configurations are stored in PostgreSQL using Sequelize ORM:

**configs Table:**
```sql
CREATE TABLE configs (
  id SERIAL PRIMARY KEY,
  mission VARCHAR NOT NULL,
  config JSON NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**Indexes:**
- (mission, version) for efficient version lookups
- mission for mission listing queries
- id DESC for latest version queries

**Query Patterns:**
- Latest version: `SELECT * FROM configs WHERE mission = ? ORDER BY id DESC LIMIT 1`
- Specific version: `SELECT * FROM configs WHERE mission = ? AND version = ?`
- All missions: `SELECT DISTINCT mission FROM configs`
- All versions: `SELECT * FROM configs WHERE mission = ? ORDER BY id ASC`

#### File System Storage

Missions can have associated file system directories:

**Directory Structure:**
```
Missions/
  {MissionName}/
    Layers/          # Layer-specific data files
    Data/            # General mission data
    config.json      # Optional static config (not used by default)
```

**File Creation:**
- Optionally created with `makedir=true` on mission creation
- Used for mission-specific static assets
- Referenced in layer URLs with relative paths
- Managed outside database (manual file management)

<!-- HUMAN REVIEW NEEDED: Clarify the relationship between database configs and optional filesystem config.json files. Are filesystem configs deprecated in favor of database storage? Are there scenarios where filesystem configs are preferred? -->

### Configuration Templates

#### Default Template

The default configuration template (`API/templates/config_template.js`) provides a minimal starting configuration:

**Template Contents:**
- Default Web Mercator projection
- Basic UI settings with standard components enabled
- Empty layers array
- Standard tool set (Layers, Legend, Info)
- Time system enabled
- Default panel configuration

**Template Usage:**
- Base for new mission creation
- Deep merged with provided config on `/add`
- Ensures all required fields present
- Provides sensible defaults for optional fields

**Customization:**
- Missions can override template values on creation
- Cloning preserves source mission's configuration
- Template updates don't affect existing missions

### Input Sanitization

#### XSS Prevention

The configuration system implements input sanitization to prevent cross-site scripting:

**Sanitization Function:**
```javascript
function sanitizeInput(input) {
  // Replaces: < > " ' &
  // With: &lt; &gt; &quot; &#x27; &amp;
}
```

**Applied To:**
- Mission names in error messages
- User-provided strings in API responses
- Dynamic content in error reporting

**Validation:**
- Mission names restricted to alphanumeric and limited special chars
- No path traversal characters (../, ..\)
- No leading numbers in mission names
- No empty or "undefined" strings

### Environment Configuration

#### Configuration-Related Environment Variables

The configuration system respects several environment variables:

**HIDE_CONFIG**
- Values: `"true"` | `"false"` (default)
- Effect: Disables all configuration modification endpoints
- Use case: Read-only production deployments
- When true, only `/get` and query endpoints available

**ENABLE_MMGIS_WEBSOCKETS**
- Values: `"true"` | `"false"` (default)
- Effect: Enables real-time configuration updates
- Requires WebSocket server setup
- Enables collaborative editing features

**WEBSOCKET_ROOT_PATH**
- Values: String path (e.g., `"/mmgis"`)
- Effect: Sets WebSocket connection path
- Falls back to ROOT_PATH if unset
- Used for proxied deployments

**ROOT_PATH**
- Values: String path (e.g., `"/api"`)
- Effect: Base path for all API routes
- Affects configuration endpoint URLs
- Used in containerized deployments

## Technical Architecture

### Backend Components

**Configuration Router** (`API/Backend/Config/routes/configs.js`)
- Express router handling all configuration endpoints
- Sequelize ORM for database operations
- Middleware integration for authentication and permissions
- WebSocket integration for real-time updates

**Configuration Model** (`API/Backend/Config/models/config.js`)
- Sequelize model defining configs table schema
- JSON field type for configuration storage
- Timestamps for audit trail
- Version field for explicit versioning

**Validation Module** (`API/Backend/Config/validate.js`)
- Pure function validating configuration structure
- Layer-specific validation rules
- UUID uniqueness checking
- Detailed error reporting

**UUID Module** (`API/Backend/Config/uuids.js`)
- UUID generation and validation
- Duplicate detection and replacement
- Tracking of newly added UUIDs
- Preservation of valid user-defined UUIDs

**Configuration Template** (`API/templates/config_template.js`)
- Default configuration structure
- Baseline settings for new missions
- Standard tool and layer setup

### Frontend Components

**Configure Application** (`configure/src/`)
- React application for configuration management
- Redux state management
- Material-UI component library
- WebSocket integration for live updates

**Core Modules:**
- `Configure.js` - Main application container
- `ConfigureStore.js` - Redux store and actions
- `Maker.js` - Dynamic form generation from metaconfigs
- `calls.js` - API client wrapper
- `utils.js` - Configuration manipulation utilities
- `validators.js` - Client-side validation
- `Websocket.js` - WebSocket client for live updates

**Pages:**
- Mission-specific pages (Home, UI, Coordinates, Time, Layers, Tools)
- System pages (Datasets, GeoDatasets, STAC, Users, Webhooks)
- API documentation page

**Components:**
- `Panel` - Left navigation sidebar
- `Main` - Right content area
- `SaveBar` - Save/preview controls
- `Tabs` - Tabbed interface manager
- `Map` - Leaflet map widget for configuration
- Form components (text fields, dropdowns, editors, etc.)

### Data Flow

#### Configuration Creation Flow

1. User clicks "New Mission" in Configure UI
2. Frontend shows mission creation form
3. User enters mission name and optionally initial settings
4. Frontend calls `POST /api/configure/add` with mission name
5. Backend validates mission name (no special chars, doesn't exist)
6. Backend deep merges any provided config with config_template
7. Backend creates Sequelize record at version 0
8. Backend optionally creates Missions/{name}/ directories
9. Backend returns success with mission name and version
10. Frontend updates mission list and navigates to new mission

#### Configuration Editing Flow

1. User selects mission from dropdown
2. Frontend calls `GET /api/configure/get?mission=X` for latest version
3. Backend queries database for highest version
4. Backend applies missionFolderName fallback logic
5. Backend returns full configuration
6. Frontend populates Redux store with configuration
7. User edits configuration via forms (updates store in real-time)
8. User clicks Save
9. Frontend calls `POST /api/configure/upsert` with complete config
10. Backend validates configuration structure and layers
11. Backend populates missing UUIDs
12. Backend detects and rejects duplicate UUIDs
13. Backend creates new version (version + 1)
14. Backend sends WebSocket message if enabled
15. Backend returns success with new version and newly added UUIDs
16. Frontend updates store with new version number
17. Other connected clients receive WebSocket update and reload

#### Layer Addition Flow

1. User clicks "Add Layer" in Layers page
2. Frontend shows layer type selection dialog
3. User selects layer type and fills form
4. User specifies placement (parent header, index)
5. Frontend calls `POST /api/configure/addLayer` with layer definition
6. Backend calls internal `get()` to fetch current config
7. Backend traverses layer tree to find placement location
8. Backend validates placement path exists
9. Backend adds `proposed_uuid` for user-defined UUIDs
10. Backend inserts layer at specified index using `Utils.setIn()`
11. Backend calls internal `upsert()` with modified config
12. Validation and UUID population occur in upsert
13. Backend returns success with new version and UUIDs
14. Frontend updates layer list
15. WebSocket notifies other clients of layer addition with UUID

### Security Considerations

#### Authentication and Authorization

**Session-Based Access:**
- Configure interface requires authenticated session
- SuperAdmin or Admin role required for access
- Session validation on every API call
- Automatic logout on permission changes

**Token-Based Access:**
- Long-term tokens support API access
- Tokens inherit creator's permissions
- Token permissions checked via `checkMissionPermission()`
- Bearer token format in Authorization header

**Mission-Level Access Control:**
- Admins restricted to missions in `missions_managing` array
- SuperAdmins have access to all missions
- Mission parameter validated on every configuration endpoint
- Unauthorized access returns 403 with message

#### Input Validation

**Mission Name Validation:**
- No special characters except underscores and hyphens
- No leading numbers
- No path traversal sequences (../)
- No empty or "undefined" strings
- Maximum length restrictions (database field size)

**Configuration Validation:**
- JSON structure validation
- Required field validation
- Type checking for all fields
- URL format validation for layer sources
- Numeric range validation for zoom levels

**SQL Injection Prevention:**
- Sequelize ORM with parameterized queries
- No raw SQL with user input
- Mission names and IDs sanitized
- Database field type constraints

**XSS Prevention:**
- Input sanitization on error messages
- Configuration stored as JSON (not rendered as HTML)
- Client-side sanitization in Configure UI
- Content Security Policy headers (configured separately)

#### Rate Limiting

The configuration endpoints are protected by the global API rate limiter:
- 20,000 requests per 5-minute window per IP
- Shared rate limit with other API endpoints
- No specific rate limit for configuration endpoints
- Configurable via environment variables

<!-- HUMAN REVIEW NEEDED: Consider if configuration endpoints need lower rate limits due to expensive operations (validation, database writes, WebSocket broadcasts). Heavy automation could cause performance issues. -->

## Business Logic and Decisions

### Mission Folder Name Fallback

**Decision:** The system implements automatic fallback logic for `missionFolderName`:

```javascript
if (config.msv.missionFolderName === "" || !config.msv.missionFolderName) {
  config.msv.missionFolderName = config.msv.mission;
}
```

**Rationale:**
- Enables missions to have display names different from folder names
- Maintains backward compatibility with older configs lacking this field
- Prevents broken file path references
- Simplifies configuration for users who want matching names

<!-- HUMAN REVIEW NEEDED: Verify the use cases for different mission vs. missionFolderName values. Are there scenarios where this distinction is critical? Should this be enforced to always match, or does the flexibility serve important purposes? -->

### Configuration Versioning Strategy

**Decision:** Every configuration change creates a new immutable version rather than updating in-place.

**Rationale:**
- Complete audit trail of all changes
- Ability to revert to any previous state
- No data loss from accidental modifications
- Support for version comparison and diff tools
- Debugging of production issues by examining historical configs

**Trade-offs:**
- Database storage grows with every change
- No built-in version pruning mechanism
- Potentially thousands of versions for active missions
- Increased query complexity for latest version lookups

<!-- HUMAN REVIEW NEEDED: Consider implementing version pruning strategy for old/archived versions. Define retention policy (e.g., keep last 100 versions, versions older than 1 year). Implement soft delete or archival mechanism. -->

### Layer UUID Generation Strategy

**Decision:** UUIDs are auto-generated for layers that don't have them, and user-provided UUIDs are validated for uniqueness.

**Rationale:**
- Stable identifiers for API operations even when layer names change
- Support for programmatic layer management via API
- Enable cross-configuration layer references
- Facilitate version control and change tracking

**Implementation Details:**
- v4 UUIDs generated server-side
- Validation occurs before database write
- Duplicate UUIDs rejected with detailed error
- `proposed_uuid` temporary field for validation
- New UUIDs returned in API response for client tracking

### Deep Merge vs. Replace Strategy

**Decision:** The `/upsert` endpoint replaces the entire configuration, while `/updateLayer` deep merges updates.

**Rationale:**
- `/upsert` provides explicit full-state control (predictable behavior)
- `/updateLayer` enables partial updates without fetching full config
- Deep merge prevents accidental property deletion
- Explicit replace prevents unintended property retention

**Trade-offs:**
- Users must understand which endpoint to use for which operation
- Deep merge can make it difficult to delete properties (must explicitly set to null)
- Replace requires full config roundtrip for small changes

### Quick API vs. Full Configuration API

**Decision:** Provide both detailed configuration APIs (`/upsert`) and simplified quick APIs (`/addLayer`, `/updateLayer`, etc.).

**Rationale:**
- Quick APIs reduce complexity for common operations
- Quick APIs handle placement logic automatically
- Quick APIs provide better error messages for specific operations
- Full API provides complete control for advanced use cases
- Supports both GUI-based and programmatic workflows

**Use Cases:**
- Quick APIs: Automated layer additions from external systems, scripts, scheduled tasks
- Full API: Configuration management tools, backup/restore systems, migration scripts

### Tool Configuration via toolConfigs.json

**Decision:** Tool metadata and form configurations are stored in a static JSON file rather than the database.

**Rationale:**
- Tool definitions are code-level constructs (tied to tool implementations)
- Tool configs change infrequently (with code releases, not mission changes)
- Avoids chicken-and-egg problem of configuring the configure interface
- Simplifies tool addition process for developers

**Trade-offs:**
- Requires application rebuild/restart to add new tools
- Cannot be modified by administrators at runtime
- Separate deployment concern from mission configurations

<!-- HUMAN REVIEW NEEDED: Consider if dynamic tool registration would be valuable for plugin-based extensions. Would a hybrid approach (core tools in file, custom tools in database) provide better flexibility? -->

### Permission Check on Every Configuration Access

**Decision:** Mission permissions are checked on every configuration operation, even reads.

**Rationale:**
- Ensures consistent security model
- Prevents information disclosure via config reading
- Supports mission-level data isolation
- Enables multi-tenant deployments

**Performance Considerations:**
- Database lookup required for each check (for Admin users)
- SuperAdmin checks bypass database lookup
- Token permissions cached in token validation
- Consider caching user permissions in session

<!-- HUMAN REVIEW NEEDED: Evaluate if permission caching in session would improve performance without compromising security. Current implementation fetches from database on every request. Consider session-based caching with TTL or invalidation on permission changes. -->

### WebSocket Updates Optional

**Decision:** Real-time configuration updates via WebSockets are optional and disabled by default.

**Rationale:**
- Not all deployments need real-time collaboration
- WebSocket infrastructure adds complexity
- Simpler deployments can rely on manual refresh
- Performance considerations for high-traffic environments

**When to Enable:**
- Multi-user configuration scenarios
- Active mission operations with frequent changes
- Demonstrations and collaborative planning sessions
- Development and testing environments

### No Configuration Locking

**Decision:** The system does not implement configuration locks or conflict resolution beyond last-write-wins.

**Rationale:**
- Versioning provides audit trail of conflicts
- WebSockets enable awareness of concurrent edits
- Locking complexity not justified for low-conflict scenarios
- Users can revert conflicting changes via version history

**Trade-offs:**
- Concurrent edits can result in lost work
- No merge conflict resolution
- No notification of concurrent editing sessions
- Users must communicate out-of-band for coordination

<!-- HUMAN REVIEW NEEDED: Evaluate if optimistic locking (version-based) would be valuable. Could add a "base version" parameter to upsert that rejects updates if versions don't match. Would add complexity but prevent silent overwrites. -->

## Dependencies

### Backend Dependencies

**Core:**
- Node.js - JavaScript runtime
- Express - Web application framework
- Sequelize - ORM for PostgreSQL
- PostgreSQL - Database for configuration storage

**Authentication:**
- express-session - Session management
- connect-pg-simple - PostgreSQL session store
- bcryptjs - Password hashing
- passport - Authentication middleware

**Utilities:**
- dotenv - Environment variable management
- deepmerge - Deep object merging
- uuid - UUID generation
- isomorphic-ws - WebSocket client/server
- ws - WebSocket implementation

### Frontend Dependencies

**Core:**
- React - UI library
- Redux - State management
- react-redux - React-Redux bindings
- Material-UI (@mui/material, @mui/styles) - Component library

**Editors:**
- @uiw/react-md-editor - Markdown editor
- @uiw/react-codemirror - Code editor
- @codemirror/lang-json - JSON syntax highlighting

**Mapping:**
- leaflet - Mapping library
- react-leaflet - React Leaflet bindings

**Utilities:**
- clsx - Conditional classNames
- js-colormaps - Color palette data

### External Services

**Optional:**
- WebSocket Server - Real-time update notifications
- Reverse Proxy - For path-based routing (ROOT_PATH)
- HTTPS Termination - TLS/SSL handling
- CDN - Static asset delivery (configure build artifacts)

## Integration Points

### User Management System

- Permissions (SuperAdmin, Admin, User) control configuration access
- `missions_managing` array determines Admin's accessible missions
- Session and token authentication for API access
- User creation affects available missions for assignment

### Layer System

- Configuration defines available layers
- Layer UUIDs used throughout system for references
- Layer time configuration drives time system
- Layer legends rendered by Legend tool

### Tool System

- Configuration enables and configures tools
- Tool variables control tool behavior
- Tools read configuration at runtime
- Tools may write back to configuration (e.g., Draw tool)

### WebSocket System

- Configuration changes broadcast to connected clients
- Clients selectively reload based on change type
- WebSocket path determined by environment configuration
- Optional integration (not required for core functionality)

### File System

- Missions can have associated directories
- Layer URLs reference mission files
- Static assets served from mission folders
- File management separate from configuration API

### External APIs

- STAC collections reference mission configurations
- Datasets and GeoDatasets linked to layers
- Webhooks triggered by configuration changes
- External tools can manage configs via API

## Testing Considerations

### Unit Testing

**Validation Module:**
- Test each layer type validation
- Test UUID duplicate detection
- Test configuration structure validation
- Test error message formatting
- Test default value population

**UUID Module:**
- Test UUID generation
- Test duplicate detection and replacement
- Test preservation of valid UUIDs
- Test proposed_uuid handling
- Test UUID tracking and reporting

**API Endpoints:**
- Test permission enforcement
- Test mission name validation
- Test version sequencing
- Test WebSocket triggering
- Test error handling and responses

### Integration Testing

**Configuration Lifecycle:**
- Create mission
- Add layers
- Update configuration
- Clone mission
- Delete mission
- Verify version history

**Permission Scenarios:**
- SuperAdmin access to all missions
- Admin access to assigned missions only
- Admin denial for unassigned missions
- Token-based access with permission inheritance

**Concurrent Access:**
- Multiple users editing different missions
- Multiple users editing same mission
- WebSocket update delivery
- Version conflict handling

### End-to-End Testing

**Configure Interface:**
- Mission creation workflow
- Layer addition and editing
- Tool configuration
- Save and preview functionality
- Form validation and error display

**API Workflows:**
- Programmatic mission creation
- Bulk layer operations
- Configuration backup and restore
- Version comparison and rollback

## Known Limitations

1. **No Configuration Locking** - Concurrent edits can result in lost work with last-write-wins behavior.

2. **No Version Pruning** - Database grows indefinitely with every configuration change.

3. **Limited Merge Conflict Resolution** - WebSockets provide awareness but no automated conflict resolution.

4. **Mission Name Immutability** - Mission names cannot be changed after creation (affects folder structure).

5. **No Configuration Diff Tool** - No built-in UI for comparing configuration versions.

6. **Limited Bulk Operations** - Layer operations are single-layer focused (though arrays are supported).

7. **No Configuration Import/Export UI** - Configuration backup/restore requires API or database access.

8. **Static Tool Registry** - New tools require code changes and application restart.

9. **No Role-Based Configuration Templates** - All new missions start from same template.

10. **Limited Configuration Search** - No full-text search across configurations or specific field queries.

<!-- HUMAN REVIEW NEEDED: Prioritize these limitations based on user feedback and operational requirements. Some may warrant feature development, others may be acceptable trade-offs. -->

## Future Enhancements

### Potential Improvements

1. **Configuration Comparison Tool** - Visual diff viewer for comparing versions and identifying changes.

2. **Configuration Locking** - Optimistic locking with version-based conflict detection.

3. **Bulk Layer Operations** - API endpoints for batch layer additions, updates, and deletions with transaction support.

4. **Configuration Templates** - Predefined configuration templates for common mission types (rover missions, orbital imaging, etc.).

5. **Configuration Search** - Full-text search across all configurations, filtering by layer properties, tool settings, etc.

6. **Version Pruning** - Automated version cleanup with configurable retention policies.

7. **Configuration Import/Export** - UI for downloading and uploading complete mission configurations.

8. **Dynamic Tool Registration** - Runtime tool addition without application restart.

9. **Configuration Validation Profiles** - Stricter validation rules for production vs. development missions.

10. **Configuration Change Notifications** - Email or webhook notifications for configuration changes.

11. **Configuration Rollback UI** - One-click rollback to previous versions from Configure interface.

12. **Layer Dependency Tracking** - Detect and warn about layers referencing deleted datasets or broken URLs.

<!-- HUMAN REVIEW NEEDED: Evaluate these enhancements against user needs and development capacity. Some may be critical for certain deployments, others may be nice-to-have features. -->

## Documentation and Resources

### API Documentation

- OpenAPI/Swagger documentation available at `/api/docs`
- Configuration endpoint documentation in API specification
- Example requests and responses for all endpoints

### User Documentation

- Configure interface includes tooltips and help text
- README in `/configure` directory for development setup
- Metaconfiguration documentation for form generation

### Developer Documentation

- Validation module inline comments
- UUID module inline comments
- Router endpoint JSDoc comments
- Tool configuration JSON schema examples

## Glossary

- **Mission** - A complete MMGIS configuration representing a geographic information system for a specific project or spacecraft mission
- **Configuration** - JSON document defining all aspects of a mission (layers, tools, UI, projection, etc.)
- **Version** - Immutable snapshot of a configuration at a point in time
- **Layer** - Data visualization element in the map (tiles, vectors, models, etc.)
- **Tool** - Interactive functionality available to users (drawing, measurement, analysis, etc.)
- **UUID** - Universally Unique Identifier assigned to each layer for stable referencing
- **MSV** - Mission-Site-View, the core settings section of a configuration
- **Header Layer** - Organizational layer that groups other layers hierarchically
- **Metaconfiguration** - JSON schema defining forms for editing configurations
- **WebSocket Update** - Real-time notification of configuration changes to connected clients
- **Quick API** - Simplified API endpoints for common operations (addLayer, updateLayer, etc.)
- **Full API** - Complete configuration replacement endpoints (upsert, clone, etc.)

---

**Document Status:** Retrospective - Feature implemented and operational
**Last Updated:** 2025-12-18
