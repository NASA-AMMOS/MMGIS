# Administrative Tools Feature Specification

## Overview

The MMGIS Administrative Tools feature is a comprehensive web-based configuration and management interface that enables administrators to configure, manage, and maintain MMGIS missions, layers, tools, users, and system resources. This feature was implemented as a React-based single-page application (SPA) that provides a centralized administrative hub for all MMGIS system management tasks.

## Feature Status

**Status**: COMPLETED (Retrospective Documentation)

This feature has been fully implemented and is currently in production use.

## Architecture

### Technology Stack

The Administrative Tools interface was built using the following technologies:

- **React 17.0.2**: Core UI framework
- **Redux Toolkit 2.0.1**: State management
- **Material-UI (MUI) 5.15.1**: Component library and design system
- **React Router DOM 6.22.3**: Client-side routing
- **React Beautiful DnD 13.1.1**: Drag-and-drop functionality for layer management
- **CodeMirror**: JSON and code editing
- **Leaflet 1.9.4**: Map preview functionality

### Application Structure

```
configure/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Main/           # Main layout container
│   │   ├── Panel/          # Left navigation panel
│   │   ├── SaveBar/        # Configuration save toolbar
│   │   ├── Tabs/           # Mission configuration tabs
│   │   │   ├── Home/       # Mission overview
│   │   │   ├── Layers/     # Layer management
│   │   │   ├── Tools/      # Tool configuration
│   │   │   ├── Coordinates/# Coordinate system config
│   │   │   ├── Time/       # Temporal configuration
│   │   │   └── UserInterface/ # UI customization
│   │   └── ColorButton/    # Color picker component
│   ├── pages/              # Full-page views
│   │   ├── Users/          # User management
│   │   ├── Datasets/       # Dataset management
│   │   ├── GeoDatasets/    # Geographic dataset management
│   │   ├── APITokens/      # API token management
│   │   ├── APIs/           # API documentation
│   │   ├── WebHooks/       # Webhook configuration
│   │   ├── STAC/           # STAC catalog management
│   │   └── GeneralOptions/ # System-wide settings
│   ├── core/               # Core utilities
│   │   ├── Configure.js    # Root component
│   │   ├── ConfigureStore.js # Redux store
│   │   ├── calls.js        # API client
│   │   ├── Maker.js        # Dynamic form generator
│   │   └── utils.js        # Utility functions
│   └── metaconfigs/        # Configuration schemas
├── public/                 # Static assets
└── build/                  # Production build output
```

## Core Features

### 1. Mission Management

The mission management system allows administrators to create, configure, clone, and delete MMGIS missions.

**Implemented Capabilities**:

- **Mission Creation**: Create new missions with initial configuration templates
- **Mission Selection**: Browse and select missions from a sorted list in the left panel
- **Mission Configuration**: Full CRUD operations on mission configurations
- **Configuration Versioning**: Track and restore previous configuration versions
- **Export/Import**: Download and upload configuration JSON files
- **Mission Cloning**: Duplicate existing missions with all their configurations
- **Mission Deletion**: Remove missions with confirmation dialogs

**Technical Implementation**:

The mission list is displayed in the left panel (`Panel.js`) with real-time permission checking. Each mission configuration is loaded via the `get` API endpoint and stored in Redux state. Changes are tracked and can be saved or discarded via the SaveBar component.

### 2. Layer Management

The layer management interface provides a hierarchical, drag-and-drop system for organizing map layers.

**Implemented Layer Types**:

- **Header**: Organizational containers for grouping layers
- **Data**: Database-backed vector data layers
- **Vector**: GeoJSON and feature-based layers
- **Query**: Dynamic query-based layers
- **Tile**: Raster tile layers
- **Vector Tile**: Vector tile layers
- **Model**: 3D model layers
- **Velocity**: Vector field/wind data layers
- **Image**: Single image overlays
- **Video**: Video overlay layers

**Layer Management Features**:

