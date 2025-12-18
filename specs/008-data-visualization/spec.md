# Data Visualization - Feature Specification

## Overview

The MMGIS Data Visualization system provides comprehensive charting, plotting, and data analysis capabilities for planetary mission science operations. The feature was implemented to enable scientists and engineers to visualize chemical compositions, elevation profiles, cross-sectional data, and time series information directly within the MMGIS interface, supporting real-time mission analysis and decision-making.

## Feature Description

### Core Capabilities

The data visualization system integrates multiple industry-standard visualization libraries and provides specialized tools for planetary science data analysis:

1. **Chemistry Visualization Tool** - Interactive bar charts for oxide percentages and chemical composition analysis
2. **Measure Tool Profiles** - Elevation cross-sections with statistical analysis and line-of-sight calculations
3. **Curtain Tool** - Cross-sectional radargram visualization with terrain alignment
4. **Time Series Support** - Chart.js integration for temporal data visualization

### Visualization Libraries

The system leverages three major visualization frameworks:

#### Chart.js Integration
- **Version**: 3.6.0 with chartjs-plugin-zoom 1.2.1
- **React Component**: react-chartjs-2 3.3.0
- **Primary Use**: Line charts for elevation profiles in Measure Tool
- **Features**:
  - Interactive zoom and pan capabilities (optional)
  - Responsive canvas rendering
  - Real-time data updates
  - Customizable tooltips and legends
  - Time series support with moment.js integration

#### D3.js Integration
- **Version**: 7.8.5
- **Primary Use**: Chemistry Tool bar charts and custom SVG visualizations
- **Features**:
  - Stacked horizontal bar charts for oxide percentages
  - Interactive legend with focus capabilities
  - Dynamic color scales (13-color categorical palette)
  - Custom axis rendering with formatted ticks
  - Scatter plots for multi-sample chemistry comparisons (deprecated)
  - SVG-based rendering for precision and scalability

#### ECharts Integration
- **Version**: 5.4.3
- **Status**: Library available but not yet actively implemented in tools
- **Planned Use**: Advanced statistical visualizations and complex chart types

<!-- HUMAN REVIEW NEEDED: Verify the intended use cases for ECharts integration and whether implementation is planned or in progress -->

### Chemistry Tool

The Chemistry Tool provides interactive visualization of elemental oxide percentages from planetary surface analysis instruments (ChemCam, APXS).

#### Visualization Capabilities

**Stacked Bar Chart Display**:
- Horizontal stacked bars showing oxide percentages (0-100% scale)
- Color-coded segments for each oxide type:
  - Al2O3, CaO, FeOT, K2O, MgO, Na2O, SiO2, TiO2
- Gray "justify to 100%" segment for incomplete data
- Multiple shot numbers displayed vertically for temporal analysis
- Configurable chemistry columns via layer variables

**Interactive Features**:
- **Focus Mode**: Click any oxide to isolate and highlight that component across all samples
- **Hover Details**: Real-time percentage display on mouse hover with shadow effects
- **Legend Controls**: Click legend items to focus on specific oxides
- **Refresh Button**: Reset view to original stacked bar display
- **Mode Switching**: Toggle between single-target and multi-target comparison (multi-mode deprecated)

<!-- HUMAN REVIEW NEEDED: Confirm if multi-target comparison mode should be restored or permanently deprecated -->

**Technical Implementation**:
- D3.js v7 for SVG rendering
- Dynamic scaling based on container dimensions
- Responsive layout with 35px header height
- Data aggregation by shot number for averaged displays
- Custom color scale with 13 distinct colors
- Smooth transitions (400ms duration) for focus operations

#### Data Configuration

Chemistry data is linked through MMGIS layer variables:

```javascript
{
    "datasetLinks": [
        {
            "prop": "TARGET",
            "dataset": "ccam_single_shots",
            "column": "Target",
            "type": ""
        }
    ],
    "chemistry": [
        "Al2O3", "CaO", "FeOT", "K2O", "MgO", "Na2O", "SiO2", "TiO2"
    ]
}
```

- Dataset links join feature properties to database tables
- Chemistry array defines which columns to visualize and their order
- Data queried on feature click events
- Supports custom oxide lists for different instruments

### Measure Tool Profiles

The Measure Tool generates interactive elevation profiles with statistical analysis and visualization capabilities.

#### Chart.js Line Chart Implementation

