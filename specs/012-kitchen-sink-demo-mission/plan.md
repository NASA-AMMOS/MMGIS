# Kitchen Sink Demo Mission - Technical Plan

**Spec Reference**: [spec.md](./spec.md)
**Status**: 📋 Draft
**Created**: 2026-03-05

## Technical Context

**Related Systems**:
- MMGIS Core Configuration System (Frontend direct file load when `FORCE_CONFIG_PATH` set)
- Mission File System (`Missions/` directory structure)
- Frontend Rendering Engines (Leaflet 2D, Cesium 3D, Viewer panel)
- All Tools (`src/essence/Tools/*/`)
- Database Initialization (`scripts/init-db.js` - for test data seeding)

**Dependencies**:
- **External**: None (uses existing MMGIS infrastructure)
- **Internal**:
  - MMGIS v4.1.18 core system
  - PostgreSQL/PostGIS (for geodatasets, optional)
  - All tool modules from `toolConfigs.json`
  - All layer type handlers

**Technology Stack**:
- **Configuration**: JSON (MMGIS mission config format)
- **Data Formats**: GeoJSON, CSV (legends), GeoTIFF/COG (user-provided), OBJ/GLTF/DAE (user-provided)
- **Documentation**: Markdown (README.md)
- **Testing**: Playwright (E2E smoke tests)

**Geographic Context**:
- **Region**: San Francisco Bay Area, California, USA (tentative - subject to data availability)
- **Coordinates**: ~37.8°N, -122.4°W (centered on SF Bay)
- **Projection**: Web Mercator (EPSG:3857)
- **Zoom Levels**: 10-18 (city to street level)
- **Rationale**: Well-known region, abundant open data, familiar to most users
- **Fallback**: Alternative Earth region if SF data unavailable

## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### Principle I: Documentation-First Development
**Compliance**: ✅
**Notes**:
- Spec.md created and reviewed before implementation
- Plan.md documents technical approach
- Tasks.md will break down implementation
- README.md will document usage for admins
- This follows spec-kit workflow completely

### Principle II: Clear Requirements
**Compliance**: ✅
**Notes**:
- 20 functional requirements with measurable acceptance criteria
- 5 non-functional requirements with metrics
- User scenarios are specific and testable
- Success criteria clearly defined
- All requirements can be objectively verified

### Principle III: Incremental Delivery
**Compliance**: ✅
**Notes**:
- Will be broken into phases in tasks.md:
  - Phase 1: Core config structure + Vector layers
  - Phase 2: Tile/Image/Data layers + user-provided assets
  - Phase 3: Model/VectorTile/Velocity/Video layers
  - Phase 4: Tool configurations
  - Phase 5: Testing + documentation
- Each phase independently testable
- Configuration can be deployed incrementally (layers added over time)

### Principle IV: Quality Standards
**Compliance**: ✅
**Notes**:
- **Code Quality**: JSON validation, consistent formatting (4-space indent)
- **Testing**: Playwright smoke tests to validate config loads and tools present
- **Security**: No authentication required (AUTH=off), no sensitive data in config
- **Code Review**: Config changes will be reviewed like code
- **Performance**: Config designed for <5s load time
- **Coverage**: E2E tests will cover all layer types and tools

### Principle V: Node.js and Web Mapping Best Practices
**Compliance**: ✅
**Notes**:
- **GeoJSON**: Standard format for all vector data
- **Coordinate Systems**: Explicit EPSG:3857 projection
- **Layer Organization**: Logical grouping with Header layers
- **Tile Standards**: TMS, WMS, WMTS, XYZ following specifications
- **Performance**: Lightweight data (<5MB vectors), lazy loading for tiles
- **Responsive**: Configuration works on desktop and mobile

### Principle VI: Geospatial Data Integrity
**Compliance**: ✅
**Notes**:
- **CRS Explicit**: All layers specify EPSG:3857 or appropriate CRS
- **Coordinate Validation**: GeoJSON coordinates within valid bounds (-180/180, -90/90)
- **Geodata Quality**: Hand-crafted or validated synthetic data
- **Projection Consistency**: All data in same projection (Web Mercator)
- **Metadata Preservation**: GeoJSON properties include source/provenance info
- **Testing**: Visual QA of all layers, coordinate spot checks

### Principle VII: Real-time Collaboration Safety
**Compliance**: ✅ (Partial - N/A for config-only feature)
**Notes**:
- DrawTool collaboration features configured (intent aliases, templates)
- No new WebSocket code (uses existing DrawTool infrastructure)
- Demo draw files showcase collaboration but don't implement it
- AUTH=off simplifies initial demo (collaboration features work without auth)

### Kitchen Sink Maintenance Requirement
**Compliance**: ✅ (Self-fulfilling)
**Notes**:
- This feature *creates* the Kitchen Sink mission
- Constitution updated to require future features update Kitchen Sink
- Versioning strategy established (match MMGIS version)
- Documentation includes maintenance guidelines

---

## Architecture & Design

### High-Level Architecture

