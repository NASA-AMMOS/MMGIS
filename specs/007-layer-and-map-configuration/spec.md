# Layer & Map Configuration Feature Specification

## Overview

The Layer & Map Configuration feature provided MMGIS with a comprehensive system for defining, styling, and managing geospatial layers across multiple rendering engines (Leaflet for 2D maps and Cesium/Litho for 3D globes). This system enabled mission operators to configure complex layer hierarchies, apply sophisticated styling rules, manage visibility controls, and render legends dynamically based on layer properties and symbology.

## Feature Description

### Core Capabilities

The implemented layer configuration system supported:

1. **Multi-Layer Type Support**: Vector (GeoJSON), raster/tile, image, model (3D), velocity fields, video, header (grouping), and data layers
2. **Hierarchical Organization**: Nested layer groups with parent-child relationships and header-based organization
3. **Dynamic Styling**: Property-based styling, gradient interpolation, discrete value mapping, and geologic pattern fills
4. **Visibility Management**: Per-layer on/off toggles, opacity controls, z-index ordering, and visibility cutoff by zoom level
5. **Legend Generation**: Automatic legend creation from CSV files or JSON configuration with support for continuous gradients, discrete symbols, and image-based legends
6. **Data Source Configuration**: Flexible URL patterns, tile server integration, COG (Cloud Optimized GeoTIFF) support, and time-enabled data sources
7. **Cross-Engine Synchronization**: Coordinated layer state between 2D (Leaflet) and 3D (Cesium/Litho) rendering engines

### Technical Architecture

#### Layer Data Model

The layer configuration system was implemented through the `Layers_` module (`C:\Users\tsoliman\Documents\Projects\MMGIS\src\essence\Basics\Layers_\Layers_.js`), which maintained several key data structures:

```javascript
layers: {
    data: {},           // Layer configurations by UUID
    dataFlat: [],       // Flattened array of all layers
    layer: {},          // Leaflet/rendering layer instances
    attachments: {},    // Sublayers (models, labels, pairings, etc.)
    on: {},            // Layer visibility state (true/false)
    opacity: {},       // Layer opacity values (0-1)
    filters: {},       // Applied filter effects
    nameToUUID: {},    // Name to UUID lookup
    refreshIntervals: {} // Auto-refresh timers
}
```

#### Supported Layer Types

The system implemented support for the following layer types:

1. **vector**: GeoJSON-based point, line, and polygon features with property-driven styling
2. **tile**: XYZ tile layers (TMS, WMS formats) with optional DEM overlays
3. **image**: Single georeferenced images with COG support and pixel value transformations
4. **model**: 3D models (glTF/GLB) with position, rotation, and scale configuration
5. **velocity**: Vector field visualization (streamlines, particles)
6. **video**: Georeferenced video overlays
7. **vectortile**: Mapbox Vector Tile (MVT) format support
8. **data**: Pure data layers without visual representation
9. **header**: Non-rendering organizational groups for layer hierarchies

#### Layer Configuration Schema

Each layer was configured through a JSON object with the following structure:

```json
{
    "name": "layer-uuid",
    "display_name": "Human Readable Name",
    "type": "vector|tile|image|model|...",
    "url": "path/to/data",
    "visibility": true|false,
    "opacity": 0.0-1.0,
    "initialOpacity": 0.0-1.0,
    "minZoom": 0,
    "maxNativeZoom": 20,
    "visibilitycutoff": 0,
    "style": {
        "color": "#RRGGBB",
        "weight": 2,
        "opacity": 1.0,
        "fillColor": "#RRGGBB",
        "fillOpacity": 0.5,
        "radius": 8,
        "colorProp": "property_name",
        "weightProp": "property_name",
        "fillColorProp": "property_name",
        "fillOpacityProp": "property_name",
        "radiusProp": "property_name",
        "opacityProp": "property_name"
    },
    "legend": "path/to/legend.csv",
    "variables": {
        "legendOrientation": "vertical|horizontal",
        "hideLegendLayerName": true|false
    },
    "time": {
        "type": "global|local|none",
        "start": "2020-01-01T00:00:00Z",
        "end": "2020-12-31T23:59:59Z",
        "startProp": "start_time",
        "endProp": "end_time"
    }
}
```

