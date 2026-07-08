## Tool: Sightline

_Computes and visualizes line-of-sight visibility to orbiting or celestial targets over terrain._

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visibility map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Interface

Each sightline item is an independent sightline map with its own source, observer, display settings, and mode. Multiple sightline items can exist simultaneously, each identified by a colored left border.

- _Time_
  - The shared time section at the top of the tool. Shows **Start Time**, **End Time**, and **Step Size (min)**. Start and End times are **directly editable** UTC inputs in ISO 8601 format (e.g. `2023-09-06T00:00:00Z`); a bare `YYYY-MM-DDThh:mm:ss` (no zone) is accepted and treated as UTC. Editing a value and blurring (or pressing Enter) validates it and updates the global sweep times and the MMGIS timeline — the same validation and update logic used by the per-item observer-local inputs. Invalid entries revert to the last valid value. Step Size is the interval between timesteps in minutes (used for composite and playback sweeps). These fields are connected to the MMGIS timeline (expandable via the clock icon in the bottom left of the screen).

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
- _DEM_
  - When the mission config defines more than one DEM (see the **DEMs** config below), a dropdown appears to choose which terrain dataset this sightline item analyzes. The selected DEM is threaded through both the sightmap and horizon-profile computations. With a single configured DEM the dropdown is hidden and that DEM is used. Changing the DEM resets the Resolution to that DEM's native value.
- _Custom Az/El/Range_
  - Override the SPICE-computed azimuth, elevation, and range with manual values.

#### Display

- _Color_
  - The color to highlight the visible regions on the map.
- _Opacity_
  - The opaqueness of the sightline map layer (0 = transparent, 1 = opaque).
- _Resolution_
  - Controls the working ground resolution in **meters-per-pixel** based on the DEM's real dataset resolution (read from its GeoTransform). The default **Native** option uses the DEM's true pixel size; coarser options (2×, 4×, 8× the native meters-per-pixel) trade detail for speed. The output grid is sized from the viewport's ground extent divided by the selected meters-per-pixel (capped at 4096). Selecting finer than native is clamped to native. If the DEM's native resolution can't be determined, the tool falls back to the legacy relative scales (1×, 0.5×, 0.25×, 0.125×).

#### Run

The **Run** section contains the mode selector and generate controls. Clicking the "Run" header expands/collapses the results below, but the mode tabs and generate/sweep button are always visible.

- _Mode Tabs_ (Static / Composite / Playback)
  - Selects how visibility is computed and displayed for this sightline item. Switching modes clears the existing rendered layer from the map.

- _Generate / Sweep button_
  - **Static mode**: "Generate" computes a single-timestep sightline map. Auto-generates when settings change.
  - **Composite/Playback mode**: "Sweep" runs the time-range analysis across all timesteps defined by Start Time, End Time, and Step Size. Maximum 256 frames per sweep.
  - **Cancelling a sweep**: While a sweep is running the Sweep button keeps showing its progress, and a small **×** floats over the right side of it. Clicking the × aborts the in-flight request via an `AbortController`; the backend per-frame streaming loop detects the closed connection and stops cleanly.

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

### Algorithms

#### Sightmap (Viewshed)

**Endpoint:** `POST /api/sightline/sightmap`

The sightmap computes a 2D visibility grid showing which terrain cells have direct line-of-sight to a source entity.

**Core Algorithm:**

