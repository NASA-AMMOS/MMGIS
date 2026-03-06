# Kitchen Sink Demo Mission - Specification

**Status**: 📋 Draft
**Created**: 2026-03-05
**Last Updated**: 2026-03-05

## Overview

The Kitchen Sink Demo Mission is a comprehensive reference configuration that showcases all MMGIS features, layer types, data formats, tools, and configuration options. It serves three critical purposes:

1. **Reference Example** - Provides site admins with a complete, working example of how to configure and enable every MMGIS feature
2. **Demonstration Platform** - Showcases the full extent of MMGIS capabilities for stakeholders, new users, and mission teams
3. **Testing Target** - Provides a stable, feature-complete mission for Playwright E2E testing

The Kitchen Sink mission is configured at `/Missions/Kitchen-Sink/config.kitchen-sink.json` and is **only accessible** when the `FORCE_CONFIG_PATH` environment variable is explicitly set, ensuring it never interferes with production missions.

## User Scenarios

### P1 - Site Admin Learns Configuration

**As a** site administrator setting up a new MMGIS mission
**I want to** see a working example of every layer type, tool, and configuration option
**So that** I can understand how to configure my own mission without trial-and-error

**Acceptance Criteria**:
- [ ] All 10 layer types are represented with clear naming conventions
- [ ] Each layer type includes examples for all supported data formats
- [ ] Every tool is enabled with as many features as possible
- [ ] Layer names and descriptions clearly indicate what feature they demonstrate
- [ ] Configuration options are representative of real-world use cases

**User Flow**:
1. Admin sets `FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json`
2. Admin starts MMGIS and loads the Kitchen Sink mission
3. Admin navigates through layers, tools, and features
4. Admin inspects `config.kitchen-sink.json` to understand configuration syntax
5. Admin adapts examples to their own mission configuration

### P2 - Stakeholder Sees Capabilities

**As a** mission stakeholder or prospective MMGIS user
**I want to** see a comprehensive demonstration of MMGIS capabilities
**So that** I can evaluate whether MMGIS meets my mission's geospatial needs

**Acceptance Criteria**:
- [ ] Demo showcases collaboration features (Draw Tool with multiple users)
- [ ] Time-enabled layers demonstrate temporal data handling
- [ ] Analysis tools (Viewshed, Isochrone, Measure) show scientific utility
- [ ] 2D/3D/Viewer panel rendering demonstrates visualization flexibility
- [ ] Real-world-like data (even if synthetic) makes features tangible

**User Flow**:
1. Demo presenter launches Kitchen Sink mission
2. Presenter walks through layer categories (raster, vector, 3D models, etc.)
3. Presenter demonstrates each tool with pre-configured data
4. Presenter shows collaboration by opening Draw Tool in multiple sessions
5. Stakeholder gains confidence in MMGIS capabilities

### P3 - Developer Runs E2E Tests

**As a** MMGIS developer writing Playwright tests
**I want to** a stable, feature-complete mission configuration
**So that** I can write comprehensive E2E tests covering all MMGIS functionality

**Acceptance Criteria**:
- [ ] Mission configuration is stable (does not change frequently)
- [ ] All interactive elements have clear, testable selectors
- [ ] Data is lightweight enough for fast test execution
- [ ] Configuration is versioned and documented
- [ ] Tests can validate presence and functionality of all features

**User Flow**:
1. Developer starts MMGIS with Kitchen Sink mission via `FORCE_CONFIG_PATH`
2. Playwright tests load the mission URL
3. Tests validate each layer type loads correctly
4. Tests interact with each tool to verify functionality
5. Tests pass/fail based on expected Kitchen Sink behavior

## Requirements

### Functional Requirements

**FR-001**: Comprehensive Layer Type Coverage
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] All 10 layer types are represented: Vector, Tile, Data, Model, Image, VectorTile, Velocity, Video, Header, Query
  - [ ] Each layer type has at least one example for each supported data format
  - [ ] Layer names follow the pattern: `[LayerType] - [DataFormat] - [Feature]` (e.g., "Vector - GeoJSON - Points with Styling")
  - [ ] Layers are organized into logical Header groups (e.g., "Vector Layers", "Raster Layers", "3D Assets")

**FR-002**: Complete Tool Enablement
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] All tools from `toolConfigs.json` are enabled in the configuration
  - [ ] Each tool has as many features/variables enabled as possible
  - [ ] Tool-specific data requirements are met (e.g., Viewshed has DEM tilesets, Identifier has configured layers)
  - [ ] Separated tools (Legend, Identifier) are positioned for visibility
  - [ ] Expandable tools (Draw, Layers, Info) default to expanded state

**FR-003**: Vector Layer Showcase
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] GeoJSON file with Point features (various marker shapes and symbols)
  - [ ] GeoJSON file with LineString features (different stroke styles and dash arrays)
  - [ ] GeoJSON file with Polygon features (various fill colors and opacities)
  - [ ] Per-feature styling examples (features overriding layer defaults)
  - [ ] Time-enabled vector layer (with `startProp` and `endProp`)
  - [ ] Vector layer with clustering enabled
  - [ ] Vector layer with search configuration
  - [ ] Vector layer demonstrating custom icons/symbols
  - [ ] Vector layer with legend configuration

