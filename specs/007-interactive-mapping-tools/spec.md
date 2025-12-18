# Interactive Mapping Tools - Technical Specification

## Overview

The Interactive Mapping Tools system is a comprehensive plugin-based architecture that provides users with specialized geospatial analysis, measurement, drawing, and visualization capabilities. The system implements 14+ distinct tools through a unified lifecycle interface, enabling consistent integration, configuration, and user experience across diverse mapping functionalities.

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

### ToolController Integration

The `ToolController_` manages all tool plugins through:

1. **Tool Registration**: Tools are loaded from `toolModules` and `toolConfigs` exported from the build system
2. **Lifecycle Management**: Handles `make()` and `destroy()` calls based on user interaction
3. **UI Positioning**: Supports two presentation modes:
   - **Toolbar Tools**: Integrated into left-hand expandable toolbar
   - **Separated Tools**: Floating icons with independent panels (left/center/right justification)
4. **State Coordination**: Ensures only one toolbar tool active at a time; separated tools can coexist

### Configuration System

Each tool provides a `config.json` that defines:
- **Metadata**: name, description, icon, toolbar priority
- **Variables**: Runtime configuration options
- **UI Config**: Form fields for administrative configuration interface
- **Expandable**: Whether tool supports panel expansion/collapse
- **Separated Tool**: Whether tool lives outside main toolbar

## Core Tools Implemented

### 1. Draw Tool
**Purpose**: Advanced collaborative vector drawing and annotation

**Key Features**:
- Multi-geometry support (polygon, circle, rectangle, line, point, text, arrow)
- File-based organization with user ownership
- Collaborative editing with permission controls
- Drawing modes: over/under clipping, vertex resolution control, snapping
- Feature templates with custom property forms
- History tracking and undo/redo
- Import/export (GeoJSON)
- Plugin system (Geologic tools, Set Operations)

**Architecture**:
- Modular design with separate files for Drawing, Editing, Files, History, Publishing, Shapes, FileModal, Templater
- Database-backed file storage with real-time sync
- Integrated with authentication system for ownership and sharing

**Configuration Options**:
- Intent aliases (polygon types, line/point aliases)
- Default draw clipping mode
- Lead permission controls
- File visibility filters (public/private, yours/all, on/off)
- Property templates with validation, dropdowns, date pickers, auto-population from geodatasets

### 2. Measure Tool
**Purpose**: Distance measurement and elevation profiling

**Key Features**:
- Three measurement modes: segment, continuous, continuous_color
- Real-time elevation profiles from DEM data
- Multi-DEM support with layer-specific DEMs
- Line-of-sight (LOS) analysis with configurable observer/target heights
- Distance units: meters, kilometers, miles, feet
- Interactive profile charts with hover details
- Support for Map, Globe, and Viewer (image) measurements

**Architecture**:
- React-based UI with Chart.js for profile visualization
- Real-time DEM querying via GDAL API endpoints
- Leaflet layer for measurement geometry visualization

**Configuration Options**:
- Primary DEM path
- Layer-specific DEM associations
- Default measurement mode
- DEM visibility tied to layer state

### 3. Identifier Tool
**Purpose**: Real-time pixel value querying from raster datasets

**Key Features**:
- Mouse-over pixel value display
- Multi-band raster support
- Configurable significant figures and units
- Scale factors for unit conversion
- Time-enabled datasets with template substitution
- Legend-based color matching for non-file-backed layers

**Architecture**:
- Separated tool with persistent floating panel
- GDAL-powered backend for raster querying
- Layer-specific configuration with on-demand activation

**Configuration Options**:
- Per-layer URL to GeoTIFF
- Band count
- Significant figures
- Unit labels
- Scale factors
- Time format strings

### 4. Layers Tool
**Purpose**: Hierarchical layer management and visibility control

**Key Features**:
- Tree-based layer organization
- On/off toggle with opacity control
- Layer filtering and search
- Download capabilities
- Feature filtering for vector layers
- Header/sublayer grouping

**Architecture**:
- Integrated toolbar tool
- Directly interfaces with L_.layers system
- Expandable panel design

**Configuration Options**:
- Default expanded state

### 5. Legend Tool
**Purpose**: Symbology and gradient scale display

**Key Features**:
- Automatic legend rendering from layer configuration
- Support for CSV and JSON legend definitions
- Gradient scales and discrete symbologies
- Layer-synchronized visibility
- Collapsible legend items

**Architecture**:
- Separated tool (left or right justification)
- Reads legend data from layer metadata or external files
- Dynamic rendering based on active layers

**Configuration Options**:
- Display on start
- Justification (left/right)
- Show header layers in legend

### 6. Info Tool
**Purpose**: Feature property inspection

**Key Features**:
- Display GeoJSON properties of clicked features
- JSON formatting with syntax highlighting
- Alphabetical or native property ordering
- Triggered automatically by feature clicks (unless disabled by layer kind)

**Architecture**:
- Expandable toolbar tool
- Receives feature data from Map_ click events
- Integrates with layer "kinds" system to control behavior

