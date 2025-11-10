---
layout: page
title: Animation
permalink: /tools/animation
parent: Tools
---

# Animation Tool

The Animation Tool allows users to create smooth animated sequences of map data by selecting a bounding box area, defining a time range, and configuring export settings. Users can export animations as GIF, MP4, or image sequences with optional text overlays.

## Features

- **Bounding Box Selection**: Draw on the map or enter coordinates manually to define the animation area (screen-aligned rectangles)
- **Time Range Configuration**: Set start/end dates and time intervals (second, minute, hour, day, week, month, year, decade, century) with step multiplier
- **TimeControl Integration**: Automatic synchronization with MMGIS TimeControl and TimeUI for seamless time-based layer updates
- **Export Settings**: Configure frame rate, play direction, and loop settings for export
- **Text Overlays**: Optional title and timestamp overlays on exported frames
- **Scale Bar**: Option to include or exclude scale bar in exported frames
- **Export Options**: Export as GIF, MP4 video, or individual PNG image sequence

## Usage

### Step 1: Select Area
- Use the "Draw on Map" button to interactively select a bounding box
- Use "Use Current View" to capture the current map extent
- Or manually enter north, south, east, west coordinates

### Step 2: Set Time Range
- Choose start and end dates for your animation
- Set the step multiplier (number of time intervals per frame)
- Select the time interval between frames (second, minute, hour, day, week, month, year, decade, century)
- The tool automatically syncs with MMGIS TimeControl and TimeUI

### Step 3: Configure Export Settings
- Set frame rate (0.05 - 10 FPS) using the "One Frame" slider
- Choose play direction (forward, backward) for export
- Enable/disable looping for GIF exports
- Optionally add a title that will appear as an overlay
- Enable/disable time step display as an overlay
- Enable/disable scale bar inclusion in frames

### Step 4: Export
- Choose export format (GIF, MP4, or image sequence)
- Click the export button for your desired format
- Monitor export progress in the button text
- Download the generated file(s)

**Note**: During export, the tool will:
- Temporarily hide UI elements for clean frames
- Update time-enabled layers for each frame
- Crop frames to the selected bounding box area
- Apply text overlays if configured
- Restore the original map view and TimeControl state after export

## Configuration

The Animation Tool has no configurable variables. All settings (frame rate, time range, bounding box, export options) are configured through the tool's user interface during use. The tool provides a step-by-step interface that guides users through:

1. Selecting the animation area (bounding box)
2. Setting the time range and intervals
3. Configuring export settings (frame rate, overlays, scale bar)
4. Exporting the animation in the desired format

## TimeControl Integration

The Animation Tool integrates deeply with MMGIS's TimeControl and TimeUI systems:

- **Bidirectional Sync**: Changes in TimeUI (Step dropdown, Every dropdown, Rate input) automatically update the Animation Tool settings, and vice versa
- **Time Range Sync**: Start and end dates sync with TimeControl's time range settings
- **Real-time Updates**: Time-enabled layers update automatically as frames are generated
- **State Preservation**: Original TimeControl state is preserved and restored after export completion

## Technical Details

### Frame Capture
The tool captures frames using HTML2Canvas:
- Frames are captured directly from the map container (`#mapScreen`)
- UI elements are temporarily hidden during capture for clean frames
- SVG layers and tile layers are handled with special positioning fixes
- Canvas is cropped to the selected bounding box area
- Dimensions are adjusted to be even (required for H.264 video encoding)

### Export Formats

#### GIF Export
- Uses gifshot library for creation
- Frame rate determines animation speed
- Optimized for web sharing
- Falls back gracefully if GIF creation fails

#### MP4 Export
- Uses FFmpeg WASM for video encoding
- H.264 codec with yuv420p pixel format
- CRF 23 quality setting
- Faststart flag for web streaming optimization
- Progress updates during encoding

#### Image Sequence
- Individual PNG frames exported
- Filenames include optional title prefix (sanitized)
- Frame numbering with zero-padding (e.g., `frame_000.png`, `frame_001.png`)
- All frames download sequentially

### Text Overlays
- Title overlay: Optional custom text displayed in top-left corner
- Time step overlay: Optional timestamp displayed below title (format: `YYYY-MM-DD HH:MM:SS`)
- Text rendered with white stroke (border) and black fill for readability
- Font size is responsive based on canvas dimensions

## Integration with MMGIS

The Animation Tool integrates with MMGIS's existing systems:
- Uses MMGIS's `Map_` module for bounding box selection and coordinate conversion
- Integrates with `TimeControl` and `TimeUI` for time-based layer management
- Uses Leaflet Draw for interactive bounding box drawing
- Follows MMGIS's tool architecture and styling conventions
- Temporarily hides UI elements (toolbar, zoom controls, compass, etc.) during frame capture
- Supports conditional visibility of scale bar based on user preference
- Handles projection changes and map view updates

## Dependencies

- jQuery for DOM manipulation and event handling
- D3.js for initial tool panel setup
- Leaflet and Leaflet Draw for map interaction and bounding box drawing
- HTML2Canvas for map frame capture
- gifshot for GIF creation
- @ffmpeg/ffmpeg and @ffmpeg/util for MP4 video encoding
- MMGIS core modules:
  - `Map_` for map operations
  - `TimeControl` and `TimeUI` for time management
  - `Modal` for user alerts
  - `ToolController_` for tool lifecycle
- Material Design Icons for UI elements

## Notes

### Bounding Box Drawing
- Uses Leaflet Draw rectangle tool
- Creates screen-aligned rectangles for consistent frame cropping
- Supports drawing mode with ESC key cancellation
- Drawing layer is automatically hidden during export

### Frame Generation
- Frames are generated sequentially with small delays to prevent UI blocking
- Each frame updates TimeControl to refresh time-enabled layers
- Original TimeControl state is stored and restored after export

### Performance Considerations
- Large time ranges with small intervals may generate many frames
- Export process is asynchronous with progress feedback
- MP4 encoding may take time for large frame counts
- Browser memory limits may affect very large animations