- **Drag-and-Drop Reordering**: Visual layer hierarchy management using react-beautiful-dnd
- **Indentation Control**: Nested layer organization up to 12 levels deep
- **Visual Indicators**: Icons showing layer visibility and temporal configuration
- **Layer Modal**: Comprehensive configuration dialog for each layer type
- **Add Layer at Position**: Insert new layers at any position in the hierarchy
- **Layer Properties**: Configure visibility, styling, data sources, and behavior

**Technical Implementation**:

Layers are stored in a hierarchical structure with sublayers. The `Layers.js` component flattens this structure for rendering and drag-drop operations, then reconstructs the hierarchy when changes are saved. Each layer type has its own configuration schema defined in metaconfigs.

### 3. Tool Configuration

The tool configuration system manages MMGIS analysis and interaction tools.

**Tool Management Features**:

- **Visual Tool Cards**: Grid-based display of all available tools
- **On/Off Toggle**: Enable or disable tools per mission
- **Tool Configuration**: Customize tool behavior and appearance via modal dialogs
- **Custom Tool Support**: Plugin system for adding custom tools
- **Tool Icons**: Customizable Material Design Icons for each tool
- **Tool Descriptions**: Built-in help text for each tool

**Technical Implementation**:

Tool configurations are loaded from two sources:
1. Core tool configs in `src/essence/Tools/{TOOL}/config.json`
2. Mission-specific tool settings in the mission configuration

The `Tools.js` component displays all available tools as cards. Clicking a card opens a `ToolModal` with dynamically generated forms based on the tool's metaconfiguration.

### 4. User Management

Comprehensive user account and permission management system.

**User Management Features**:

- **User CRUD**: Create, read, update, and delete user accounts
- **Role Assignment**: Three-tier permission system
  - **SuperAdmin (111)**: Full system access to all missions
  - **Admin (110)**: Access to assigned missions only
  - **User (100+)**: Limited or no configuration access
- **Mission Assignment**: Assign admins to specific missions
- **Password Management**: Reset user passwords
- **User Table**: Sortable, paginated list of all users
- **Authentication Display**: Shows current AUTH mode (off, none, local, csso)

**Permission Model**:

The permission system uses a three-digit code:
- First digit: SuperAdmin privileges (1) or not (0)
- Second digit: Admin privileges (1) or not (0)
- Third digit: Currently reserved (typically 0)

SuperAdmins can manage all missions and users. Admins can only manage missions they are explicitly assigned to. The `Panel.js` component enforces these permissions by disabling mission selection for unauthorized missions.

**Technical Implementation**:

User data is stored in a database and accessed via the `account_entries` API endpoint. The `Users.js` page displays users in a Material-UI table with sorting, pagination, and action buttons for each user.

### 5. Dataset Management

System for managing tabular and geographic datasets that can be linked to vector layers.

**Dataset Management Features**:

- **Dataset Creation**: Upload CSV, JSON, or other tabular data
- **Dataset Updates**: Replace or append to existing datasets
- **Dataset Download**: Export datasets as JSON
- **Usage Tracking**: View which layers use each dataset
- **Dataset Deletion**: Remove unused datasets
- **Last Updated Timestamps**: Track dataset modifications

**Technical Implementation**:

Datasets are stored separately from layer configurations and linked via layer configuration. The `Datasets.js` page provides a table interface for managing datasets. Each dataset tracks its "occurrences" - which missions and layers reference it.

### 6. API Management

Tools for managing API access and documentation.

**API Management Features**:

- **API Tokens**: Generate and manage JWT tokens for API access
- **Token Permissions**: Assign specific permissions to each token
- **Token Expiration**: Configure token lifetime
- **API Documentation**: In-app API reference and examples
- **Token Revocation**: Delete tokens to revoke access

### 7. Webhook Configuration

System for triggering HTTP requests on specific MMGIS events.

**Webhook Features**:

- **Event-Based Triggers**: Configure webhooks for specific actions
  - DrawFileAdd
  - DrawFileChange
  - DrawFileDelete