**Configuration Options**:
- Sort alphabetically option

### 7. Curtain Tool
**Purpose**: Ground Penetrating Radar (GPR) visualization

**Key Features**:
- Vertical imagery curtains aligned under terrain
- 3D subsurface data visualization
- Integration with GPR datasets

**Architecture**:
- Specialized tool for planetary science applications
- WebGL-based rendering

**Configuration Options**:
- Credentials handling (withCredentials flag)

### 8. Viewshed Tool
**Purpose**: Real-time line-of-sight visibility analysis

**Key Features**:
- Dynamic viewshed generation from user-defined points
- DEM-based computation
- Camera presets with azimuth/elevation FOV
- Curvature compensation option
- Tileset-based DEM sources

**Architecture**:
- Client-side viewshed algorithm
- Tile-based DEM loading for performance
- WebGL rendering for visibility overlay

**Configuration Options**:
- DEM tilesets with zoom levels
- Camera presets (height, azimuth center/FOV, elevation center/FOV)
- Curvature toggle
- Default observer/target heights

### 9. Shade Tool
**Purpose**: Orbiter/sun shadow and visibility mapping

**Key Features**:
- SPICE-based spacecraft position calculation
- Shadow casting from orbiting bodies
- Time-variable shading analysis
- Observer time conversion between spacecraft and UTC

**Architecture**:
- Backend SPICE integration (ll2aerll.py, chronos.py)
- DEM tileset-based computation
- Real-time position calculation

**Configuration Options**:
- DEM tilesets
- SPICE source entities (orbiters/bodies)
- Observer spacecraft configurations
- Default height
- Time format strings

### 10. Sites Tool
**Purpose**: Quick navigation to preset locations

**Key Features**:
- Button bar for site navigation
- Preset views (lat/lon/zoom)
- Site codes that can toggle associated header layers

**Architecture**:
- Toolbar tool
- Directly interfaces with Map_ for view changes

**Configuration Options**:
- Site array (name, code, lat, lon, zoom)

### 11. Chemistry Tool
**Purpose**: Chemical composition visualization

**Key Features**:
- Chemistry percentage graphs from point data
- Integration with chemistry datasets

**Architecture**:
- Specialized tool for planetary science
- Chart-based visualization

**Configuration Options**:
- No configurable variables (dataset-driven)

### 12. Animation Tool
**Purpose**: Temporal map animation and export

**Key Features**:
- Bounding box selection for animation area
- Time range definition
- Export formats: GIF, MP4, PNG sequence
- Custom frame rates and durations

**Architecture**:
- Map canvas capture
- Frame sequencing
- Client-side or server-side encoding

**Configuration Options**:
- Enable GIF export
- Enable MP4 export
- Enable PNG export

### 13. Isochrone Tool
**Purpose**: Travel time and accessibility analysis

**Key Features**:
- Cost-based traversability modeling
- Multiple data inputs (DEM, slope, obstacles, cost, shade)
- Configurable traversal models
- Interactive path visualization
- Hover for least-cost paths

**Architecture**:
- Complex tile-based computation engine
- Multiple data source support
- Pluggable cost models
- WebWorker-based processing

**Configuration Options**:
- DEM tilesets
- Slope tilesets
- Obstacle tilesets
- Cost tilesets
- Shade tilesets
- Enabled models
- Seam interpolation settings

### 14. Kinds Tool
**Purpose**: Layer interaction behavior configuration

**Key Features**:
- Defines custom layer "kinds" (info, waypoint, chemistry_tool, draw_tool)
- Controls tool activation based on layer clicks
- Not a user-facing tool (configuration plugin)

**Architecture**:
- Plugin system for customizing layer behaviors
- Interfaces with feature click handlers

**Configuration Options**:
- No runtime configuration (code-based plugin definitions)

## Tool Lifecycle

### Initialization (make)

1. **Interface Creation**: Tool creates `interfaceWithMMGIS()` to manage communication with core
2. **DOM Setup**: Injects markup into designated container (`#toolPanel` for toolbar tools, `#toolContentSeparated_{name}` for separated tools)
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

## Integration Points

### Map_ Integration

Tools interact with the core Map_ system to:
- Add/remove Leaflet layers
- Register click/mousemove/mouseout handlers
- Pan/zoom the map programmatically
- Access map bounds and projection

### Globe_ Integration

3D-enabled tools (Measure, Draw, Identifier) integrate with Globe_ (CesiumJS) for:
- 3D feature rendering
- Globe click/hover events
- Camera control

### Viewer_ Integration

Tools supporting image-based views (Measure) integrate with Viewer_ (OpenSeadragon) for:
- Coordinate transformation
- Image click events
- Overlay rendering

### Layers_ Integration

All tools respect the layer system managed by L_:
- Check layer visibility states
- React to layer toggle events
- Filter tool behavior by active layers

### Authentication Integration

Tools with user-owned data (Draw) integrate with the authentication system:
- Check login state
- Enforce ownership and permissions
- Display user-specific data

## Backend API Integration

