## Tool: Sightline

_Computes and visualizes line-of-sight visibility to orbiting or celestial targets over terrain._

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visibility map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Interface

Each sightline item is an independent sightline map with its own source, observer, display settings, and mode. Multiple sightline items can exist simultaneously, each identified by a colored left border.

- _Time_
  - The shared time section at the top of the tool. Shows **Start Time**, **End Time**, and **Step Size (min)**. Start and End times are in ISO 8601 format (e.g. `2023-09-06T00:00:00Z`). Step Size is the interval between timesteps in minutes (used for composite and playback sweeps). These fields are connected to the MMGIS timeline (expandable via the clock icon in the bottom left of the screen).

#### Sightline Item Header

Each sightline item's header contains:

- _Checkbox_: Toggle the sightline map layer visibility on/off.
- _Name_: Editable name for the sightline item.
- _Source dropdown_ (145px): Select the source entity (spacecraft, orbiter, or celestial body) to compute shading against.
- _Drag handle_: Reorder sightline items by dragging.
- _Close (X)_: Delete the sightline item.

#### Source

- _Observer_
  - Which observing spacecraft/orbiter to use. This is used for formatting and converting time parameters via the chronice API. The true observer position is always the visible map's center longitude and latitude value (represented by a green circle) and always facing north with zero tilt.
- _Start Time / End Time_ (observer local)
  - When an observer is selected, local time inputs appear showing the observer's local time (converted from UTC). Editing these and blurring converts back to UTC and updates the global sweep times.
- _Height_
  - Height in meters above the surface to use when calculating line-of-sight shading. This value applies to all points on the visible terrain. Gradually increasing this value shows the sightline map n-meters above the surface.
- _Elevation Map_
  - Specifies the terrain dataset to use.
- _Custom Az/El/Range_
  - Override the SPICE-computed azimuth, elevation, and range with manual values.

#### Display

- _Color_
  - The color to highlight the visible regions on the map.
- _Opacity_
  - The opaqueness of the sightline map layer (0 = transparent, 1 = opaque).
- _Resolution_
  - Controls terrain data resolution. Each higher option is 4x the resolution of the previous one. Options: Low, Medium, High, Ultra. Higher resolutions disable auto-regeneration — the Generate button must be pressed manually.

#### Run

The **Run** section contains the mode selector and generate controls. Clicking the "Run" header expands/collapses the results below, but the mode tabs and generate/sweep button are always visible.

- _Mode Tabs_ (Static / Composite / Playback)
  - Selects how visibility is computed and displayed for this sightline item. Switching modes clears the existing rendered layer from the map.

- _Generate / Sweep button_
  - **Static mode**: "Generate" computes a single-timestep sightline map. Auto-generates when settings change (for Low/Medium resolution).
  - **Composite/Playback mode**: "Sweep" runs the time-range analysis across all timesteps defined by Start Time, End Time, and Step Size. Maximum 256 frames per sweep.

##### Static Mode Results

Shows compact azimuth and elevation indicators beneath the generate button:

- _Az indicator_: Top-down view showing the azimuthal direction toward the source entity. Labeled with the numeric value (e.g. "Az: 123.4°").
- _El indicator_: Side view showing the elevational angle toward the source. Labeled with the numeric value (e.g. "El: 45.6°").

##### Composite Mode Results

Shows a cumulative visibility heatmap — each pixel's color indicates how often it was visible across all timesteps.

- _Color Ramp Picker_: Select the color gradient used for the heatmap visualization.
- _Continuous / Discrete_: Controls whether the color ramp interpolates smoothly or snaps to distinct color bins.
- _Absolute / Fit to data_: When "Absolute", the color ramp spans 0%–100% visible. When "Fit to data", the ramp stretches to fit the actual min/max visibility values for better visual contrast.
- _Legend_: Shows the color gradient with labeled endpoints. Hovering over the sightline map on the Leaflet map shows an indicator on the legend at the hovered pixel's visibility value.
- _Draggable color stops_ (discrete mode): In discrete mode, small handles appear at bin boundaries on the legend. Drag them to adjust relative bin widths. A reset icon (↻) restores even spacing.

##### Playback Mode Results

Animates through individual timestep results frame by frame. Playback indicators only appear once the atlas has been built (either by sweeping directly in playback mode, or switching from composite after a sweep triggers on-demand atlas building).

- _Sky Dome_: Polar plot showing the source's path across the sky over the sweep period, with the current position highlighted.
- _Mini Az/El Indicators_: Positioned in the top corners of the sky dome container, showing the current frame's source direction.
- _Play / Pause / Step buttons_: Control animation. Step forward/back advances one frame at a time.
- _Timeline Slider_: Scrub to any frame in the sweep. Shows the current frame's timestamp.
- _Link/Unlink toggle_: Chain-link icon on the right side of the playback controls.
  - **Linked** (default, accent color): Playback is synchronized across all linked sightline maps — pressing play on any card advances all linked cards together.
  - **Unlinked** (dimmed): Independent timeline — scrubbing/stepping only affects this sightline map.

#### Export

Appears in the results section when there is data to export. Formatted as a row: `Export [format dropdown] [download icon]`.

- _Sightline Map (PNG)_: Exports the current sightline map as a PNG image. All tile canvases are composited into a single image.
- _Sweep Results (CSV)_: Exports time-range sweep results as a CSV file with columns: time, lat, lng, visibility_pct, azimuth, elevation, range. The lat/lng columns contain the observer (source point) coordinates. Only available after a sweep has been run.
- _Sightline Grid (TXT)_: Exports a 2D grid of visibility values as a plain text file. Includes a metadata header (source, observer, time, sweep range, grid dimensions, value legend). For composite/playback mode, values are fractional visibility (0.0–1.0). For static mode, values are integer codes (0=shadowed, 1=visible from sun, 2=visible from earth, 8=no DEM data, 9=out of bounds).

Export filenames encode context from the current settings (e.g. `sightline_SUN_MSL-HAZCAM_2024-01-01T000000Z_sweep.csv`).

### Algorithm

1. The following are taken and fed into SPICE:
   - The longitude, latitude, and elevation location at the center of the map (the observer)
   - The current date
   - The target/source-entity (which may be an orbiter, the Sun, etc.)
2. The following are returned
   - The azimuth, elevation, and range from that location to the target
     - Source location is assumed to be facing north with no tilt
   - The longitude, latitude on the map directly under the target and its elevation
3. All elevation values from the current screen extent and queried
4. The target's longitude, latitude, elevation are projected onto a plane tangential to the observer
5. The screen elevation values are placed in an xy grid and the, from the previous values, the target's respective x,y,elev is computed and run through a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_