1. **Source position** — SPICE computes the azimuth, elevation, and range from the observer (map center lat/lng/height) to the target entity at the given time. For custom sources, user-supplied az/el is used directly.
2. **DEM composite** — A terrain raster is read from the configured DEM, padded by `shadowReach` in all directions beyond the viewport to capture shadows cast by off-screen terrain. Resolution is managed (working dim ≤ 4× max) to prevent memory exhaustion.
3. **Tangent-plane projection** — The observer position and source vector are projected onto a local tangent plane. The source's effective position is expressed as (x, y, z) in a grid-aligned coordinate system.
4. **Ray-march viewshed** — From each grid cell, a ray is cast toward the source. The algorithm (a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_) checks if any intervening terrain along the ray exceeds the line-of-sight slope from that cell to the source. If so, the cell is shadowed; otherwise it is visible.
5. **Output** — A 2D integer grid: `0` = shadowed, `1` = visible from target, `2` = also visible from secondary source (Earth), `8` = no DEM data, `9` = out of bounds.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dem` | string | — | Path to the selected DEM raster (under `/Missions/`); resolved from the per-item DEM selector |
| `lat`, `lng` | number | — | Observer latitude/longitude |
| `height` | number | 0 | Observer height above terrain (meters) |
| `target` | string | — | SPICE target name (e.g. `SUN`, `MRO`) |
| `time` | string | — | ISO 8601 UTC time (single mode) |
| `startTime`, `endTime`, `stepSeconds` | string/number | — | Batch sweep parameters |
| `obsRefFrame` | string | `IAU_MOON` | SPICE observer reference frame |
| `obsBody` | string | `MOON` | SPICE observer body name |
| `planetRadius` | number | 0 | Planet radius in meters (curvature correction) |
| `maxOutputDim` | number | 400 | Max grid dimension (capped at 4096) |
| `shadowReach` | number | 0 | Extra DEM padding in meters for off-screen shadow casting |
| `isCustom` | string | `'false'` | If `'true'`, use `customAz`/`customEl` instead of SPICE |
| `customAz`, `customEl` | number | 0 | Custom source azimuth/elevation (degrees) |

**Performance:**

- **Managed resolution** — Composite DEM working dimension capped at 4× max to prevent OOM on large shadow reach.
- **Curvature clamp** — Shadow reach is clamped to `√(2 × planetRadius × 10km)`.
- **Batch streaming** — DEM and SPICE kernels loaded once; each frame only recomputes the source vector. Progress reported per-frame.
- **Frame limits** — Scale inversely with resolution: 2048 frames at low res, 256 at ultra.

---

#### Horizon Profile

**Endpoint:** `POST /api/sightline/horizonprofile`

The horizon profile computes the terrain skyline as seen from the observer in all azimuth directions.

**Core Algorithm:**

For each azimuth (default 360 directions at 1° intervals):

1. **Ray initialization** — A ray is cast outward from the observer pixel in the DEM. The step direction accounts for non-square pixels.
2. **Sample terrain** — At each step, terrain elevation is bilinearly interpolated from the DEM grid.
3. **Curvature correction** — If a planet radius is provided, sampled elevation is reduced by `d² / (2R)` (where `d` = horizontal distance, `R` = planet radius).
4. **Elevation angle** — `el = atan2(terrain_elev - observer_elev, horizontal_distance)`.
5. **Track maximum** — The highest elevation angle encountered along the ray is recorded as "the horizon" for that azimuth. The distance to this point is also recorded.
6. **Output** — An array of `[azimuth_deg, max_elevation_angle_deg, distance_meters]` per azimuth.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | — | Path to DEM raster (under `/Missions/`) |
| `lat`, `lng` | number | — | Observer latitude/longitude |
| `observerHeight` | number | 0 | Observer height above terrain (meters) |
| `numAzimuths` | number | 360 | Number of azimuth directions (capped at 3600) |
| `maxRadius` | number | 5000 | Maximum ray march distance in meters (capped at 500km) |
| `minSkipRadius` | number | 0 | Skip terrain within this distance (meters) |
| `planetRadius` | number | 0 | Planet radius in meters (curvature correction; 0 = flat) |

**Performance:**

- **Logarithmic stepping** — Step size: `step = max(1, log₂(r + 1))` pixels. Near the observer steps 1px; at 1000px steps ~10px. Preserves accuracy close-in (where per-pixel angle change is large) while skipping redundant far samples. Reduces ~2500 samples/ray to ~600 at 250km.
- **Early termination** — After each sample beyond 1km, checks: "Could the tallest plausible terrain (10km relief, minus curvature drop) at this distance beat the current max angle?" If not, the ray stops. Most rays terminate at 50–200 samples.
- **Combined speedup** — 4–8× fewer samples per ray compared to naïve per-pixel stepping.

---

#### DEM Info

**Endpoint:** `POST /api/sightline/deminfo`

Reports a DEM's native (dataset) resolution so the Resolution selector can show real meters-per-pixel options. Opens the DEM, reads its GeoTransform, and returns the true ground sample distance. For projected datasets the pixel size is scaled by the SRS linear unit; for geographic datasets degrees are converted to meters at the dataset's mid-latitude (same `get_pixel_scale` logic used internally by the sightmap).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dem` | string | — | Path to DEM raster (under `/Missions/`) |

**Response:** `{ nativeResolution, pixelSizeX, pixelSizeY, cols, rows, isProjected }` where `nativeResolution` is meters-per-pixel. The client caches the result per DEM path.

### Configuration

- `dem` (string, legacy) — A single DEM path. Kept for backward compatibility and used only when the `dems` list is empty.
- `dems` (array) — A list of selectable DEMs, each with:
  - `name` — display name shown in the per-item DEM dropdown.
  - `path` — path to a Cloud Optimized GeoTIFF (COG) DEM relative to the mission directory.
  - `resolution` (optional) — the DEM's native ground sample distance in meters-per-pixel. When omitted it is read from the dataset's GeoTransform at runtime via the DEM Info endpoint.

  This mirrors the `MeasureTool`'s `layerDems` precedent. When `dems` is empty or absent, the legacy single `dem` field is used, so existing single-DEM configs continue to work unchanged.