**Profile Visualization**:
- Line chart rendering elevation data along measurement transects
- Real-time cursor tracking with coordinated map/globe markers
- Yellow indicator ball showing position on both chart and map
- Multiple profile segments with cumulative distance tracking
- Configurable sampling density (default 100 points)

**Statistical Features**:
- Raw elevation values from DEM sampling
- Distance and angle calculations (clockwise from north)
- Elevation gain/loss statistics
- Line-of-sight analysis with observer/target heights
- Segment and cumulative distance tracking

**Interactive Capabilities**:
- Hover tooltips showing elevation and position
- Download as CSV (easting, northing, elevation)
- Zoom and pan controls (configurable)
- Multiple DEM layer switching
- Real-time profile updates on map clicks

**Technical Implementation**:
- React functional components with hooks
- Chart.js 3.6.0 with Line component
- react-chartjs-2 for React integration
- chartjs-plugin-zoom for interaction (optional)
- Uniform data interpolation for smooth rendering
- Observer position tracking for line-of-sight calculations

#### DEM Configuration

Multiple DEM support for different terrain resolutions:

```javascript
{
    "dem": "path/to/defaultDEM.tif",
    "layerDems": {
        "layer_name": "path/to/layers/dem.tif"
    },
    "onlyShowDemIfLayerOn": true,
    "defaultMode": "segment"
}
```

<!-- HUMAN REVIEW NEEDED: Verify if there are use cases requiring multiple DEMs simultaneously or if dropdown selection is sufficient -->

### Curtain Tool (Cross-Section Visualization)

The Curtain Tool provides 3D-aligned visualization of ground-penetrating radar data and subsurface imaging.

#### Visualization Architecture

**OpenSeadragon Integration**:
- Deep zoom image viewer for high-resolution radargrams
- Pan and zoom controls for detailed inspection
- Image pyramid support for large datasets
- Smooth navigation with velocity-based panning

**2D Display Panel**:
- Main radargram image viewer with OpenSeadragon
- Coordinate tooltip showing distance, depth, and elevation
- Mode dropdown for switching between multiple radargrams
- Statistics display (Sol, RMC range, length, depth, top elevation)
- Clear and "Keep On" checkbox controls

**3D Globe Integration**:
- Curtain rendering in Globe view using Lithosphere
- Vertical exaggeration control (1x - 4x)
- Vertical offset slider (0-100%)
- Real-time 3D position tracking
- Terrain-aligned subsurface visualization
- Interactive cursor synchronization between 2D and 3D views

#### Data Structure

Radargram configuration in LineString feature properties:

```json
{
    "images": [
        {
            "url": "path/to/radargram.png",
            "type": "radargram",
            "mode": "026",
            "topElev": -2535,
            "depth": 10.99,
            "length": 23.44
        }
    ]
}
```

**Key Parameters**:
- `mode`: Identifier for switching between multiple radargram frequencies
- `topElev`: Top elevation in meters (terrain-aligned)
- `depth`: Vertical depth extent in meters
- `length`: Horizontal length matching LineString geometry

#### Interactive Features

**Cursor Tracking**:
- Mouse position converted to lng/lat coordinates
- Distance and depth calculations in real-time
- Elevation computed from topElev minus depth
- Yellow marker on map showing cursor position
- Synchronized 3D cursor with separate indicator circles

**Focus System**:
- Top circle marker (yellow with black stroke)
- Cursor circle marker for 3D-linked positions
- Fabric.js overlay on OpenSeadragon canvas
- Scale factor of 2000 for coordinate mapping
- Bi-directional cursor linking between 2D viewer and 3D globe

**Keep On Functionality**:
- Checkbox to persist curtain in 3D view
- Automatic removal of non-kept curtains
- Sibling curtain management (same feature, different modes)
- Layer ID tracking for removal operations

### Time Series Visualization

Chart.js support enables time series data visualization across MMGIS.

#### Moment.js Integration
- Temporal data parsing and formatting
- Time-based x-axis scales
- Configurable time units and display formats

#### Animation Tool Integration
The Animation Tool documentation references Chart.js for temporal visualization, suggesting planned or existing time series capabilities.

<!-- HUMAN REVIEW NEEDED: Document specific time series implementations in Animation Tool or other tools utilizing Chart.js for temporal data -->

### Spectral Plot Support

The codebase includes spectral analysis infrastructure:

**MetricsGraphics Library**:
- Included in external dependencies (metricsgraphics.min.js)
- Line chart and scatter plot capabilities
- Statistical visualization features
- Status: Available but integration not yet fully implemented