### Layer Styling System

#### Property-Based Styling

The system implemented property-based styling through the `prop:` prefix convention:

```javascript
// Configuration example
"style": {
    "fillColor": "prop:temperature",  // Color from 'temperature' property
    "radius": "prop:magnitude"        // Size from 'magnitude' property
}
```

The `LayerConstructors.js` module processed these property references during feature rendering.

#### Legend-Driven Styling

<!-- HUMAN REVIEW NEEDED -->
The implementation supported automatic styling based on legend configurations. When a legend defined property-value-to-color mappings with `styleMatching: true`, the rendering system automatically applied those styles to features:

**Business Decision**: Legend-based styling took priority over configured styles but not over feature-level `properties.style` overrides. This priority hierarchy balanced configurability with feature-specific customization needs.

Supported legend-based styling modes:

1. **Discrete Matching**: Exact value matches for categorical data
2. **Continuous Interpolation**: Gradient interpolation for numeric properties using RGB color space
3. **Multi-Stop Gradients**: Complex color ramps with multiple color stops

Implementation in `LayerConstructors.js` (lines 230-393):

```javascript
// Continuous interpolation example
if (shouldUseContinuous) {
    const fillColorStops = numericEntries
        .filter(entry => entry.color)
        .map(entry => ({
            position: (entry.numericValue - minValue) / (maxValue - minValue),
            color: entry.color
        }))

    const interpolatedFillColor = interpolateMultipleColors(
        fillColorStops,
        featureValue,
        minValue,
        maxValue
    )
}
```

#### Geologic Pattern Fills

The system included specialized support for FGDC geologic pattern symbols through the `LayerGeologic` module, enabling standard geological map symbologies for polygon features.

### Legend Management

The Legend Tool (`C:\Users\tsoliman\Documents\Projects\MMGIS\src\essence\Tools\Legend\LegendTool.js`) provided dynamic legend generation and rendering.

#### Legend Data Sources

Legends were configured through two methods:

1. **CSV Files**: External CSV files with columns for shape, color, strokecolor, value
2. **JSON Arrays**: Inline legend arrays in layer configuration under `_legend` property

Legend CSV format:
```csv
shape,color,strokecolor,value,propertyName,propertyValue,styleMatching,hideFromLegend
circle,#FF0000,#000000,High Temperature,temperature,30,true,false
square,#00FF00,#000000,Medium Temperature,temperature,20,true,false
rect,#0000FF,#000000,Low Temperature,temperature,10,true,false
continuous,#FF0000,,Max,temperature,40,true,false
continuous,#0000FF,,Min,temperature,0,true,false
```

#### Legend Shape Types

Supported shape types:

- **Primitive Shapes**: `circle`, `square`, `rect` - Rendered as colored divs
- **Image Markers**: File paths to PNG/JPG/SVG images - Rendered as background images
- **MDI Icons**: Material Design Icon names (e.g., `mdi-home`) - Rendered using icon fonts
- **Continuous Gradients**: `continuous` - Rendered as color gradients with tick marks
- **Discrete Bands**: `discreet` - Rendered as stepped color bands

#### Legend Rendering Features

Implemented features in the Legend Tool:

1. **Orientation Support**: Vertical (default) or horizontal legend layouts
2. **Dynamic Tick Marks**: Positioned markers on continuous gradients for value reference
3. **Interactive Tooltips**: Hover-based value display with interpolated continuous values
4. **Units Extraction**: Automatic unit detection and display for consistent labeling
5. **Image Legends**: Direct rendering of WMS GetLegendGraphic or static legend images
6. **Responsive Label Density**: Automatic label reduction in horizontal mode to prevent overlap
7. **Layer Headers**: Optional display of header layer names in legend hierarchy