**FR-004**: Tile Layer Showcase
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] TMS (Tile Map Service) basemap layer
  - [ ] WMS (Web Map Service) layer with GetCapabilities
  - [ ] WMTS (Web Map Tile Service) layer
  - [ ] XYZ tile layer with custom URL template
  - [ ] Time-enabled tile layer (with `{time}` or `{starttime}/{endtime}` in URL)
  - [ ] Tile layer with custom min/max zoom settings
  - [ ] Tile layer with legend configuration

**FR-005**: Data Layer Showcase
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] WebGL shader-based elevation visualization (DEM)
  - [ ] Custom colormap/shader configuration
  - [ ] Configurable opacity and blending modes

**FR-006**: Model Layer Showcase (3D Assets)
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] OBJ model with texture
  - [ ] GLTF/GLB model
  - [ ] DAE (Collada) model
  - [ ] Model with scale/rotation/position configuration
  - [ ] Model with time-enabled display

**FR-007**: Image Layer Showcase
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Single-band GeoTIFF with colormap
  - [ ] Cloud-Optimized GeoTIFF (COG)
  - [ ] Image with dynamic colormap controls
  - [ ] Time-enabled image layer

**FR-008**: VectorTile Layer Showcase
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Mapbox Vector Tile (MVT) layer
  - [ ] Custom styling for vector tile features
  - [ ] Legend configuration for vector tiles

**FR-009**: Velocity Layer Showcase
- **Priority**: P3 (Nice to Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Flow/wind data visualization
  - [ ] Streamline rendering mode
  - [ ] Particle rendering mode
  - [ ] Arrow rendering mode

**FR-010**: Video Layer Showcase
- **Priority**: P3 (Nice to Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Video overlay on map surface
  - [ ] Video with playback controls
  - [ ] Georeferenced video bounds

**FR-011**: Draw Tool Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] All intent aliases configured (Polygon 1-3, Line, Point, All)
  - [ ] Property templates configured (slider, number, text, textarea, checkbox, dropdown, incrementer, date)
  - [ ] Default filters configured (public, yours only, on)
  - [ ] Dynamic extent enabled with sensible thresholds
  - [ ] Pre-created example draw files for demonstration

**FR-012**: Analysis Tool Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Measure Tool: DEM configured for elevation profiles
  - [ ] Measure Tool: Layer-specific DEMs configured
  - [ ] Viewshed Tool: DEM tilesets configured
  - [ ] Viewshed Tool: Camera presets configured
  - [ ] Isochrone Tool: DEM, slope, cost data sources configured
  - [ ] Isochrone Tool: Multiple models enabled (Traverse Time, Isodistance)
  - [ ] Identifier Tool: Layers configured with `.tif` URLs for pixel queries
  - [ ] Shade Tool: DEM, data sources, and SPICE sources configured (if applicable)

**FR-013**: Time Control Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] TimeControl tool enabled
  - [ ] Multiple time-enabled layers configured (vector, tile, image, model)
  - [ ] Time range spans a meaningful period (e.g., multiple days/months)
  - [ ] Time format configured for clear display
  - [ ] Playback controls configured

**FR-014**: Sites Tool Configuration
- **Priority**: P2 (Should Have)
- **User Scenarios**: P2
- **Acceptance Criteria**:
  - [ ] Multiple sites configured with descriptive names
  - [ ] Sites navigate to different map locations
  - [ ] Sites demonstrate zoom level control
  - [ ] Site codes match header layers for toggling

**FR-015**: Legend and Info Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Legend Tool: Multiple layers with legends configured (CSV and JSON format)
  - [ ] Legend Tool: Gradient scales demonstrated
  - [ ] Legend Tool: Symbologies demonstrated
  - [ ] Info Tool: Configured to display feature properties
  - [ ] Info Tool: Alphabetical sorting enabled

**FR-016**: Mission Metadata Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] Mission name: "Kitchen Sink"
  - [ ] Site name: "Demo"
  - [ ] View coordinates: Centered on interesting area
  - [ ] Projection: Standard Web Mercator (EPSG:3857)
  - [ ] Radius: Mars radii (major: 3396190, minor: 3396190) or Earth equivalent
  - [ ] Map scale: Appropriate zoom level (e.g., 12-15)

**FR-017**: Look and Feel Configuration
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] Page name: "MMGIS Kitchen Sink Demo"
  - [ ] All UI elements enabled (topbar, toolbar, scalebar, coordinates, etc.)
  - [ ] Custom colors configured for branding
  - [ ] Logo URL configured (MMGIS/NASA logo)
  - [ ] Help URL configured (links to MMGIS docs)

**FR-018**: Panels Configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - [ ] All three panels enabled: Viewer, Map (2D), Globe (3D)
  - [ ] DEM fallback path configured for Globe
  - [ ] Panels demonstrate synchronized navigation