```
Kitchen Sink Mission Structure:

Missions/
└── Kitchen-Sink/
    ├── config.kitchen-sink.json         # Main configuration file
    ├── README.md                         # Usage and documentation
    ├── Data/                             # User-provided raster data
    │   ├── elevation.tif                 # DEM for Measure/Viewshed/Isochrone
    │   ├── slope.tif                     # Slope data for Isochrone
    │   └── cost.tif                      # Cost data for Isochrone
    └── Layers/                           # All layer data (flat files)
        ├── Vectors/                      # GeoJSON vector data
        │   ├── points-basic.geojson
        │   ├── points-styled.geojson
        │   ├── points-symbols.geojson
        │   ├── lines-basic.geojson
        │   ├── lines-styled.geojson
        │   ├── polygons-basic.geojson
        │   ├── polygons-styled.geojson
        │   ├── time-enabled.geojson      # 5 time steps (not 30)
        │   ├── clustered.geojson
        │   ├── TEST-geodataset-example.geojson   # Simulates geodatasets: format
        │   └── TEST-draw-file-example.geojson    # Simulates api:drawn: format
        ├── Legends/                      # Legend files
        │   ├── vector-points.csv
        │   ├── vector-polygons.csv
        │   └── raster-colormap.json
        ├── Tiles/                        # Placeholder for local tiles (optional)
        │   └── README.md                 # Instructions for adding tiles
        ├── Images/                       # Placeholder for GeoTIFF/COG (optional)
        │   └── README.md                 # Instructions for adding images
        └── Models/                       # Placeholder or external URLs
            └── README.md                 # Links to NASA 3D Resources
```

### Component Breakdown

**Component 1: Mission Configuration (config.kitchen-sink.json)**
- **Purpose**: Single comprehensive MMGIS mission configuration showcasing all features
- **Scope**: Earth region, Web Mercator projection, standard Leaflet/Cesium
- **Responsibilities**:
  - Define mission metadata (name: "Kitchen-Sink", site, view, projection)
  - Configure look and feel (colors, logo, UI elements)
  - Define all panels (Viewer, Map, Globe)
  - Configure all tools with representative examples
  - Define all layer types with comprehensive examples
  - Include both local flat file layers and external URL examples
  - Use placeholder URLs for optional user-provided data
  - Organize layers into logical Header groups
  - Clear naming for test/example layers (TEST: prefix)
- **Interfaces**:
  - Loaded by frontend when `FORCE_CONFIG_PATH` is set
  - **TODO: Verify actual FORCE_CONFIG_PATH behavior** (direct file read vs backend serving)
  - Validated against MMGIS config schema
- **Future**: If Mars/Moon configs needed, can refactor to multi-config pattern later

**Component 2: Vector Data Files (Layers/Vectors/\*.geojson)**
- **Purpose**: Demonstrate all vector layer capabilities and styling options (all flat files)
- **Responsibilities**:
  - Showcase Point, LineString, Polygon geometries
  - Demonstrate per-feature and layer-level styling
  - Provide time-enabled features (5 time steps, not 30 days)
  - Include rich properties for Info Tool display
  - Demonstrate clustering and search functionality
  - **Include test examples**:
    - `TEST-geodataset-example.geojson` - Shows what geodatasets: format would return
    - `TEST-draw-file-example.geojson` - Shows what api:drawn: format would return
  - No database seeding - all flat files for simplicity
- **Interfaces**:
  - GeoJSON FeatureCollection format
  - Referenced by vector layer configs via relative paths
  - Loaded by MMGIS frontend Layers_ system

**Component 3: Legend Files (Layers/Legends/\*.csv, \*.json)**
- **Purpose**: Provide legend definitions for layers
- **Responsibilities**:
  - Define symbology for vector layers (CSV format)
  - Define colormaps for raster layers (JSON format)
  - Support gradient scales and discrete categories
- **Interfaces**:
  - CSV format: `value,color,label,shape,symbol`
  - JSON format: `[{"value": 0, "color": "#000", "label": "Low"}, ...]`
  - Referenced by layer `legend` property

**Component 4: Raster Data (External URLs + Optional Local)**
- **Purpose**: Demonstrate tile, image, and data layer types with minimal local dependencies
- **Responsibilities**:
  - **External WMTS/WMS**: Online providers for tile layers
    - ArcGIS World Imagery or Topographic (documented, working examples)
    - OpenStreetMap standard tiles (documented, working examples)
    - Demonstrate external data link capabilities
    - **Not tested in CI/CD** - documented in README only
  - **Optional local tiles**: Placeholder URLs with TODOs
    - Config includes: `"url": "Missions/Kitchen-Sink/Layers/Tiles/basemap/{z}/{x}/{y}.png"`
    - README documents: "Optional: Add your own tiles here"
  - **Optional GeoTIFF/COG**: Placeholder URLs with TODOs
    - Config includes: `"url": "Missions/Kitchen-Sink/Data/elevation.tif"`
    - README documents: "Optional: Add DEM for elevation profiles"
  - **Optional DEM/slope/cost data**: Placeholder URLs with TODOs
    - Measure Tool: `"dem": "Missions/Kitchen-Sink/Data/elevation.tif"`
    - Viewshed Tool: `"demtileurl": "Missions/Kitchen-Sink/Layers/DEMTiles/{z}/{x}/{y}.png"`
    - README documents where to obtain suitable data
- **Interfaces**:
  - External tile URLs: Direct WMTS/WMS endpoints
  - Optional local tiles: TMS/XYZ format (if user provides)
  - Optional GeoTIFF: Georeferenced (if user provides)
  - All optional data clearly marked with TODOs in config comments (via README)

**Component 5: 3D Models (External URLs Only)**
- **Purpose**: Demonstrate Model layer type in Globe view without large file commits
- **Responsibilities**:
  - **External URLs**: Direct links to NASA 3D Resources models
    - Config references: `"url": "https://science.nasa.gov/...model.gltf"`
    - No large files committed to repo (avoids git-lfs, size issues)
  - Demonstrate OBJ, GLTF, DAE formats via external URLs
  - Demonstrate positioning, scaling, rotation in config
  - README documents: "Models loaded from NASA 3D Resources"
- **Interfaces**:
  - External model URLs (direct download links)
  - Referenced by model layer configs
  - Loaded by Cesium in Globe view