- **HTTP Method Support**: GET, POST, PUT, DELETE, PATCH
- **Variable Injection**: Dynamic URL and body content with template variables
- **Custom Headers**: Configure request headers
- **Request Body**: JSON body configuration with variable substitution

**Available Webhook Variables**:
```
{created_on}, {efolders}, {file_description}, {file_id}, {file_name},
{file_owner}, {file_owner_group}, {folders}, {geojson}, {hidden},
{intent}, {is_master}, {public}, {public_editors}, {publicity_type},
{raw_file_description}, {tags}, {template}, {updated_on}
```

### 8. System Configuration

#### Coordinate System Configuration

- **Projection Settings**: Support for custom projections and CRS
- **EPSG Codes**: Configure projection parameters
- **Coordinate Displays**: Multiple coordinate format support (lat/lon, easting/northing, etc.)
- **Map Bounds**: Define valid coordinate ranges

#### Time Configuration

- **Temporal Controls**: Enable/disable time-based features
- **Time Format**: Configure time display formats
- **Time Sliders**: Configure temporal navigation controls

#### User Interface Customization

- **Theme Configuration**: Primary colors and styling
- **Panel Layout**: Configure default panel sizes and visibility
- **Viewer Selection**: Enable/disable Map, Globe, or Viewer panels
- **Logo and Branding**: Customize MMGIS appearance

#### General Options

- **STAC/TiTiler Settings**: Configure COG mosaicking parameters
  - Item Limit: Max items per tile (default: 100)
  - Scan Limit: Max items to search (default: 10000)
  - Time Limit: Request timeout in seconds (default: 5)

### 9. GeoDataset Management

System for managing geographic data files that can be served by MMGIS.

**Features**:
- File upload and management
- Spatial data organization
- Layer linkage tracking

<!-- HUMAN REVIEW NEEDED: What specific geospatial file formats are supported? What are the size limits? -->

### 10. STAC Catalog Management

Integration with SpatioTemporal Asset Catalog (STAC) for cloud-optimized geospatial data.

**Features**:
- STAC collection browsing
- STAC item search and filtering
- TiTiler integration for COG rendering
- Dynamic layer creation from STAC assets

## User Interface Design

### Navigation Structure

The interface uses a two-panel layout:

**Left Panel (220px width)**:
- MMGIS logo and version display
- Version mismatch warnings
- New Mission button (SuperAdmins only)
- Scrollable mission list
- Bottom navigation buttons for system pages

**Right Panel (Remaining width)**:
- Top bar with navigation tabs and user controls
- Main content area
- Context-specific modals and dialogs

### Tab-Based Mission Configuration

When a mission is selected, six tabs become available:

1. **Home**: Mission overview, configuration export/import, version history
2. **Layers**: Hierarchical layer management with drag-and-drop
3. **Tools**: Grid of tool cards with configuration modals
4. **Coordinates**: Coordinate system and projection settings
5. **Time**: Temporal configuration options
6. **User Interface**: Theme and layout customization

### System Pages

Accessed from the bottom of the left panel:

- GeoDatasets
- Datasets
- STAC (conditional on WITH_STAC environment variable)
- API Tokens
- APIs
- Webhooks
- General Options
- Users

### Dynamic Form Generation

The `Maker.js` component generates forms dynamically from JSON metaconfigurations. This approach provides:

- **Consistency**: Uniform UI across all configuration screens
- **Maintainability**: Configuration schemas separate from UI code
- **Extensibility**: New fields can be added without UI changes
- **Validation**: Built-in type checking and constraints

**Supported Form Components**:
- Text input
- Number input (with min/max/step)
- Dropdown select
- Switch/checkbox
- Color picker
- Markdown editor
- JSON editor
- Text array
- Object array (repeating groups)
- Slider
- Map preview

### Real-Time Collaboration

**WebSocket Integration**:

The configuration interface includes real-time collaboration features via WebSocket:

- **Configuration Locking**: Prevents simultaneous editing conflicts
- **User Presence**: Shows which users are editing which missions
- **Change Notifications**: Alerts when others make changes
- **Auto-Refresh**: Updates UI when remote changes occur

**Implementation**: The `Websocket.js` component maintains a persistent connection to the server and dispatches Redux actions based on received events.

### Version Control

**Configuration History**:

Every saved configuration is versioned:

- **Version List**: Chronological list of all configuration versions
- **Version Comparison**: See what changed between versions
- **Version Restore**: Roll back to any previous version
- **Current Version Indicator**: Highlights the active configuration

**Technical Implementation**: The `Versions.js` component displays version history from the `versions` API endpoint. Each version includes timestamp, user, and change description.

### Save Mechanism

**Save Bar Component**:

The `SaveBar.js` component provides:

- **Unsaved Changes Indicator**: Shows when configuration has been modified
- **Save Button**: Commits changes to the database
- **Revert Button**: Discards unsaved changes
- **Preview Button**: Opens mission in iframe to preview changes
- **Status Messages**: Success/error feedback via snackbar

**Save Process**:
1. User modifies configuration (tracked in Redux)
2. SaveBar appears with unsaved indicator
3. User clicks Save
4. Configuration sent to `update` API endpoint
5. New version created in database
6. Success message displayed
7. Configuration lock released

## Security and Permissions

### Authentication Integration

The administrative interface integrates with MMGIS's authentication system:

**AUTH Modes**:
- **off**: No authentication, no user management
- **none**: Optional authentication, allows guest access
- **local**: Required authentication with local user database
- **csso**: Cloud Single Sign-On external authentication

### Permission Enforcement

**Client-Side**:
- Mission list filters based on user permissions
- Disabled UI elements for unauthorized actions
- Role-based feature visibility

**Server-Side**:
- All API endpoints validate user permissions
- SuperAdmin checks for sensitive operations
- Mission-specific permission validation

### Mission-Level Permissions

Admins can be assigned to specific missions:

```javascript
// Example user permissions object
{
  permission: "110",  // Admin
  missions_managing: ["Mars2020", "Europa"]
}
```

This admin can only edit the Mars2020 and Europa missions. SuperAdmins (permission "111") can edit all missions.

## API Integration

### Core API Endpoints

The configure interface communicates with the backend via the following API endpoints (implemented in `calls.js`):

**Mission Management**:
- `GET /api/missions` - List all missions
- `GET /api/get?mission={name}` - Get mission configuration
- `POST /api/update` - Save mission configuration
- `GET /api/versions?mission={name}` - Get version history
- `POST /api/create` - Create new mission
- `POST /api/delete` - Delete mission
- `POST /api/clone` - Clone mission

**User Management**:
- `GET /api/account_entries` - List all users
- `GET /api/user_permissions` - Get current user permissions
- `POST /api/account_create` - Create user
- `POST /api/account_update` - Update user
- `POST /api/account_delete` - Delete user
- `POST /api/account_reset_password` - Reset user password

**Dataset Management**:
- `GET /api/datasets_entries` - List datasets
- `POST /api/datasets_create` - Create dataset
- `POST /api/datasets_update` - Update dataset
- `GET /api/datasets_download?layer={name}` - Download dataset
- `POST /api/datasets_delete` - Delete dataset

**System Configuration**:
- `GET /api/get_generaloptions` - Get system options
- `POST /api/update_generaloptions` - Update system options
- `GET /api/webhooks_entries` - Get webhooks
- `POST /api/webhooks_save` - Save webhooks
- `GET /api/getToolConfig` - Get tool configuration templates

**Authentication**:
- `POST /api/logout` - Sign out user

### API Client Implementation

The `calls.js` module provides a wrapper around fetch with:
- Automatic error handling
- Request/response interceptors
- Success and error callbacks
- Global error messaging