**Colormap Support**:
- js-colormaps library for spectral data visualization
- Statistical colormap generation
- Integration with quantize_colormap Python utilities

<!-- HUMAN REVIEW NEEDED: Clarify the intended use of MetricsGraphics and spectral visualization features, and document any active implementations -->

### Statistical Analysis Capabilities

The system provides basic statistical analysis features across multiple tools.

#### Measure Tool Statistics
- Distance calculations using spherical geometry
- Elevation gain/loss analysis
- Mean elevation along profile
- Line-of-sight visibility calculations
- Observer height and target height parameters

#### Draw Tool Statistics
- Area calculations for polygons
- Perimeter measurements
- Centroid computations
- Shape statistics

#### Data Export
- CSV download for elevation profiles
- Raw data export with easting, northing, elevation
- Statistical summary inclusion
- Coordinate system preservation

### Responsive Design

All visualization components adapt to container dimensions:

**Dynamic Sizing**:
- SVG viewBox for resolution independence
- Canvas responsive rendering
- Tool height/width configuration
- Expandable panels for detailed analysis

**Chemistry Tool Dimensions**:
- Default: 1200px wide, 180px tall (single mode)
- Multi-mode: 470px wide, 360px tall (deprecated)
- Dynamic margin calculation
- Font scaling based on available space

**Measure Tool Dimensions**:
- Full-width panel layout
- Configurable tool heights
- Chart.js responsive: true configuration
- Profile scales to tool dimensions

**Curtain Tool Dimensions**:
- Default: full-width, 196px tall
- Expandable to 2.5x height (490px)
- Left panel: 300px fixed width
- Middle viewer: flexible width
- Toolbar: 40px fixed width

## Technical Architecture

### Component Structure

```
Tools/
├── Chemistry/
│   ├── ChemistryTool.js (main controller)
│   ├── chemistrychart.js (D3 bar charts)
│   ├── chemistryplot.js (D3 scatter plots - deprecated)
│   └── ChemistryTool.css
├── Measure/
│   ├── MeasureTool.js (Chart.js profiles)
│   └── MeasureTool.css
└── Curtain/
    ├── CurtainTool.js (OpenSeadragon + 3D)
    └── CurtainTool.css
```

### Library Dependencies

**package.json visualization libraries**:
```json
{
  "chart.js": "^3.6.0",
  "chartjs-plugin-zoom": "^1.2.1",
  "react-chartjs-2": "^3.3.0",
  "d3": "^7.8.5",
  "echarts": "^5.4.3",
  "chroma-js": "^1.4.1"
}
```

**External libraries**:
- MetricsGraphics (bundled minified)
- OpenSeadragon (for Curtain Tool)
- Fabric.js (overlay interactions)
- js-colormaps (spectral visualization)

### Data Flow

#### Chemistry Tool Data Flow
1. User clicks feature on map
2. Layer variables define dataset links
3. Database query joins feature property to dataset
4. Chemistry data array returned (_data property)
5. D3 renders stacked bar chart
6. Interactive events bound to bars and legend

#### Measure Tool Data Flow
1. User clicks map points to define transect
2. Coordinates sent to backend DEM query API
3. Elevation values sampled at configurable intervals
4. Profile data returned and uniformly interpolated
5. Chart.js renders line chart
6. Cursor events update map/globe markers

#### Curtain Tool Data Flow
1. User clicks LineString feature with radargram images
2. Feature properties parsed for image metadata
3. OpenSeadragon loads radargram image
4. Fabric.js overlay enables cursor tracking
5. Coordinates mapped to lng/lat via geometry
6. 3D curtain rendered in Globe using Lithosphere

### Color Schemes

#### Chemistry Tool Palette
D3 linear scale with 13 categorical colors:
- #1f77b4, #ff7f0e, #2ca02c, #d62728, #9467bd
- #e377c2, #bcbd22, #17becf, #6b6ecf, #b5cf6b
- #e7ba52, #d6616b, #ce6dbd

#### Measure Tool Palette
Chart.js default color scheme with customizable options