- **Alternative**: If external URLs are unstable, create tiny procedural models (<1MB total)

**Component 6: README.md Documentation**
- **Purpose**: Comprehensive usage guide for Kitchen Sink mission
- **Responsibilities**:
  - **Overview**: Purpose of Kitchen Sink (reference, demo, testing)
  - **Usage Instructions**: How to launch with `FORCE_CONFIG_PATH`
    - `FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json npm start`
  - **Layer Catalog**: Document each layer type and what it demonstrates
  - **Tool Configurations**: Explain each tool configuration
  - **Optional Data**: How to add user-provided assets
    - Where to get tiles (USGS, OpenStreetMap TMS)
    - Where to get DEMs (USGS elevation data)
    - Where to get models (NASA 3D Resources)
  - **External Data**: List of external providers used
    - ArcGIS, OpenStreetMap, etc. with attribution
  - **Test Data**: Explain TEST: prefixed layers (simulated geodatasets, draw files)
  - **Adaptation Guide**: Examples for adapting to custom missions
  - **Future Expansion**: Note that multi-config pattern could be added later for Mars/Moon
  - **Troubleshooting**: Common pitfalls and solutions
- **Interfaces**:
  - Markdown format
  - Linked from AGENTS.md and main MMGIS docs

**Component 7: Playwright Test Suite (tests/e2e/kitchen-sink.spec.js)**
- **Purpose**: Smoke tests validating Kitchen Sink configuration
- **Responsibilities**:
  - Validate mission loads without errors
  - Check all configured tools are present in UI
  - Validate vector layers render (flat file GeoJSON only, no external dependencies)
  - Validate TEST: prefixed layers are present
  - Test basic tool interactions (open/close)
  - Performance check (<5s load time)
  - **No external data testing**: External WMTS/WMS not tested (avoids flakiness)
  - **No optional data testing**: Placeholder URLs okay if return 404
- **Interfaces**:
  - Single test file: `tests/e2e/kitchen-sink.spec.js`
  - Playwright test format
  - Runs in CI/CD pipeline
  - Sets `FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json`
- **Future**: If multi-config pattern added, can split into per-config test files

### Data Flow

```
Initialization Flow:
  1. User sets FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json
  2. User starts MMGIS: npm start
  3. Backend init-db.js runs (standard setup, no Kitchen Sink-specific logic)
  4. Backend server starts

Frontend Load Flow:
  5. Frontend detects FORCE_CONFIG_PATH in environment
  6. **TODO: Verify behavior** - Frontend loads config.kitchen-sink.json
     (Need to check if direct file read or backend served)
  7. Frontend Loader_ initializes with config
  8. Frontend initializes Map_ with projection and view
  9. Frontend ToolController_ registers all configured tools
  10. Frontend Layers_ loads all layer definitions

Layer Rendering:
  11. For each vector layer (flat file):
      - Fetch GeoJSON from Layers/Vectors/*.geojson
      - Parse and validate features
      - Apply styling (layer + per-feature)
      - Render to Leaflet/Cesium
  12. For each tile layer (external WMTS/WMS):
      - Initialize tile source with external URL
      - Request tiles from ArcGIS/OSM/etc.
      - If 404/error, shows missing tile icon (expected for demo)
  13. For each tile layer (local, optional):
      - Initialize tile source with URL template
      - Request tiles from Missions/Kitchen-Sink/Layers/Tiles/
      - If 404 (user hasn't provided), shows missing tile icon (expected)
  14. For each image/model layer (optional):
      - Try to load from placeholder URL
      - If 404, layer doesn't render (expected, documented in README)
  15. For each tool:
      - Call tool.make() to initialize UI
      - Load tool-specific data if available (e.g., DEM for Measure)
      - If data missing (404), tool shows appropriate empty state
  16. User interacts with layers and tools

Testing Flow:
  17. Playwright launches MMGIS with FORCE_CONFIG_PATH
  18. Playwright waits for page load
  19. Playwright validates DOM elements (tools present, no crashes)
  20. Playwright checks flat file vector layers loaded
  21. Playwright checks TEST: prefixed layers present
  22. **Skips external WMTS/WMS** (documented but not tested)
  23. **Ignores 404s from optional data** (placeholder URLs expected to fail)
  24. Playwright interacts with tools (clicks, basic opens/closes)
  25. Playwright checks for JavaScript errors in console
  26. Playwright reports pass/fail
```

### Database Changes

**Schema Changes**: None

**Rationale**:
- Kitchen Sink is a configuration-only feature
- Uses existing MMGIS database schema
- No new tables or columns required

**Data Changes**: None

**Rationale**:
- **No database seeding** - Too complex for initial implementation
- All test data uses flat file GeoJSON
- `TEST-geodataset-example.geojson` - Simulates what geodatasets: format returns
- `TEST-draw-file-example.geojson` - Simulates what api:drawn: format returns
- Config can reference these flat files to demonstrate database features
- Future enhancement could add actual database seeding if needed

**Migration Strategy**:
- No migration needed (no changes)

---

## API Contracts

**No New APIs**: Kitchen Sink uses existing MMGIS APIs.

### Frontend Configuration Loading:

**FORCE_CONFIG_PATH Behavior**:
- **Purpose**: Override default config loading
- **Behavior**: Frontend directly reads flat file at path specified by `FORCE_CONFIG_PATH`
- **Bypass**: Does NOT query backend `/API/config` endpoint
- **No changes required**: Existing MMGIS behavior

### Existing APIs Used:

**GET /Missions/Kitchen-Sink/Layers/Vectors/\*.geojson**
- **Purpose**: Serve vector GeoJSON files
- **Behavior**: Static file serving via Express
- **No changes required**

**GET /Missions/Kitchen-Sink/Data/\*.tif**
- **Purpose**: Serve raster data files
- **Behavior**: Static file serving via Express
- **No changes required**

**DrawTool APIs** (no changes):
- `GET /API/files` - List draw files
- `GET /API/files/:id` - Get specific draw file
- `POST /API/files` - Create new draw file
- **No changes**: No test flag checking, no hiding logic

**Geodatasets APIs** (no changes):
- `GET /API/geodatasets` - List geodatasets
- `GET /API/geodatasets/:id` - Get geodataset features
- **No changes**: No test flag checking, no hiding logic

**External APIs** (no changes, consumption only):
- ArcGIS WMTS endpoints
- OpenStreetMap tile servers
- Google Maps tile APIs (if available)
- NASA 3D Resources download links

---

## Technical Decisions

### Decision 1: Geographic Location - San Francisco Bay Area

**Context**: Need to choose a real-world region for demo that is:
- Recognizable and familiar
- Well-documented with open data
- Diverse terrain (water, urban, hills)
- Appropriate coordinate range for testing

**Options Considered**:
1. **Mars (Jezero Crater)** - Pros: Representative of primary MMGIS use case; Cons: Requires Mars data, less familiar to general audience
2. **Moon (South Pole)** - Pros: Scientifically interesting; Cons: Limited open data, less familiar
3. **San Francisco Bay Area** - Pros: Familiar, abundant open data, diverse terrain; Cons: Less representative of space missions
4. **Grand Canyon** - Pros: Dramatic terrain, interesting elevation; Cons: Less urban features

**Decision**: San Francisco Bay Area

**Rationale**:
- User specified Earth region
- Familiar landmark for demos
- Abundant open data (OpenStreetMap, USGS elevation, etc.)
- Diverse features: water bodies, urban areas, hills, parks
- Good coordinate range for testing (-122.5 to -122.0°W, 37.5 to 38.0°N)
- Can later expand to planetary bodies in separate configs

**Consequences**:
- Easier to source basemap tiles and elevation data
- More relatable for stakeholders unfamiliar with planetary science
- May need separate Mars/Moon Kitchen Sink configs later for planetary use cases

### Decision 2: Data Synthesis Strategy (Simplified)

**Context**: Need to demonstrate all layer types without complex dependencies or blocking on user assets.

**Options Considered**:
1. **All Flat Files** - Pros: Simple, portable, no dependencies; Cons: Doesn't show DB integration
2. **DB Seeding + Flat Files** - Pros: Shows all features; Cons: Complex init-db logic
3. **Flat Files + External URLs** - Pros: Simple, shows external data; Cons: External dependencies
4. **Flat Files + Placeholders** - Pros: Simple, self-documenting; Cons: Incomplete initially

**Decision**: Flat Files + External URLs + Placeholders

**Rationale**:
- **Vector data**: All hand-crafted flat file GeoJSON
  - Full control over styling examples
  - Lightweight files (<1MB each, total <5MB)
  - Educational property names and values
  - Include `TEST-geodataset-example.geojson` to simulate database geodatasets
  - Include `TEST-draw-file-example.geojson` to simulate DrawTool files
  - **No actual database seeding** - too complex for Phase 1
- **Raster tiles**: External WMTS/WMS providers
  - ArcGIS World Imagery (documented working URL)
  - OpenStreetMap (documented working URL)
  - No local storage needed
  - Demonstrates external data link capabilities
  - **Not tested in CI/CD** - documented in README only
- **Optional local raster**: Placeholder URLs with TODOs
  - Config: `"url": "Missions/Kitchen-Sink/Data/elevation.tif"`
  - README: "Optional: Add your own DEM here"
  - 404 errors expected and acceptable
  - **No implementation blocking** - users can add later
- **3D Models**: External URLs to NASA 3D Resources
  - Direct links: `"url": "https://science.nasa.gov/.../model.gltf"`
  - No large files in repo (avoids git-lfs)
  - Demonstrates model loading
- **Time-enabled data**: 5 time steps (not 30 days)
  - Simple to generate
  - Sufficient to demonstrate feature

**Consequences**:
- ✅ Simple implementation (no init-db changes, no tool modifications)
- ✅ No blocking on user assets (placeholders with TODOs)
- ✅ Portable (all flat files, no DB dependencies)
- ✅ External data demonstrates real-world usage
- ✅ Self-documenting (README explains optional data)
- ⚠️ External URLs may break over time (but easily updated)
- ⚠️ Doesn't test actual DB geodatasets/draw files (shows flat file examples instead)

### Decision 3: Layer Organization Strategy

**Context**: Need to organize 30+ layers in a way that is logical for admins and doesn't overwhelm UI.

**Options Considered**:
1. **Flat List** - Pros: Simple; Cons: Overwhelming, hard to find examples
2. **Group by Type** - Pros: Logical separation; Cons: Mixed concerns within groups
3. **Group by Feature** - Pros: Educational; Cons: Redundancy, harder to browse
4. **Hierarchical Headers** - Pros: Clean UI, logical grouping; Cons: More complex config

**Decision**: Hierarchical Header Layers by Type