Example usage:
```javascript
calls.api(
  "missions",
  null,
  (res) => {
    // Success callback
    dispatch(setMissions(res.missions));
  },
  (res) => {
    // Error callback
    dispatch(setSnackBarText({
      text: res?.message || "Failed to get missions.",
      severity: "error",
    }));
  }
);
```

## Configuration Schema System

### MetaConfig Architecture

The configuration system uses "metaconfigs" - JSON schemas that define form layouts and validation rules. These schemas drive the dynamic form generation in `Maker.js`.

**MetaConfig Structure**:
```json
{
  "rows": [
    {
      "name": "Section Name",
      "description": "Section description",
      "components": [
        {
          "field": "path.to.field",
          "name": "Field Label",
          "description": "Help text",
          "type": "text|number|dropdown|switch|...",
          "width": 12,
          "...": "type-specific properties"
        }
      ]
    }
  ]
}
```

**Field Path Notation**:

The `field` property uses dot notation to specify where in the configuration object the value should be stored:

- `projection.epsg` → `config.projection.epsg`
- `look.primarycolor` → `config.look.primarycolor`
- `temp.webhooks` → `config.temp.webhooks`

For nested components (like objectarray), field paths are relative to the parent object.

**Component Width System**:

Layout uses a 12-column grid. Components specify width as a number 1-12:
- width: 12 = full row
- width: 6 = half row
- width: 4 = third row
- width: 3 = quarter row

Components automatically wrap to the next row when the total width exceeds 12.

### Layer MetaConfigs

Each layer type has its own metaconfiguration defining available properties:

**Location**: `/configure/src/metaconfigs/layer-{type}-config.json`

Example layer types:
- layer-header-config.json
- layer-vector-config.json
- layer-tile-config.json
- layer-model-config.json

### Tool MetaConfigs

Tool configurations can be defined in two places:

1. **Core Tool Config**: `/src/essence/Tools/{TOOL}/config.json`
2. **Plugin Tool Config**: Custom tools in plugin directories

Each tool config includes:
- `defaultIcon`: Material Design Icon name
- `description`: Short description
- `descriptionFull`: Detailed information
- `config`: Form configuration using metaconfigs structure

### Tab MetaConfigs

System-level tabs have metaconfigs in `/configure/src/metaconfigs/`:
- tab-home-config.json
- tab-coordinates-config.json
- tab-time-config.json
- tab-userinterface-config.json

## Build and Deployment

### Development Workflow

1. Start main MMGIS backend: `npm start` from root directory
2. Make changes in `/configure` directory
3. Build configure UI: `npm run build` from `/configure` directory
4. Refresh browser to see changes

**Note**: Hot-reloading is intentionally disabled to prevent accidental development with disabled authentication.

### Build Process

```bash
cd configure
npm run build
```

Build steps:
1. React Scripts builds the SPA
2. `scripts/make-pug-index.js` converts HTML to Pug template
3. Output placed in `configure/build/`
4. Backend serves built files at `/configure` route

### Production Build

The production build:
- Minifies JavaScript and CSS
- Optimizes images and assets
- Generates source maps
- Creates a static bundle served by the Node.js backend

**Build Output**:
```
configure/build/
├── static/
│   ├── css/
│   ├── js/
│   └── media/
├── index.html
└── index.pug (generated)
```

### Version Management

**Version Display**:

The configure UI displays its version from `package.json`:
```json
{
  "version": "4.1.18-20251205"
}
```

**Version Mismatch Detection**:

The UI compares its build version with the server version (`window.mmgisglobal.VERSION`) and displays a warning if they differ:

```javascript
const buildVersion = packageJson.version;
const serverVersion = window.mmgisglobal.VERSION;
const isVersionMismatch = buildVersion && serverVersion && buildVersion !== serverVersion;
```

This helps prevent issues when the configure UI is cached but the server has been updated.

## State Management

### Redux Store Structure