Many tools require backend services:

### GDAL Services
- DEM querying for elevation data (Measure, Identifier)
- Raster pixel value extraction (Identifier)
- Tile serving (Viewshed, Shade, Isochrone)

### File Management
- Draw file CRUD operations
- File sharing and permissions
- History tracking

### SPICE Services
- Spacecraft position calculation (Shade)
- Time conversion (Shade)

## Configuration Interface

The administrative configuration interface dynamically generates forms from each tool's `config.json`:

**Field Types**:
- text, number, textarea
- checkbox, dropdown
- textarray (comma-separated lists)
- objectarray (structured arrays with nested fields)

**Validation**:
- Min/max constraints
- Required fields
- Regex patterns
- Step sizes

<!-- HUMAN REVIEW NEEDED: Verify that all 14+ tools are accurately documented. Additional tools may exist that were not covered in this specification. -->

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

## Extensibility

### Creating New Tools

New tools can be added by:

1. Creating a tool directory under `src/essence/Tools/{ToolName}/`
2. Implementing the tool interface in `{ToolName}Tool.js`
3. Defining configuration in `config.json`
4. Registering the tool in the build system

### Tool Plugins

Some tools (notably Draw) support their own plugin systems for extended functionality:
- Draw supports Geologic and Set Operations plugins
- Plugins extend core tool capabilities without modifying base code

## Browser and Mobile Support

### Desktop Browsers

All tools fully support modern desktop browsers (Chrome, Firefox, Safari, Edge).

### Mobile Devices

Tools adapt to mobile:
- Toolbar tools switch to horizontal icon layout
- Touch event support
- Responsive panel sizing
- Some tools (separated tools) hidden on mobile for UI clarity

### Touch vs Mouse

Tools handle both input methods:
- Click/tap equivalence
- Hover alternatives on touch devices
- Multi-touch gestures where appropriate (pinch/zoom)

## Accessibility

<!-- HUMAN REVIEW NEEDED: Accessibility features for tools may need enhancement. Document current state and improvement roadmap. -->

Current accessibility features:
- Keyboard navigation with tabindex
- Tooltips on hover
- High-contrast compatible (CSS variable-based theming)

Areas for improvement:
- ARIA labels
- Screen reader announcements for state changes
- Keyboard shortcuts for tool actions

## Security Considerations

### Authentication-Gated Tools

Tools with user-owned data (Draw) require authentication:
- Display "Please log in" state when not authenticated
- Enforce ownership on file modifications
- Validate permissions server-side

### Input Validation

All tools validate user input:
- Numeric ranges
- String lengths
- File size limits
- Coordinate bounds

### XSS Prevention

Tools properly escape user-generated content:
- Feature properties in Info tool
- Draw file names and descriptions
- Template field values

## Testing Strategy

### Tool Tests

The Draw tool includes unit tests (`DrawTool.test.js`) demonstrating the pattern:
- Test tool initialization
- Test state management
- Test file operations
- Test validation logic

<!-- HUMAN REVIEW NEEDED: Expand testing coverage to all tools. Currently only Draw tool has comprehensive tests. -->

### Integration Tests

Tools should be tested for:
- ToolController integration
- Map/Globe/Viewer integration
- Backend API integration
- URL state persistence

## Future Enhancements

### Planned Features

1. **Tool Presets**: Save and restore tool configurations
2. **Tool Workflows**: Chain multiple tools in sequence
3. **Tool Export**: Export tool outputs to standard formats
4. **Tool Collaboration**: Real-time collaborative tool usage
5. **Tool Analytics**: Track tool usage and performance
6. **Tool Marketplace**: Community-contributed tools

<!-- HUMAN REVIEW NEEDED: Prioritize future tool enhancements based on user feedback and business goals. -->

### API Improvements

1. **Unified Tool API**: Standardize additional lifecycle hooks (onResize, onLayerChange, etc.)
2. **Tool Communication**: Enable inter-tool messaging
3. **Tool State Manager**: Centralized tool state management
4. **Tool Dependencies**: Declare and resolve tool dependencies

## Technical Debt

### Known Issues

1. Some tools (Animation, Chemistry) have minimal configuration options
2. Tool state persistence in URL is inconsistent across tools
3. Mobile support varies by tool
4. Accessibility features are incomplete
5. Testing coverage is sparse (only Draw has tests)

<!-- HUMAN REVIEW NEEDED: Prioritize technical debt remediation. Assign owners and timelines for addressing these issues. -->

### Refactoring Opportunities

1. Extract common tool patterns into base class or mixin
2. Unify separated tool positioning logic
3. Standardize backend API patterns
4. Consolidate DEM access patterns across Measure, Identifier, Viewshed, Shade, Isochrone

## Conclusion

The Interactive Mapping Tools system provides a robust, extensible framework for delivering specialized geospatial capabilities to users. The plugin architecture ensures consistent integration while allowing tools to implement domain-specific functionality. With 14+ tools covering drawing, measurement, analysis, and visualization, the system supports a wide range of planetary science and Earth observation use cases.