**Rationale**:
- MMGIS Header layers provide collapsible grouping
- Organize as follows:
  ```
  📁 Vector Layers
    📁 Points
      - Vector - GeoJSON - Points Basic
      - Vector - GeoJSON - Points Styled
      - Vector - GeoJSON - Points Symbols
    📁 Lines
      - Vector - GeoJSON - Lines Basic
      - Vector - GeoJSON - Lines Styled
    📁 Polygons
      - Vector - GeoJSON - Polygons Basic
      - Vector - GeoJSON - Polygons Styled
    📁 Advanced
      - Vector - GeoJSON - Time-Enabled
      - Vector - GeoJSON - Clustered
      - Vector - GeoJSON - With Search
  📁 Raster Layers
    📁 Tiles
      - Tile - TMS - Basemap
      - Tile - XYZ - Overlay
      - Tile - WMS - GetCapabilities
      - Tile - WMTS - Standard
      - Tile - Time-Enabled
    📁 Images
      - Image - GeoTIFF - Single Band
      - Image - COG - Cloud Optimized
      - Image - Time-Enabled
    📁 Data Layers
      - Data - WebGL - Elevation
      - Data - WebGL - Custom Shader
  📁 3D Assets
    - Model - OBJ - With Texture
    - Model - GLTF - Animated
    - Model - DAE - Collada
    - Model - Time-Enabled
  📁 Advanced Layers
    - VectorTile - MVT - Styled
    - Velocity - Flow - Streamlines
    - Velocity - Wind - Particles
    - Video - Georeferenced
  ```

**Consequences**:
- Clean, navigable layer structure
- Easy to find specific examples
- Header layers demonstrate organizational feature
- Requires careful config ordering (headers before children)

### Decision 4: Tool Configuration Completeness

**Context**: Some tools have complex configurations with many optional fields. Need to decide how comprehensive to be.

**Options Considered**:
1. **Minimal Config** - Only required fields; Pros: Simple; Cons: Doesn't showcase features
2. **Maximum Config** - Every possible option; Pros: Comprehensive; Cons: Overwhelming, may include irrelevant options
3. **Representative Config** - Common use cases; Pros: Practical; Cons: May miss edge cases
4. **Tiered Config** - Basic + advanced sections; Pros: Clear progression; Cons: More documentation needed

**Decision**: Representative Config with Maximum Reasonable Options

**Rationale**:
- Enable all tools from `toolConfigs.json`
- For each tool, configure:
  - All common/recommended options
  - 1-2 advanced options to show possibility
  - Skip experimental/deprecated options
  - Document in README what's omitted and why
- Examples:
  - Draw Tool: All intent aliases, multiple templates, dynamic extent enabled
  - Measure Tool: DEM configured, layer-specific DEMs, default mode set
  - Viewshed Tool: DEM tilesets, camera presets, curvature enabled
  - Isochrone Tool: DEM/slope/cost sources, multiple models enabled

**Consequences**:
- Admins see practical, production-ready configurations
- Advanced users discover additional options by reading docs
- Config file remains manageable (~2000-3000 lines JSON)
- Balance between comprehensive and overwhelming

### Decision 5: Single Config for Phase 1 (Defer Multi-Config)

**Context**: One configuration cannot showcase all MMGIS capabilities (Earth vs Mars projections, Cesium vs LithoSphere, etc.)

**Options Considered**:
1. **Multi-Config from Start** - Pros: Future-proof; Cons: YAGNI, over-engineering
2. **Single Config, Refactor Later** - Pros: Simple, YAGNI compliant; Cons: May need refactoring
3. **Single Config with Placeholders** - Pros: Documents pattern; Cons: Confusing if unused

**Decision**: Single Config for Phase 1, Refactor When Needed

**Rationale**:
- **YAGNI Principle**: Don't build for future requirements that may never materialize
- **Simplicity**: One `config.kitchen-sink.json` easier to understand and maintain
- **Focus**: Earth, Web Mercator, Leaflet/Cesium covers most use cases
- **Easy Refactoring**: When Mars/Moon configs actually needed:
  - Rename `config.kitchen-sink.json` → `config.kitchen-sink-earth.json`
  - Create `config.kitchen-sink-mars.json`
  - Update README with multi-config pattern
  - Update tests to parametrize over configs
- **No Wasted Effort**: Don't document pattern until pattern exists

**Phase 1 Scope**:
- Create: `config.kitchen-sink.json` (Earth, Web Mercator, standard tools)
- Document: This is the default/only config
- Test: Single test file `kitchen-sink.spec.js`

**Future** (when actually needed):
- Refactor to `config.kitchen-sink-{name}.json` pattern
- Add Mars/Moon/projection-specific configs
- Split tests per config
- Update README with pattern documentation

