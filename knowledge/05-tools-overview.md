# Interactive Tools

MMGIS provides 16 plugin-based interactive tools. Each tool is a self-contained module in `src/essence/Tools/ToolName/` with `make()` and `destroy()` lifecycle methods.

## Tool Summary

| Tool | Directory | Description |
|------|-----------|-------------|
| **Animation** | `Tools/Animation/` | Create map animations (GIF/MP4) |
| **Chemistry** | `Tools/Chemistry/` | Chemical composition visualization (e.g., LIBS spectra) |
| **Curtain** | `Tools/Curtain/` | GPR subsurface imagery and cross-section viewer |
| **Draw** | `Tools/Draw/` | Collaborative vector drawing with versioned history |
| **Identifier** | `Tools/Identifier/` | Query raw pixel values from remote rasters |
| **Info** | `Tools/Info/` | Display feature properties on click |
| **Isochrone** | `Tools/Isochrone/` | Terrain traversability and travel-time analysis |
| **Kinds** | `Tools/Kinds/` | Layer click behavior configuration |
| **Layers** | `Tools/Layers/` | Layer management interface (toggle, reorder, opacity) |
| **Legend** | `Tools/Legend/` | Dynamic map legend display from `legend.csv` |
| **Measure** | `Tools/Measure/` | Distance measurement and elevation profiles |
| **Query** | `Tools/Query/` | Spatial query interface for geodatasets |
| **Shade** | `Tools/Shade/` | Sun/shadow illumination simulation (requires SPICE) |
| **Sites** | `Tools/Sites/` | Quick navigation bookmarks for saved locations |
| **TimeControl** | via `Basics/TimeControl_/` | Temporal data filtering and playback |
| **Viewshed** | `Tools/Viewshed/` | Line-of-sight visibility analysis |

## Tool Lifecycle

1. User clicks tool icon → `make()` is called
2. Tool renders into `#toolPanel` or `#tools` div
3. User clicks another tool → `destroy()` is called for cleanup

## Key Tools

### Draw Tool

The most complex tool. Provides collaborative vector editing with:
- Multi-user real-time sync via WebSockets
- Versioned file history with undo
- Feature templates for metadata validation
- Lead/review/publish workflow for quality control
- Intents (ROI, Campaign, Trail, etc.) for semantic categorization
- File operations: create, edit, delete, merge, split, clip

### Measure Tool

Distance and elevation profiling:
- Click-to-measure on the map
- Elevation profiles along paths (requires DEM tiles)
- Coordinate readout

### Layers Tool

Layer management:
- Toggle layer visibility
- Adjust opacity
- Reorder layer draw order
- Filter layers by category

## Tool Configuration

Tools are enabled/disabled per mission in the Configure page → Tools tab. Each tool can have custom configuration variables defined in its `config.json`.

See `docs/pages/Tools/` for individual tool documentation.