```javascript
{
  core: {
    missions: [],              // List of all missions
    mission: null,             // Currently selected mission
    configuration: {},         // Current mission config
    toolConfiguration: {},     // Tool templates
    datasets: [],              // Dataset list
    userEntries: [],          // User list
    page: null,               // Current page (geodatasets, datasets, etc.)
    modal: {},                // Current modal state
    snackbar: {},             // Notification state
    lockConfig: {}            // Configuration lock state
  }
}
```

### Key Redux Actions

**Configuration Management**:
- `setMission(name)` - Select a mission
- `setConfiguration(config)` - Update mission config
- `clearLockConfig()` - Release configuration lock

**UI State**:
- `setPage({ page })` - Navigate to system page
- `setModal({ name, ...props })` - Open modal dialog
- `setSnackBarText({ text, severity })` - Show notification

**Data Loading**:
- `setMissions(missions)` - Update mission list
- `setDatasets(datasets)` - Update dataset list
- `setUserEntries(users)` - Update user list

### State Persistence

Configuration changes are tracked in Redux but not persisted until explicitly saved. This allows:
- **Undo/Revert**: Discard unsaved changes
- **Validation**: Check configuration before saving
- **Preview**: Test changes without committing
- **Conflict Resolution**: Handle concurrent edits

## User Experience Features

### Responsive Design

The interface adapts to different screen sizes:
- Minimum supported width: 1280px
- Grid layouts adjust column count
- Tables paginate and scroll
- Modals center and overlay

### Accessibility

**Keyboard Navigation**:
- Tab through form fields
- Enter to submit forms
- Escape to close modals
- Arrow keys in dropdowns

**Screen Reader Support**:
- ARIA labels on interactive elements
- Semantic HTML structure
- Focus management in modals

**Visual Feedback**:
- Loading indicators for async operations
- Success/error messages
- Disabled state styling
- Hover effects on interactive elements

### Error Handling

**Client-Side Validation**:
- Required field checking
- Type validation (number, email, etc.)
- Range validation (min/max)
- Format validation (JSON, regex)

**Server Error Handling**:
- Network error detection
- API error message display
- Graceful degradation
- Retry mechanisms

**User Feedback**:
- Snackbar notifications for all operations
- Color-coded severity (success=green, error=red, warning=orange)
- Auto-dismiss after 6 seconds
- Dismiss button for manual close

### Performance Optimizations

**Code Splitting**:
- Lazy loading of modal components
- Route-based code splitting
- Dynamic imports for heavy dependencies

**Memoization**:
- React.useMemo for expensive computations
- useSelector for Redux state slicing
- React.memo for pure components

**Virtualization**:
- Paginated tables for large datasets
- Scrollable containers
- Limited initial render

**Debouncing**:
- Search input debouncing
- Resize event throttling
- Auto-save debouncing

## Testing Considerations

<!-- HUMAN REVIEW NEEDED: What testing strategy was used? Are there unit tests, integration tests, or E2E tests for the configure interface? -->

The codebase includes a test file `Configure.test.js`, suggesting Jest-based testing, but the extent of test coverage should be documented.

## Known Limitations

1. **Browser Compatibility**: Requires modern browser with ES6+ support
2. **Concurrent Editing**: WebSocket-based locking may have race conditions
3. **Large Configurations**: Performance may degrade with extremely deep layer hierarchies (>100 layers)
4. **Preview Feature**: Requires running in development browser with disabled security for iframe cross-origin access
5. **Mobile Support**: Interface is not optimized for mobile/tablet devices
6. **Offline Mode**: Requires active server connection; no offline editing capability

## Business Decisions

<!-- HUMAN REVIEW NEEDED: Why was React chosen over other frameworks? -->
<!-- HUMAN REVIEW NEEDED: Why Material-UI instead of other component libraries? -->
<!-- HUMAN REVIEW NEEDED: What drove the decision to use metaconfigs for dynamic form generation? -->
<!-- HUMAN REVIEW NEEDED: Why is hot-reloading disabled in favor of manual builds? -->
<!-- HUMAN REVIEW NEEDED: What is the maximum number of missions/users the system is designed to support? -->
<!-- HUMAN REVIEW NEEDED: Why store configurations as JSON blobs instead of normalized database tables? -->