**Consequences**:
- ✅ Simpler initial implementation
- ✅ No premature optimization
- ✅ Easier to understand for users
- ✅ Less documentation burden
- ⚠️ Will need refactoring if multi-config needed (but that's okay)

### Decision 6: Multi-Config Architecture (Deferred)

**Context**: One configuration cannot showcase all MMGIS capabilities. Different planets require different projections, coordinate systems, renderers, and feature sets.

**Options Considered**:
1. **Single Mega-Config** - One config tries to show everything; Pros: Simple; Cons: Impossible (can't have Mars and Earth projection simultaneously)
2. **Separate Missions** - Multiple mission directories; Pros: Complete separation; Cons: Code duplication, harder to maintain
3. **Multi-Config Pattern** - Multiple configs in one mission directory; Pros: Organized, maintainable; Cons: Need naming convention
4. **Dynamic Config** - One config with conditional sections; Pros: Single file; Cons: Complex, hard to test

**Decision**: Multi-Config Pattern (`config.kitchen-sink-{name}.json`)

**Rationale**:
- **Impossible to unify**: Can't have Earth (EPSG:3857) and Mars (cylindrical) projection in same config
- **Different renderers**: LithoSphere (Mars/Moon) vs Cesium (Earth) require different configs
- **Different feature sets**: Planetary missions use SPICE, Earth missions use standard time
- **Testing benefits**: Playwright can test each config independently
- **Maintainability**: Shared data files, separate config logic
- **Extensibility**: Easy to add new configs without breaking existing

**Note**: Multi-config architecture deferred to future work. If needed, can refactor following this decision's guidance.

### Decision 7: Testing Scope (Simplified)

**Context**: Determine how comprehensive E2E tests should be for Kitchen Sink.

**Options Considered**:
1. **Smoke Tests Only** - Config loads, tools present; Pros: Fast, simple; Cons: Shallow coverage
2. **Full Interaction Tests** - Test every tool interaction; Pros: Comprehensive; Cons: Time-consuming, brittle
3. **Layered Approach** - Smoke tests now, interaction tests later; Pros: Incremental; Cons: Deferred value
4. **Selective Deep Tests** - Smoke tests + deep tests for critical tools; Pros: Balanced; Cons: Requires judgment

**Decision**: Smoke Tests Only (Interaction Tests Deferred)

**Rationale**:
- **Phase 1 Tests** (This Feature):
  - Mission loads without errors (no crashes, no console errors)
  - All configured tools present in UI (DOM elements exist)
  - Flat file vector layers render (GeoJSON loads successfully)
  - TEST: prefixed layers present
  - Performance check (<5s load time)
  - **No external data testing** - ArcGIS/OSM tiles not tested (avoid flakiness)
  - **No optional data testing** - 404s from placeholder URLs are expected/acceptable
  - Basic validation only - config is well-formed and loads
- **Phase 2** (Future Work):
  - Deep interaction tests for each tool
  - User workflow E2E tests
  - External data validation
  - Optional data validation when user provides
- Align with user's stated approach and simplification goals

**Consequences**:
- Kitchen Sink available for E2E testing immediately
- Basic validation ensures config is correct
- Interaction tests can be added incrementally
- Matches spec-kit incremental delivery principle

---

## Implementation Notes

### Code Quality

**JSON Formatting**:
- 4-space indentation (consistent with MMGIS codebase)
- Trailing commas avoided (JSON standard)
- Keys alphabetically ordered where logical
- Comments via README (JSON doesn't support comments)

**GeoJSON Formatting**:
- 2-space indentation (GeoJSON convention)
- `type` property first in each object
- `properties` before `geometry` in features
- Coordinates formatted as `[lon, lat]` (GeoJSON standard)

**Naming Conventions**:
- Layers: `[Type] - [Format] - [Feature]` (e.g., "Vector - GeoJSON - Points Basic")
- Files: `kebab-case.geojson` (e.g., `points-styled.geojson`)
- Properties: `camelCase` (e.g., `startTime`, `endTime`)

### Testing Strategy

**Unit Tests**: None (configuration only, no new code)

**Integration Tests**: None (uses existing MMGIS APIs)

**E2E Tests** (Playwright):
```javascript
// tests/e2e/kitchen-sink.spec.js
describe('Kitchen Sink Mission', () => {
  beforeEach(async () => {
    // Launch with FORCE_CONFIG_PATH
    await page.goto('http://localhost:8888');
  });

  test('mission loads successfully', async () => {
    // Check for map container
    await expect(page.locator('#map')).toBeVisible();
    // Check for no error modals
    await expect(page.locator('.error')).not.toBeVisible();
  });

  test('all tools are present', async () => {
    // Check each tool from toolConfigs.json
    await expect(page.locator('[data-tool="Layers"]')).toBeVisible();
    await expect(page.locator('[data-tool="Draw"]')).toBeVisible();
    await expect(page.locator('[data-tool="Measure"]')).toBeVisible();
    // ... etc for all tools
  });

  test('vector layers render', async () => {
    // Open Layers tool
    await page.click('[data-tool="Layers"]');
    // Toggle on a vector layer
    await page.click('[data-layer="Vector - GeoJSON - Points Basic"]');
    // Check for rendered features
    await expect(page.locator('.leaflet-marker-pane')).not.toBeEmpty();
  });

  test('performance: mission loads in <5 seconds', async () => {
    const startTime = Date.now();
    await page.goto('http://localhost:8888');
    await page.waitForSelector('#map', { state: 'visible' });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });
});
```

**Target Coverage**:
- 100% of layer types validated
- 100% of tools present checked
- Basic smoke tests only (deep interaction tests deferred)

### Security Considerations

**No New Security Risks**:
- Kitchen Sink is configuration only (no new code)
- Uses existing MMGIS authentication (AUTH=off for demo)
- No sensitive data in config or sample files
- Static file serving only (no dynamic content)

**Considerations**:
- `FORCE_CONFIG_PATH` env var prevents accidental production use
- README warns that Kitchen Sink is for demo/testing only
- Sample data is synthetic (no real mission data)
- DrawTool pre-populated files are public (no access control)

### Performance Considerations

**Load Time Optimization**:
- Vector files kept small (<1MB each, total <5MB)
- Lazy loading for tiles (only fetch visible tiles)
- Layer `initialVisibility: false` for most layers (user toggles on)
- No unnecessary tool auto-opens (let user explore)

**Runtime Optimization**:
- Clustering enabled for point-dense vector layers
- `visibilityCutoff` set for complex layers
- Tile layers use appropriate min/max zoom
- DEM files reasonable resolution (not excessive)

**Metrics**:
- Initial load: <5 seconds (NFR-001)
- Tool open: <500ms (constitution)
- Layer toggle: <500ms (NFR-001)
- Tile request: <200ms (constitution)

---

## Rollout Plan (Simplified)

### Phase 1: Core Config + All Vector Layers
**Duration**: 1-2 days

**Deliverables**:
- Mission directory structure created:
  - `Missions/Kitchen-Sink/`
  - `Missions/Kitchen-Sink/Layers/Vectors/`
  - `Missions/Kitchen-Sink/Layers/Legends/`
  - `Missions/Kitchen-Sink/Layers/Tiles/` (with README)
  - `Missions/Kitchen-Sink/Layers/Images/` (with README)
  - `Missions/Kitchen-Sink/Layers/Models/` (with README)
  - `Missions/Kitchen-Sink/Data/` (with README)
- **`config.kitchen-sink.json`** with:
  - Mission metadata (msv: mission="Kitchen-Sink", Earth region)
  - Projection: Web Mercator (EPSG:3857)
  - Panels: Viewer, Map (Leaflet), Globe (Cesium)
  - Tools configuration (all tools enabled with representative config)
  - All vector layer definitions (11 flat file examples)
  - Tile layer definitions (external WMTS/WMS + placeholder local)
  - Image/Model layer definitions (placeholder URLs with TODOs)
  - Header layers for logical organization
- **Vector GeoJSON files** (11 files):
  - points-basic.geojson
  - points-styled.geojson
  - points-symbols.geojson
  - lines-basic.geojson
  - lines-styled.geojson
  - polygons-basic.geojson
  - polygons-styled.geojson
  - time-enabled.geojson (5 time steps)
  - clustered.geojson
  - TEST-geodataset-example.geojson
  - TEST-draw-file-example.geojson
- **Legend files** (3 files):
  - vector-points.csv
  - vector-polygons.csv
  - raster-colormap.json
- **README.md** basic structure

**Success Criteria**:
- Mission loads with `FORCE_CONFIG_PATH` set
- All vector layers render correctly (flat files only)
- All tools present in UI
- No JavaScript console errors
- Config is well-formed and documented

### Phase 2: External Raster + Tool Configuration
**Duration**: 1 day

**Deliverables**:
- **External WMTS/WMS tile layers** (configured, not local):
  - ArcGIS World Imagery URL (documented)
  - OpenStreetMap URL (documented)
  - Appropriate attribution in config
- **Placeholder raster layers** (TODOs, no blocking):
  - Local tile layer: `"url": "Missions/Kitchen-Sink/Layers/Tiles/basemap/{z}/{x}/{y}.png"` (404 okay)
  - Image layers: `"url": "Missions/Kitchen-Sink/Data/sample.tif"` (404 okay)
  - Data layer: `"url": "Missions/Kitchen-Sink/Data/elevation.tif"` (404 okay)
- **Tool configurations completed**:
  - Draw Tool: Intent aliases, templates
  - Sites Tool: Multiple sites
  - TimeControl: Time-enabled layers with 5 time steps
  - Measure Tool: DEM path (placeholder, 404 okay)
  - Identifier Tool: Layer/tif mappings (placeholders)
  - Viewshed Tool: DEM tilesets (placeholders)
  - Isochrone Tool: Data sources (placeholders)
  - Legend Tool: CSV/JSON legends
  - Info Tool: sortAlphabetically enabled
- **Model layers** (external URLs):
  - OBJ model: External NASA URL
  - GLTF model: External NASA URL
  - DAE model: External NASA URL (if available)

**Success Criteria**:
- External WMTS/WMS tiles load (ArcGIS, OSM)
- Placeholder URLs return 404 (expected, documented)
- All tools configured and functional
- Models load from external URLs (if URLs stable)
- No critical errors

### Phase 3: Documentation + Testing
**Duration**: 1 day

**Deliverables**:
- **README.md complete** with:
  - Overview: Purpose of Kitchen Sink
  - Usage: `FORCE_CONFIG_PATH=Missions/Kitchen-Sink/config.kitchen-sink.json npm start`
  - Layer Catalog: What each layer demonstrates
  - Tool Catalog: What each tool configuration shows
  - **Optional Data Section**:
    - Where placeholder URLs point
    - How to add local tiles (USGS, custom TMS)
    - How to add DEMs (USGS elevation data)
    - How to add models (NASA 3D Resources)
  - External Data: Attribution for ArcGIS, OSM
  - TEST: Layers: Explanation of simulated geodatasets/draw files
  - Future Expansion: Note about potential multi-config pattern
  - Troubleshooting: Common issues
- **Playwright smoke tests**:
  - Single file: `tests/e2e/kitchen-sink.spec.js`
  - Mission loads without crashes
  - All tools present
  - Flat file vector layers render
  - TEST: layers present
  - Performance <5s
  - **Ignores 404s** from placeholders
  - **Skips external WMTS/WMS** testing (documented only)
- **AGENTS.md updated** with Kitchen Sink reference
- **Constitution compliance** verified

**Success Criteria**:
- README is comprehensive and clear
- Admins understand how to use Kitchen Sink
- Admins know how to add optional data
- Playwright tests pass consistently (<5% flakiness)
- Tests validate config loads properly
- Mission loads in <5 seconds
- All FR-001 through FR-020 acceptance criteria met (with placeholders acceptable)
- PR ready for review

---

## Risks & Mitigations

**Risk 1**: User-provided assets not available (RESOLVED)
- **Impact**: ~~High~~ → **None** - No longer blocking
- **Likelihood**: ~~Medium~~ → **N/A**
- **Resolution**:
  - ✅ All user assets now optional with placeholder URLs
  - ✅ External URLs for models (NASA 3D Resources)
  - ✅ External URLs for tiles (ArcGIS, OSM)
  - ✅ README documents how to add optional data
  - ✅ 404 errors expected and acceptable
  - ✅ No implementation blocking

**Risk 2**: Configuration file becomes too large or complex
- **Impact**: Low - Manageable with simplifications
- **Likelihood**: Low - Simplified approach reduces size
- **Mitigation**:
  - Representative config, not exhaustive (per decision)
  - ~1500-2000 lines JSON (down from 2500+ estimate)
  - Clear hierarchical organization with headers
  - README explains sections
  - Placeholder URLs reduce config bloat (no inline base64 data)
  - Can be documented via README rather than inline comments

**Risk 3**: Performance degrades with all layers/tools enabled
- **Impact**: High - violates NFR-001 (<5s load time)
- **Likelihood**: Low - most layers start invisible, lazy loading
- **Mitigation**:
  - Set `initialVisibility: false` for most layers
  - Use lightweight vector data (<5MB total)
  - Implement clustering for dense point layers
  - Set appropriate min/max zoom for tile layers
  - Profile during Phase 5, optimize if needed
  - README includes performance best practices

**Risk 4**: Kitchen Sink becomes stale as MMGIS adds features
- **Impact**: High - defeats purpose as living documentation
- **Likelihood**: Medium - requires discipline
- **Mitigation**:
  - Constitution updated with maintenance requirement ✅
  - Pre-merge checklist includes Kitchen Sink update ✅
  - Version Kitchen Sink to match MMGIS version ✅
  - CI/CD validates Kitchen Sink config loads ✅
  - Single config simpler to maintain than multi-config
  - If feature doesn't fit Earth/Web Mercator, document need for new config variant
  - Regular audits during major releases

**Risk 7**: External data dependencies (REVISED)
- **Impact**: Medium - External URLs may break over time
- **Likelihood**: Medium - Services change, deprecate APIs
- **Mitigation**:
  - Use stable providers (ArcGIS, OSM - long history)
  - README documents how to update URLs
  - CI/CD tests don't depend on external data (smoke tests only)
  - If external URL breaks, easy to update config
  - Alternative: Can switch to local placeholder if needed

**Risk 8**: FORCE_CONFIG_PATH behavior assumption incorrect
- **Impact**: High - Architecture may be wrong
- **Likelihood**: Low - But need to verify
- **Mitigation**:
  - **Action item**: Verify FORCE_CONFIG_PATH behavior before Phase 2
  - Check: Does frontend read file directly or backend serve it?
  - Update data flow in plan if needed
  - Add TODO in plan to verify

**Risk 5**: Playwright tests are flaky or slow
- **Impact**: Medium - CI/CD delays, false negatives
- **Likelihood**: Medium - E2E tests are inherently flaky
- **Mitigation**:
  - Keep Phase 1 tests simple (smoke tests only)
  - Use explicit waits (not implicit timeouts)
  - Test against stable, synthetic data (no external dependencies)
  - Retry failed tests (Playwright built-in)
  - Target <5% flakiness (NFR-003)
  - Defer complex interaction tests to Phase 2

**Risk 6**: Confusion between Kitchen Sink and production missions
- **Impact**: Medium - users accidentally use demo config
- **Likelihood**: Low - requires explicit `FORCE_CONFIG_PATH`
- **Mitigation**:
  - `FORCE_CONFIG_PATH` required (not default)
  - README clearly states demo/testing purpose
  - Mission name "Kitchen Sink" is obviously non-production
  - No real mission data included
  - Documentation warns against production use

---

## Open Technical Questions

1. **FORCE_CONFIG_PATH Behavior**: Does frontend read file directly or backend serve it?
   - **Status**: ⚠️ **NEEDS VERIFICATION**
   - **Action**: Check actual MMGIS code before Phase 2
   - **Impact**: Data flow may need correction

2. **Geographic Region**: SF Bay Area or alternative Earth region?
   - **Resolution**: SF Bay Area preferred, but not critical (synthetic data works anywhere)
   - **Coordinates**: Can use any Earth coordinates with Web Mercator

3. **External WMTS/WMS Providers**: Which specific providers to use?
   - **Resolution**: Research stable providers:
     - ArcGIS World Imagery (documented endpoint)
     - OpenStreetMap standard tiles (documented endpoint)
     - Include attribution strings in config

4. **NASA 3D Model URLs**: Which specific models and are URLs stable?
   - **Resolution**: During Phase 2:
     - Find 2-3 small models from NASA 3D Resources
     - Get direct download URLs
     - Document in config comments
     - If URLs unstable, consider tiny procedural models instead

5. **Time Range for Time-Enabled Layers**: How many time steps?
   - **Resolution**: 5 time steps (simplified from 30 days)
   - **Format**: ISO timestamps with 1-day intervals
   - **Sufficient**: Demonstrates time control without excessive data

6. **Optional Layer Types**: Skip VectorTile, Velocity, Video?
   - **Resolution**: Include in config with placeholder URLs
   - **Document**: README explains these are optional/advanced
   - **No blocking**: 404s are acceptable

7. **Test Data Naming**: How to name simulated geodatasets/draw files?
   - **Resolution**: Use "TEST-" prefix (e.g., "TEST-geodataset-example.geojson")
   - **No hiding logic**: Just clear naming

8. **CI/CD Integration**: Where do Playwright tests run?
   - **Resolution**: Add to existing CI/CD pipeline
   - **Run on**: PR and main branch pushes
   - **Fast**: Smoke tests only, no external dependencies

---

**Plan Status**: Ready for task breakdown (tasks.md)

**Next Steps**:
1. Review plan with stakeholders
2. Break down into tasks with `/speckit.tasks`
3. Begin Phase 1 implementation with `/speckit.implement`