<!-- HUMAN REVIEW NEEDED -->
**Business Decision**: The legend display order followed the layer hierarchy with optional header inclusion. Legends only appeared for visible layers, automatically updating on layer toggle events. This provided users with a current view of active symbology without cluttering the legend panel with inactive layers.

### Visibility Controls

#### Toggle System

The layer toggle system was implemented through `toggleLayer()` and `toggleLayerHelper()` functions with the following behavior:

1. **Leaflet Layer Management**: Added/removed layers from the map using `addLayer()`/`removeLayer()`
2. **Globe/Litho Synchronization**: Coordinated 3D layer visibility through `Globe_.litho.addLayer()`/`removeLayer()`
3. **Sublayer Coordination**: Managed attached sublayers (models, labels, uncertainty ellipses)
4. **Event Broadcasting**: Notified subscribed tools via `_onLayerToggleSubscriptions`
5. **State Persistence**: Maintained toggle state in `L_.layers.on[layerName]`

#### Z-Index Management

The system maintained layer rendering order through z-index values:

```javascript
// Z-index calculation (higher index = on top)
const zIndex = L_._layersOrdered.length + 1 - L_._layersOrdered.indexOf(layerName)
layer.setZIndex(zIndex)
```

The `_layersOrdered` array preserved the configuration-defined layer order, ensuring consistent stacking.

#### Opacity Controls

Opacity management was implemented through `setLayerOpacity()` (lines 1671-1748):

- **Range**: 0.0 (transparent) to 1.0 (opaque)
- **Fill Opacity Preservation**: Separate tracking of `initialFillOpacity` to maintain fill transparency ratios
- **Sublayer Propagation**: Opacity changes cascaded to associated sublayers with appropriate modifiers
- **Dual-Engine Updates**: Synchronized opacity between Leaflet and Globe/Litho renderers
- **Highlight Preservation**: Active feature highlights were reapplied after opacity changes

#### Visibility Cutoff

<!-- HUMAN REVIEW NEEDED -->
The `visibilitycutoff` property controlled zoom-level-based layer visibility:

- **Positive Values**: Minimum zoom level (layer hidden when zoomed out beyond this level)
- **Negative Values**: Maximum zoom level (layer hidden when zoomed in beyond this level)

**Business Decision**: This approach allowed performance optimization by hiding detailed layers at inappropriate zoom levels while maintaining configuration simplicity with a single numeric parameter rather than separate min/max properties.

### Data Source Configuration

#### URL Patterns

The system supported multiple URL patterns:

1. **Relative Paths**: Resolved relative to mission directory (`L_.missionPath`)
2. **Absolute URLs**: Full HTTP/HTTPS URLs for external resources
3. **COG Prefix**: `COG:` prefix routed tiles through tile server for Cloud Optimized GeoTIFF processing
4. **Template Variables**: `{z}/{x}/{y}` for tile coordinates, `{starttime}/{endtime}` for temporal data

URL resolution logic in `getUrl()` (lines 247-276):

```javascript
let nextUrl = url
if (nextUrl.startsWith('COG:')) {
    nextUrl = nextUrl.slice(4)
    wasCOG = true
}
if (!F_.isUrlAbsolute(nextUrl)) {
    nextUrl = L_.missionPath + nextUrl
}
if (type === 'tile' && (layerData.throughTileServer || wasCOG)) {
    // Route through tile server
    nextUrl = `../../${nextUrl}`  // or `/${nextUrl}` in Docker
}
```

#### Tile Server Integration

The `throughTileServer` flag enabled server-side tile processing:

- **COG Support**: On-the-fly tile generation from Cloud Optimized GeoTIFFs
- **Format Transformation**: Conversion between tile formats (TMS, WMS)
- **DEM Processing**: Digital elevation model tile serving with seam correction

#### Time-Enabled Layers

Time configuration enabled temporal data filtering:

```json
{
    "time": {
        "type": "global",        // Controlled by TimeControl tool
        "start": "2020-01-01T00:00:00Z",
        "end": "2020-12-31T23:59:59Z",
        "format": "YYYY-MM-DDTHH:mm:ss[Z]"
    }
}
```