## Future Enhancement Opportunities

Based on the implementation, potential areas for enhancement include:

1. **Real-Time Collaboration**: Enhanced multi-user editing with operational transforms
2. **Configuration Diff Viewer**: Visual comparison between configuration versions
3. **Bulk Operations**: Edit multiple layers/tools simultaneously
4. **Configuration Templates**: Pre-built mission templates for common use cases
5. **Import/Export Enhancements**: Support for partial configuration import/export
6. **Advanced Search**: Full-text search across configurations
7. **Audit Logging**: Detailed change tracking for compliance
8. **Mobile Interface**: Responsive design for tablet/mobile administration
9. **Configuration Validation**: Pre-save validation with detailed error reporting
10. **Role-Based UI**: Customize interface based on user role

## Dependencies

### Production Dependencies

Key dependencies and their purposes:

- **@mui/material**: Material Design component library
- **@reduxjs/toolkit**: Redux state management
- **react-router-dom**: Client-side routing
- **react-beautiful-dnd**: Drag-and-drop for layer management
- **@uiw/react-codemirror**: Code/JSON editing
- **@uiw/react-md-editor**: Markdown editing
- **leaflet**: Map preview functionality
- **papaparse**: CSV parsing for datasets
- **file-saver**: Client-side file downloads
- **react-color**: Color picker component
- **react-json-view**: JSON viewer/editor
- **immutable**: Immutable data structures

### Development Dependencies

- **react-scripts**: Build tooling and webpack configuration
- **cross-env**: Cross-platform environment variables

## Related Features

The Administrative Tools feature integrates with and supports:

- **Authentication System**: User login and session management
- **Mission Runtime**: Loads configurations created in admin interface
- **Tool System**: Tools configured here are loaded at runtime
- **Layer System**: Layer configurations drive map rendering
- **API System**: API tokens generated here enable programmatic access
- **WebSocket System**: Real-time collaboration and updates
- **File System**: Datasets and geodatasets managed here are served to users

## Documentation and Training

**In-App Help**:
- Inline help text for all configuration fields
- Tool descriptions and usage information
- Icon tooltips throughout interface
- Link to external documentation (https://nasa-ammos.github.io/MMGIS/)

**External Documentation**:
- README.md in `/configure` directory
- Main MMGIS documentation site
- GitHub repository (https://github.com/NASA-AMMOS/MMGIS)

## Maintenance and Support

### Configuration Backup

Administrators should regularly:
1. Export mission configurations via "Export Unsaved Config.JSON"
2. Back up the MMGIS database (contains all configurations and users)
3. Version control configuration files in external repository

### Troubleshooting

**Common Issues**:

1. **Version Mismatch Warning**: Refresh browser to clear cache
2. **Permission Denied**: Verify user has correct role and mission assignments
3. **Save Failed**: Check WebSocket connection and configuration lock status
4. **Preview Not Working**: Run in development mode with relaxed CORS
5. **Layer Not Rendering**: Verify layer configuration and data source URLs

### Monitoring

The interface provides visibility into:
- User activity (last login times)
- Dataset usage (which layers use which datasets)
- Configuration history (version timeline)
- System status (AUTH mode, version)

## Conclusion

The MMGIS Administrative Tools feature provides a comprehensive, user-friendly interface for managing all aspects of MMGIS missions and system configuration. Its architecture balances flexibility (metaconfigs, plugin tools) with consistency (dynamic form generation, Material-UI components), enabling both administrators and developers to effectively configure and extend MMGIS for their specific mission needs.

The feature successfully supports multiple concurrent missions, role-based access control, and real-time collaboration, making it suitable for multi-user, multi-mission deployment scenarios. Its modular architecture and configuration-driven approach make it maintainable and extensible for future enhancements.