**FR-019**: FORCE_CONFIG_PATH Requirement
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] Kitchen Sink mission is NOT accessible without `FORCE_CONFIG_PATH` set
  - [ ] Configuration file location: `Missions/Kitchen-Sink/config.kitchen-sink.json`
  - [ ] Documentation clearly states this is a demo/testing mission only
  - [ ] README.md in mission directory explains usage

**FR-020**: Synthetic Data Creation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - [ ] Vector GeoJSON data is hand-crafted or generated
  - [ ] Data is geographically coherent (features in sensible locations)
  - [ ] Data is lightweight for fast loading (<5MB total for all vector layers)
  - [ ] User will provide: tiles, models, COGs, DEMs, etc. (pause for user input)

### Non-Functional Requirements

**NFR-001**: Performance
- **Category**: Performance
- **Metric**: Kitchen Sink mission loads in <5 seconds on modern hardware
- **Acceptance Criteria**:
  - Initial map load completes within 5 seconds
  - All tools are interactive within 3 seconds of mission load
  - Layer toggling is responsive (<500ms)

**NFR-002**: Maintainability
- **Category**: Maintainability
- **Metric**: Configuration is well-documented and easy to update
- **Acceptance Criteria**:
  - Inline comments in JSON where helpful (within JSON constraints)
  - Accompanying README.md explains each section
  - Layer naming conventions make purpose clear
  - Configuration validates against MMGIS schema (if available)

**NFR-003**: Test Stability
- **Category**: Testing
- **Metric**: Playwright tests against Kitchen Sink have <5% flakiness
- **Acceptance Criteria**:
  - Data does not change unexpectedly
  - All interactive elements have stable selectors
  - Tests can run in parallel without conflicts
  - Configuration is versioned in git

**NFR-004**: Documentation Quality
- **Category**: Documentation
- **Metric**: Admins can configure their own mission using Kitchen Sink as reference
- **Acceptance Criteria**:
  - README.md includes setup instructions
  - README.md links to relevant MMGIS documentation
  - Each layer/tool configuration includes explanatory comments (in README)
  - Common pitfalls are documented

**NFR-005**: Accessibility
- **Category**: Usability
- **Metric**: Demo is accessible only when explicitly requested
- **Acceptance Criteria**:
  - Mission does not appear in default mission lists
  - `FORCE_CONFIG_PATH` environment variable is required
  - Clear warning in UI that this is a demo mission
  - No confusion with production missions

## Success Criteria

**Definition of Done**:
- [ ] All functional requirements implemented (FR-001 through FR-020)
- [ ] All acceptance criteria met
- [ ] Configuration file validates and loads without errors
- [ ] Playwright tests written covering all layer types and tools
- [ ] Tests passing with >95% success rate
- [ ] Code reviewed and approved
- [ ] Documentation complete (README.md, inline comments)
- [ ] User-provided assets integrated (tiles, models, COGs)
- [ ] Deployed and accessible via `FORCE_CONFIG_PATH`

**Metrics**:
- **Completeness**: 100% of layer types and tools represented
- **Load Time**: <5 seconds initial load
- **Test Coverage**: >90% of MMGIS features testable via Kitchen Sink
- **Documentation Quality**: Admin can replicate any feature without asking questions

## Decisions Made

1. **Geographic Region**: ✅ Earth region
   - Simpler for initial implementation
   - Familiar basemaps readily available
   - Can expand to planetary bodies later

2. **Asset Provision**: ✅ User will provide tiles, models, COGs, DEMs
   - Implementation will pause when specific assets are needed
   - Focus on configuration structure first

3. **SPICE/Chronos Configuration**: ✅ Skip SPICE for now
   - Shade/Viewshed tools will have placeholder configuration
   - Clear comments on how to enable when SPICE is available
   - Return to SPICE configuration in future iteration

4. **Authentication**: ✅ AUTH=off (no authentication)
   - DrawTool testing without auth for initial implementation
   - Authentication-specific features deferred to future work
   - When DrawTool tests are written, consider auth integration then

5. **Playwright Test Strategy**: ✅ Write basic tests during implementation
   - Smoke tests to validate configuration loads
   - Tool presence validation
   - Comprehensive interaction tests as follow-up work

6. **Versioning Strategy**: ✅ Kitchen Sink matches MMGIS version with hard requirement
   - Kitchen Sink version must match MMGIS version (e.g., v4.1.18)
   - **Constitution Requirement**: All new features MUST update Kitchen Sink config
   - **Constitution Requirement**: All feature changes MUST update Kitchen Sink config
   - Kitchen Sink serves as living documentation of current MMGIS capabilities
   - Constitution update required to enforce this policy

## Open Questions

_All major questions resolved. Minor implementation details will be addressed during planning and implementation phases._

## References

- **Layer Types Documentation**: `specs/009-data-formats-and-layer-types/spec.md`
- **Interactive Tools Documentation**: `specs/006-interactive-mapping-tools/spec.md`
- **Configure Page Documentation**: `specs/008-configure-page/spec.md`
- **Tool Configurations**: `configure/public/toolConfigs.json`
- **MMGIS Documentation**: https://nasa-ammos.github.io/MMGIS/
- **Example Mission Configs**: `Missions/MSL/`, `Missions/Earth/`