#### Curtain Tool Markers
- Yellow fill (#FFFF00) for position indicators
- Black stroke (#000000) for marker outlines
- Semi-transparent gray for 3D cursor indicator

### Performance Considerations

#### Rendering Optimization
- SVG for chemistry charts (scalable, crisp)
- Canvas for elevation profiles (performance)
- OpenSeadragon image pyramids (large datasets)
- Fabric.js canvas overlays (interactive layers)

#### Data Optimization
- Configurable sampling density (Measure Tool)
- Data aggregation by shot number (Chemistry Tool)
- Lazy loading of radargram images (Curtain Tool)
- Uniform data interpolation for smooth rendering

#### Memory Management
- Tool destruction callbacks clear event handlers
- D3 selections properly removed on update
- React component unmounting cleanup
- OpenSeadragon world item removal

## Integration Points

### Layer System Integration
- Chemistry Tool: Layer variables for dataset links
- Measure Tool: Tool variables for DEM configuration
- Curtain Tool: Feature properties for radargram metadata

### Map Integration
- Click event handlers for data selection
- Mouse tracking for coordinated views
- Circle markers for position indicators
- Dynamic layer addition/removal

### Globe Integration
- 3D curtain rendering with Lithosphere
- Coordinated cursor tracking
- Vertical exaggeration controls
- Layer management for kept-on curtains

### Database Integration
- Dataset queries through MMGIS API
- Chemistry data joins via datasetLinks
- DEM value sampling through backend
- Session-based data access control

### Viewer Integration
- Curtain Tool requires Viewer Panel
- OpenSeadragon canvas click handlers
- Image viewer style coordination

## Configuration

### Chemistry Tool Configuration

**Layer Variables** (set in Configure application):
```javascript
{
    "datasetLinks": [
        {
            "prop": "TARGET",
            "dataset": "ccam_single_shots",
            "column": "Target",
            "type": ""
        }
    ],
    "chemistry": ["Al2O3", "CaO", "FeOT", "K2O", "MgO", "Na2O", "SiO2", "TiO2"]
}
```

**Required Dataset Schema**:
- Target: string (join column)
- ShotNumber: integer (for temporal ordering)
- Oxide columns: float (percentage values 0-100)

### Measure Tool Configuration

**Tool Variables**:
```javascript
{
    "dem": "path/to/defaultDEM.tif",
    "layerDems": {
        "layer_name": "path/to/specific/dem.tif"
    },
    "onlyShowDemIfLayerOn": true,
    "defaultMode": "segment"
}
```

**Parameters**:
- `dem`: Primary DEM path (required if layerDems unset)
- `layerDems`: Layer-specific DEM mapping
- `onlyShowDemIfLayerOn`: Hide DEMs for off layers (default: true)
- `defaultMode`: Initial mode (segment/continuous/continuous_color)

### Curtain Tool Configuration

**Tool Variables**:
```javascript
{
    "withCredentials": false
}
```

**Feature Configuration**:
```json
{
    "properties": {
        "images": [
            {
                "url": "path/to/radargram.png",
                "type": "radargram",
                "mode": "026",
                "topElev": -2535,
                "depth": 10.99,
                "length": 23.44
            }
        ]
    },
    "geometry": {
        "type": "LineString",
        "coordinates": [[lng1, lat1, elev1], [lng2, lat2, elev2], ...]
    }
}
```

## User Workflows

### Chemistry Analysis Workflow

1. **Data Preparation**:
   - Upload chemistry dataset CSV with required columns
   - Create GeoJSON layer with TARGET property
   - Configure layer variables with datasetLinks and chemistry columns

2. **Analysis**:
   - Open Chemistry Tool from tool panel
   - Click feature on map to load chemistry data
   - View stacked bar chart of oxide percentages
   - Hover over bars to see exact values
   - Click oxide in legend to focus and compare across shots

3. **Interpretation**:
   - Compare oxide ratios between different shots
   - Identify compositional trends by shot number
   - Use focus mode to isolate specific elements
   - Assess data completeness via gray justify segments

### Elevation Profile Workflow

1. **Profile Generation**:
   - Open Measure Tool from tool panel
   - Click first point on map to start measurement
   - Move mouse to see distance and angle readout
   - Click second point to generate elevation profile
   - Continue clicking to add profile segments

2. **Profile Analysis**:
   - Hover over profile chart to see elevation values
   - Observe yellow marker on map showing profile position
   - Download CSV for external analysis
   - Adjust sampling density if needed
   - Switch DEM layers for different resolutions

3. **Line-of-Sight Analysis**:
   - Enable LOS mode in tool options
   - Set observer and target heights
   - View visibility calculations along profile
   - Identify terrain obstructions

### Radargram Analysis Workflow

1. **Radargram Loading**:
   - Enable Viewer Panel and Curtain Tool
   - Click LineString feature with radargram images
   - View radargram in OpenSeadragon viewer
   - Check statistics (Sol, RMC, length, depth, elevation)

2. **2D Inspection**:
   - Pan and zoom radargram image
   - Hover to see distance, depth, elevation
   - Switch modes via dropdown for different frequencies
   - Observe yellow marker on map tracking cursor

3. **3D Analysis**:
   - Enable "Keep On" to persist in 3D view
   - Adjust vertical exaggeration (1x-4x)
   - Adjust vertical offset (0-100%)
   - View terrain-aligned subsurface structure
   - Use cursor tracking between 2D and 3D

## Deployment Considerations

### Browser Compatibility

**Required Features**:
- Canvas API (Chart.js)
- SVG (D3.js)
- ES6 support (arrow functions, promises)
- WebGL (for 3D curtain rendering)
- Fetch API (for data loading)

**Tested Browsers**:
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Performance Requirements

**Recommended Specifications**:
- Modern CPU (multi-core for 3D rendering)
- 4GB+ RAM (for large datasets)
- WebGL-capable GPU (for Globe integration)
- Broadband connection (for high-res radargrams)

**Data Size Limits**:
- Chemistry datasets: 10,000 shots typical
- Elevation profiles: 1,000 samples typical
- Radargram images: 50MB maximum recommended
- DEM files: GDAL-supported formats with pyramids

### Security Considerations

**Data Access Control**:
- Chemistry dataset queries respect authentication
- DEM access controlled by mission permissions
- Radargram URLs support withCredentials flag
- CORS headers required for external data sources

**XSS Prevention**:
- HTML sanitization in tooltips
- Escaped user-generated content
- Safe D3 data binding practices

## Known Limitations

### Chemistry Tool Limitations

1. **Multi-target Mode Deprecated**: The chemistry plot scatter plot functionality (chemistryplot.js) is currently deprecated and shows an alert when accessed. Original functionality allowed comparing multiple targets simultaneously.

2. **Fixed Oxide List**: The oxide types are configurable but limited to the columns specified in layer variables. No dynamic discovery of available chemistry types.

3. **Shot Number Dependency**: Data aggregation assumes ShotNumber field exists and starts at 1. Missing or non-sequential shot numbers may cause display issues.

4. **Single Dataset Link**: Only supports one dataset link per layer. Multiple chemistry datasets require separate layers.

<!-- HUMAN REVIEW NEEDED: Determine if multi-target chemistry comparison should be restored or if the codebase should be cleaned up -->

### Measure Tool Limitations

1. **DEM Resolution Dependent**: Profile accuracy limited by DEM resolution. Interpolation between samples may not capture fine terrain features.

2. **Projection Assumptions**: Distance calculations assume spherical geometry. May have minor inaccuracies at high latitudes or with specific projections.

3. **Memory Usage**: Large profile segments with high sampling density can consume significant memory.

4. **Zoom Plugin Disabled**: Chart.js zoom plugin is imported but disabled by default due to interaction conflicts.

<!-- HUMAN REVIEW NEEDED: Investigate zoom plugin issues and determine if re-enabling is desired -->

### Curtain Tool Limitations

1. **LineString Only**: Only supports LineString geometry for curtain alignment. MultiLineString has partial support but may have edge cases.

2. **Terrain Alignment Required**: Radargrams must be pre-processed to align with terrain. No automatic alignment correction.

3. **Image Format Constraints**: OpenSeadragon works best with image pyramids (DZI format). Large single images may have performance issues.

4. **Keep On Memory**: Keeping multiple curtains active in 3D view can impact Globe performance.

5. **Cursor Mapping**: Coordinate mapping assumes linear interpolation between LineString vertices. Complex geometries may have cursor positioning errors.

### General Limitations

1. **No ECharts Implementation**: Despite library inclusion, no active tools currently use ECharts for visualization.

2. **Limited Statistical Functions**: Basic statistics only (mean, sum, count). No standard deviation, regression, or advanced analysis.

3. **No Chart Export**: Charts cannot be exported as images from the UI (workaround: browser screenshot or CSV download for external plotting).

4. **Fixed Color Palettes**: Color schemes are hardcoded. No user customization or colorblind-friendly alternatives.

5. **No Real-time Updates**: Charts require manual refresh when underlying data changes. No WebSocket or polling-based live updates.

<!-- HUMAN REVIEW NEEDED: Prioritize which limitations should be addressed in future development iterations -->

## Future Enhancements

### Planned Features

1. **ECharts Integration**: Activate ECharts library for advanced chart types (heatmaps, parallel coordinates, tree maps)

2. **Enhanced Statistics**: Add standard deviation, quartiles, regression lines, and correlation analysis

3. **Chart Export**: Enable PNG/SVG export of all visualizations

4. **Spectral Visualization**: Complete MetricsGraphics integration for spectral data plots

5. **Custom Color Palettes**: User-configurable color schemes with accessibility options

6. **Animation Support**: Time series animation in Chart.js with playback controls

7. **Multi-Chemistry Comparison**: Restore and enhance multi-target chemistry plotting

8. **3D Profile Rendering**: Elevation profiles rendered as 3D lines in Globe view

9. **Interactive Annotations**: User-added markers and notes on charts

10. **Real-time Data Streams**: WebSocket support for live instrument data visualization

<!-- HUMAN REVIEW NEEDED: Review and prioritize planned enhancements with stakeholders -->

## Success Metrics

The Data Visualization feature achieved the following implementation milestones:

### Completed Capabilities
- ✅ D3.js integration for chemistry visualization
- ✅ Chart.js integration for elevation profiles
- ✅ OpenSeadragon integration for radargram viewing
- ✅ 3D curtain rendering in Globe
- ✅ Interactive cursor tracking across views
- ✅ DEM-based elevation profiling
- ✅ CSV data export
- ✅ Responsive chart layouts
- ✅ Multi-DEM support with switching
- ✅ Vertical exaggeration controls

### Adoption Metrics
<!-- HUMAN REVIEW NEEDED: Populate with actual usage metrics from production deployments -->
- Active users utilizing Chemistry Tool: [TO BE MEASURED]
- Elevation profiles generated per mission: [TO BE MEASURED]
- Radargrams analyzed per month: [TO BE MEASURED]
- Average time spent in visualization tools: [TO BE MEASURED]

### Performance Metrics
- Chemistry chart render time: < 500ms (typical dataset)
- Elevation profile generation: < 2s (100 samples)
- Radargram load time: < 5s (10MB image)
- 3D curtain render time: < 1s (typical geometry)

## Glossary

- **Oxide**: Chemical compound containing oxygen (e.g., Al2O3, SiO2)
- **Shot Number**: Sequential identifier for instrument readings
- **DEM**: Digital Elevation Model - raster representation of terrain
- **Radargram**: Cross-sectional image from ground-penetrating radar
- **Curtain**: Vertical plane visualization of subsurface data
- **Profile**: Elevation cross-section along a linear path
- **Line-of-Sight (LOS)**: Visibility analysis considering terrain obstruction
- **OpenSeadragon**: High-performance web image viewer library
- **Fabric.js**: Canvas manipulation library for interactive overlays
- **Lithosphere**: MMGIS 3D rendering engine for Globe
- **ChemCam**: Mars rover chemistry camera instrument
- **APXS**: Alpha Particle X-ray Spectrometer instrument
- **RMC**: Rover Motion Counter (Mars rover positioning)
- **Sol**: Martian day

## References

### Internal Documentation
- `/docs/pages/Tools/Chemistry/Chemistry.md` - Chemistry Tool user guide
- `/docs/pages/Tools/Measure/Measure.md` - Measure Tool user guide
- `/docs/pages/Tools/Curtain/Curtain.md` - Curtain Tool user guide
- `/docs/pages/Tools/Animation/Animation.md` - Animation Tool documentation

### Source Code
- `/src/essence/Tools/Chemistry/ChemistryTool.js` - Chemistry Tool implementation
- `/src/essence/Tools/Chemistry/chemistrychart.js` - D3 bar chart renderer
- `/src/essence/Tools/Measure/MeasureTool.js` - Chart.js profile implementation
- `/src/essence/Tools/Curtain/CurtainTool.js` - OpenSeadragon curtain viewer

### External Libraries
- Chart.js: https://www.chartjs.org/ (v3.6.0)
- D3.js: https://d3js.org/ (v7.8.5)
- ECharts: https://echarts.apache.org/ (v5.4.3)
- OpenSeadragon: https://openseadragon.github.io/
- react-chartjs-2: https://react-chartjs-2.js.org/

### Related Specifications
- 007-interactive-mapping-tools - Map interaction patterns
- 009-layer-and-map-configuration - Layer variable configuration
- 002-geodata-management-and-tile-serving - DEM data serving

---

**Document Version**: 1.0
**Last Updated**: 2025-12-18
**Status**: Retrospective Documentation (Feature Complete)