For vector layers with `type: "local"`, the system filtered features based on `startProp` and `endProp` timestamp properties.

### Layers Tool Integration

The Layers Tool (`C:\Users\tsoliman\Documents\Projects\MMGIS\src\essence\Tools\Layers\LayersTool.js`) provided the user interface for layer management:

1. **Hierarchical Display**: Tree-style presentation of layer groups and sublayers
2. **Toggle Controls**: Checkboxes for layer visibility
3. **Opacity Sliders**: Per-layer opacity adjustment (0-100%)
4. **Layer Actions**: Download, filter, metadata viewing, time controls
5. **Search/Filter**: Layer list filtering by name or properties
6. **Collapsible Groups**: Expandable/collapsible header layers

<!-- HUMAN REVIEW NEEDED -->
**Business Decision**: The tool configuration included an `expanded` variable to control whether layer groups defaulted to expanded or collapsed state on load. Mission operators could set this based on the complexity of their layer hierarchies and typical user workflows.

### Sublayer System

The attachments system (`L_.layers.attachments[layerName]`) supported auxiliary layer elements:

1. **models**: 3D models attached to vector features (e.g., spacecraft models at trajectory points)
2. **labels**: Text labels for features with custom positioning
3. **pairings**: Connecting lines between related features
4. **uncertainty_ellipses**: Error ellipses for position uncertainty visualization
5. **image_overlays**: Image overlays associated with features

Sublayer management functions:
- `toggleSublayer()`: Show/hide specific sublayers
- `setSublayerOpacity()`: Adjust sublayer transparency
- `syncSublayerData()`: Synchronize sublayer data with parent layer changes

### Advanced Configuration Features

#### COG (Cloud Optimized GeoTIFF) Support

The system implemented COG support for efficient remote raster access:

- **Lazy Loading**: Only requested tiles were fetched from COG files
- **Pixel Value Transformations**: Custom functions for converting raw pixel values to colors
- **Scale Generation**: Automatic generation of color scales for COG layers
- **Legend Integration**: Dynamic legend creation from COG value ranges

#### Filter Effects

Layer visual filters were supported through `setLayerFilter()`:

- **Brightness**: Lightness adjustment (-1.0 to 1.0)
- **Contrast**: Contrast adjustment (0.0 to 2.0)
- **Saturation**: Color saturation (0.0 to 2.0)
- **Blend Modes**: Overlay, color, multiply blending

Filter state was tracked in `L_.layers.filters[layerName]` and synchronized across both rendering engines.

#### Refresh Intervals

Layers could be configured with automatic refresh intervals:

```json
{
    "variables": {
        "refreshInterval": 30000  // Milliseconds
    }
}
```

The system maintained refresh timers in `L_.layers.refreshIntervals[layerName]` and automatically reloaded layer data at the specified interval.

## Technical Implementation Details

### Layer Construction Pipeline

The layer creation process followed this pipeline:

1. **Configuration Parsing**: `parseConfig()` processed layer JSON and built data structures
2. **Layer Ordering**: Layers were added to `_layersOrdered` in configuration order
3. **Layer Creation**: `Map_.makeLayer()` instantiated Leaflet layer objects based on type
4. **Style Application**: `LayerConstructors.constructVectorLayer()` applied styling rules
5. **Legend Processing**: CSV legends were loaded and parsed into `_legend` arrays
6. **Globe Synchronization**: Matching layers were created in Globe/Litho engine
7. **Event Binding**: Click handlers, hover behaviors, and popup bindings were attached
8. **Visibility Application**: Initial visibility state was applied via `addVisible()`

### Cross-Engine Synchronization

The dual rendering engine architecture required careful state synchronization:

```javascript
// Example from toggleLayerHelper()
if (on) {
    // Turn off
    L_.Map_.rmNotNull(L_.layers.layer[s.name])  // Remove from Leaflet
    L_.Globe_.litho.removeLayer(s.name)          // Remove from Globe
} else {
    // Turn on
    L_.Map_.map.addLayer(L_.layers.layer[s.name])  // Add to Leaflet
    L_.Globe_.litho.addLayer('vector', {...})       // Add to Globe
}
```

State properties synchronized across engines:
- Visibility (on/off)
- Opacity
- Layer order (z-index / order array)
- Filter effects
- Time ranges

### Performance Optimizations

Implemented performance optimizations:

1. **Lazy Layer Creation**: Layers were created on first toggle rather than at initialization
2. **Z-Index Batching**: `orderedBringToFront()` batch-updated z-indexes to minimize reflows
3. **Debounced Opacity Updates**: Opacity slider changes were debounced to reduce render cycles
4. **Feature Pooling**: Reused Leaflet feature objects when reloading layers
5. **Visibility Culling**: Layers outside `visibilitycutoff` ranges were not rendered

## Configuration Examples

### Complex Vector Layer with Property Styling

```json
{
    "name": "rover-traverses",
    "display_name": "Rover Traverses",
    "type": "vector",
    "url": "Layers/Rover/traverses.geojson",
    "visibility": true,
    "opacity": 0.8,
    "style": {
        "color": "prop:sol",
        "weight": "prop:confidence",
        "fillColor": "#FFD700",
        "fillOpacity": 0.3,
        "radius": 6
    },
    "legend": "Layers/Rover/traverses_legend.csv",
    "variables": {
        "legendOrientation": "horizontal",
        "useKeyAsName": "sol"
    },
    "time": {
        "type": "local",
        "startProp": "start_sol",
        "endProp": "end_sol"
    }
}
```

### Tile Layer with DEM Overlay

```json
{
    "name": "mars-ctx-mosaic",
    "display_name": "Mars CTX Mosaic",
    "type": "tile",
    "url": "Layers/CTX/{z}/{x}/{y}.png",
    "demtileurl": "Layers/MOLA/{z}/{x}/{y}.png",
    "visibility": false,
    "opacity": 1.0,
    "minZoom": 5,
    "maxNativeZoom": 15,
    "visibilitycutoff": 8,
    "tileformat": "tms",
    "throughTileServer": false
}
```

### 3D Model Layer

```json
{
    "name": "msl-model",
    "display_name": "Mars Science Laboratory",
    "type": "model",
    "url": "Models/MSL/msl.glb",
    "visibility": true,
    "initialOpacity": 1.0,
    "position": {
        "longitude": 137.4417,
        "latitude": -4.5895,
        "elevation": 100
    },
    "scale": 10,
    "rotation": {
        "x": 0,
        "y": 45,
        "z": 0
    }
}
```

### Header Layer with Sublayers

```json
{
    "name": "orbital-imagery",
    "display_name": "Orbital Imagery",
    "type": "header",
    "visibility": true,
    "sublayers": [
        {
            "name": "hirise-dtm",
            "display_name": "HiRISE DTM",
            "type": "tile",
            "url": "Layers/HiRISE/DTM/{z}/{x}/{y}.png",
            "visibility": false,
            "opacity": 0.7
        },
        {
            "name": "ctx-mosaic",
            "display_name": "CTX Mosaic",
            "type": "tile",
            "url": "Layers/CTX/{z}/{x}/{y}.png",
            "visibility": true,
            "opacity": 1.0
        }
    ]
}
```

## Integration Points

### Tool Integration

The layer configuration system integrated with multiple tools:

- **Legend Tool**: Consumed `_legend` arrays for dynamic legend rendering
- **Layers Tool**: Provided UI for layer management and configuration viewing
- **Info Tool**: Accessed layer properties for feature information display
- **Measure Tool**: Used DEM layers for elevation profiling
- **Draw Tool**: Interacted with vector layers for feature editing
- **Identifier Tool**: Queried raster layer pixel values based on configuration

### API Integration

The system exposed several API methods for programmatic layer control:

```javascript
// Toggle layer visibility
L_.toggleLayer(layerObj)

// Set layer opacity (0.0 - 1.0)
L_.setLayerOpacity(layerName, opacity)

// Get layer opacity
L_.getLayerOpacity(layerName)

// Set layer filter effects
L_.setLayerFilter(layerName, filter, value)

// Reload layer data
L_.reloadLayer(layerName)

// Get layer by name/UUID
L_.asLayerUUID(nameOrUUID)

// Subscribe to layer toggle events
L_.subscribeOnLayerToggle(fid, callback)
```

### WebSocket Integration

Layer configurations could be updated dynamically through WebSocket messages, enabling real-time layer updates and collaborative configuration changes.

## Known Limitations and Constraints

### Technical Limitations

1. **Memory Constraints**: Large vector datasets (>10,000 features) could impact performance on resource-limited devices
2. **Legend Size Limits**: Legends with >50 discrete entries experienced rendering performance degradation
3. **Z-Index Range**: Maximum of ~10,000 layers due to CSS z-index limitations
4. **Globe-Map Feature Parity**: Not all Leaflet layer types had equivalent Globe/Litho implementations

### Configuration Constraints

<!-- HUMAN REVIEW NEEDED -->
1. **UUID Uniqueness**: Layer names (UUIDs) must be unique across the entire configuration
2. **URL Length Limits**: Very long tile URL templates could exceed browser URL length limits
3. **Property Name Collisions**: Property-based styling required non-conflicting property names
4. **Legend File Size**: Large legend CSV files (>1MB) caused initialization delays

**Business Decision**: These constraints were documented in the configuration guide but not enforced programmatically. Mission operators were expected to follow best practices to avoid these issues.

## Testing Approach

The layer configuration system was tested through:

1. **Unit Tests**: Individual functions for layer parsing, styling, and state management
2. **Integration Tests**: Layer creation pipeline, engine synchronization, and tool integration
3. **Visual Tests**: Screenshot-based testing of layer rendering and legend display
4. **Performance Tests**: Load testing with large layer counts and complex hierarchies
5. **Cross-Browser Tests**: Compatibility testing across Chrome, Firefox, Safari, and Edge

## Dependencies

### External Libraries

- **Leaflet**: 2D map rendering engine
- **Cesium/Litho**: 3D globe rendering engine (custom fork)
- **D3.js**: Legend rendering and DOM manipulation
- **jQuery**: DOM traversal and event handling
- **Turf.js**: Spatial analysis for legend-based styling

### Internal Modules

- **Layers_**: Core layer management module
- **LayerConstructors**: Layer creation and styling pipeline
- **Map_**: Leaflet map wrapper
- **Globe_**: Cesium/Litho globe wrapper
- **Formulae_**: Utility functions for parsing and calculations
- **ToolController_**: Tool lifecycle management

## Security Considerations

### Input Validation

Layer configuration inputs were validated for:
- Valid JSON structure
- Allowed layer types
- URL format validation
- Property name sanitization

### XSS Prevention

Legend labels and layer names were sanitized before rendering to prevent XSS attacks:

```javascript
// Example from annotation creation
`${feature.properties.name.replace(/[<>;{}]/g, '')}`
```

### Access Control

Layer visibility could be restricted based on user permissions, though this was handled at the configuration level rather than within the layer system itself.

## Future Enhancement Opportunities

Based on the implemented system, potential future enhancements could include:

1. **Layer Presets**: Saved layer visibility/opacity configurations for quick switching
2. **Dynamic Symbology**: Real-time legend updates based on feature data changes
3. **Advanced Filtering**: SQL-like queries for complex feature filtering
4. **Layer Analytics**: Statistics and metrics on layer usage and performance
5. **Version Control**: Track configuration changes over time with rollback capability
6. **Cloud Storage**: Direct integration with cloud storage for layer data (S3, GCS)
7. **Streaming Layers**: WebSocket-based real-time data streaming for live layers

---

*This specification represents the implemented state of the Layer & Map Configuration feature in the MMGIS system.*
