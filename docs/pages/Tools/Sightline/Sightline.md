---
layout: page
title: Sightline
permalink: /tools/sightline
parent: Tools
---

# Sightline

_Computes and visualizes line-of-sight visibility to orbiting or celestial targets over terrain._

## SPICE

Site administrators are responsible for keeping SPICE kernels up-to-date in `/spice/kernels/` and CHRONOS setup files relevant in `/spice/chronosSetups/`.

There are two SPICE python scripts that require these backend kernel setups:

- `chronice.py` (time conversion)
  - Converts between time systems.
  - Looks for `/spice/chronosSetups/chronos-{target}.setup` where `{target}` here is filled in as a lowercased SightlineTool variables `"observers"`s `"value"`.
- `ll2aerll.py` (geometry)
  - Turns a lnglat and target into a directional azimuth, elevation, range, and lntlat
  - Reads in all kernels from `/spice/kernels/`.
  - `/spice/getKernelUtils` has some wget scripts as examples for downloading new kernels (however these resources will quickly become outdated)

## Tool Configuration

### Example

```javascript
{
    "dem": "Data/missionDEM.tif",
    "dems": [
        {
            "name": "Mission DEM (20 m)",
            "path": "Data/DEMs/missionDEM_20m_COG.tif",
            "resolution": 20
        },
        {
            "name": "Regional DEM (200 m)",
            "path": "Data/DEMs/regionalDEM_200m_COG.tif"
        }
    ],
    "data": [
        {
            "name": "MSL_DEM",
            "demtileurl": "pathToDEMTiles/MSL_Gale_DEM_Mosaic_1m_v3/{z}/{x}/{y}.png",
            "minZoom": 8,
            "maxNativeZoom": 18
        }
    ],
    "sources": [
        {
            "name": "MRO",
            "value": "MRO"
        },
        {
            "name": "ODY",
            "value": "-53"
        },
        {
            "name": "TGO",
            "value": "TGO"
        },
        {
            "name": "MVN",
            "value": "MAVEN"
        },
        {
            "name": "The Sun",
            "value": "SUN"
        }
    ],
    "observers": [
        {
            "name": "MSL",
            "value": "MSL"
        }
    ],
    "defaultHeight": 0,
    "observerTimePlaceholder": null,
    "utcTimeFormat": null
}
```

_**dem**_ - _(legacy, single DEM)_ A path to a DEM.tif. This is used to get the current center elevation. This can/should be the same file used for the Measure Tool and the Coordinate's elevation. Kept for backward compatibility: it is used only when the `dems` list below is empty or absent, so existing single-DEM configs continue to work unchanged.

_**dems**_ - _(multiple DEMs)_ An array of selectable DEMs, mirroring the `MeasureTool`'s `layerDems` precedent. Each entry has a `name` (shown in the per-item DEM dropdown), a `path` (a Cloud Optimized GeoTIFF DEM relative to the mission directory), and an optional `resolution` (the DEM's native ground sample distance in meters-per-pixel, entered by the mission admin). When `resolution` is set it is shown as the DEM's native resolution and used to cap the effective working resolution so it never oversamples beyond the data; when omitted, no native resolution is shown and the effective resolution is uncapped. The DEM selector is always shown in each sightline item's Source section (even with a single DEM) and the chosen DEM is threaded through the sightmap and horizon-profile computations. When `dems` is empty/absent, the legacy single `dem` field is used.

_**data**_ - At minimum, the Sightline tool requires at least one "data" source. A data source describes a DEM tileset (see /auxiliary/gdal2customtiles or /auxiliary/1bto4b) and allows users to select it by name to generate sightline maps over.

_**source**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `ll2aerll.py` script. Ensure the right kernels for the configured source entities/targets exist in `/private/api/spice/kernels`.

_**observers**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `chronos.py` scripts. Ensure the right kernels for the configured observers exist in `/private/api/spice/kernels` and that there is a proper chronos setup file for each observer's value `private/api/spice/chronosSetups/chronos-{lowercased_observer_value}.setup`.

_**defaultHeight**_ - Sets a default for the 'Height' parameter (see below). The regular default is 0 meters.

_**observerTimePlaceholder**_ - Sets the placeholder information for when the observer time's input box is cleared. Useful for denoting the expected time format to be inputed. For example "SOL DDDD HH:MM:SS". Default null.

_**utcTimeFormat**_ - Sets the placeholder information for when the observer time's input box is cleared. Useful for denoting the expected time format to be inputed. Uses [d3 time syntax](https://d3js.org/d3-time-format#locale_format). Example for day-of-year: `"%Y-%j %H:%M:%S"`. Defaults to times like so: `2023 SEP 06 19:27:05`.

## Tool Use

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visibility map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Interface

- _Time_
  - The shared time section at the top shows **Start Time**, **End Time**, and **Step Size (min)**. Start and End are **directly editable** UTC inputs (ISO 8601, e.g. `2023-09-06T00:00:00Z`; a zoneless `YYYY-MM-DDThh:mm:ss` is accepted as UTC). Editing a value and blurring or pressing 'Enter' validates it and updates the SightlineTool sweep times and all of MMGIS' timeline (expandable via the clock icon in the bottom left) — reusing the same validation/conversion and global update logic as the per-item observer-local inputs. Invalid entries revert to the last valid value.

#### Source

- _Entity_
  - Indicates which spacecraft, orbiter or celestial body to "look towards" and to "shine light back" upon the visible terrain.
- _Include Sun + Earth_
  - If true, the relative Sun and Earth positions will also be computed and their directional arrows will be rendered in the bottom azimuth and elevation indicators. In the azimuth and elevation indicators, the Sun is represented by a medium-length yellow arrow and the Earth is represented by a short-length blue-green arrow. These do **not** cast shadows on the visible terrain — only the source entity casts shadows.

#### Observer

- _Entity_
  - Which observing spacecraft/orbiter to use. This is only used for formatting and converting the upcoming 'Time' parameter. The true observer position is always the visible map's center longitude and latitude value (represented by a green circle) and always facing north with zero tilt.
- _Time_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Height_
  - Height in meters above the surface to use when calculating line-of-sight shading. For instance, a point on the surface (0m) may not be visible to a 'Source Entity', say the Mars Reconnaissance Orbiter (MRO), but 2m above that point may be. This value does not _only_ apply to the center longitude and latitude but to all points on the visible terrain. Gradually increasing this value shows the sightline map n-meters above the surface.

#### Visibility Region Options

- _Color_
  - The color to highlight the visible regions on the map.
- _Opacity_
  - The opaqueness of the visible regions on the map. A value of 0 is fully transparent and a value of 1 is fully opaque.
- _DEM_
  - A dropdown that selects which terrain dataset this sightline item uses (via `dems`). It is always shown, even with a single configured DEM. When the selected DEM's config sets a `resolution`, the tool displays that **native (dataset) resolution** in meters-per-pixel (`Native: … m/px`) directly beneath the dropdown.
- _Resolution_
  - A relative scale (1×, 0.5×, 0.25× default, 0.125×) applied to the viewport's longest pixel dimension to size the output grid (minimum 50px). Lower scales compute faster and coarser. Directly below the selector the tool displays the **effective working ground resolution** in meters-per-pixel (≈ viewport ground extent ÷ output grid dimension); this readout updates as you pan/zoom so the real detail of the current setting is always visible. When a DEM's native `resolution` is configured, the output grid — and therefore the effective resolution — is capped so it never goes finer than that native resolution (no oversampling beyond the data).
- _Shadow Reach_
  - Extends the terrain loaded for shadow computation beyond the visible map area (kilometers), read at a lower resolution so distant features can cast shadows into the viewport. Set to 0 to use only the viewport extent.

- _Generate / Sweep_
  - Submits a request to generate a sightline map with the provided parameters. In static mode it auto-generates when settings change.
  - **Cancelling a sweep**: In composite/playback mode the button reads **Sweep**; while a sweep is running the button keeps showing its progress and a small **×** floats over the right side of it. Clicking the × aborts the in-flight streaming request via an `AbortController`, and the backend per-frame loop stops cleanly when the connection closes.

#### Results

- _Azimuth_: The compass-angle in (0 -> 360) degrees clockwise from north of the direction of the 'Source Entity' as seen from the map's center longitude and latitude. 0 = North, 90 = East, 180 = South, 270 = West.
- _Elevation_: The angular height (-90 -> 90) between the horizon and the 'Source Entity'. -90 = Straight Down, 0 = Level with the Horizon, 90 = Straight Overhead.
- _Range_: The straight-line distance in kilometers between the map's center longitude, latitude and terrain elevation and the 'Source Entity'.
- _Longitude_: The map's center longitude value used in the computation.
- _Latitude_: The map's center latitude value used in the computation.
- _Altitude_: The distance in kilometers above the map's center position's tangential plane and the 'Source Entity'. In other words, in a 3D cartesian coordinate-system where the Z-axis goes through both the center of the visible map and the center of the planet, this 'Altitude' is the Z distance between that center and the 'Source Entity'.

#### Indicators

- _Azimuth_: A top-down birds-eye view of the surface with north up. The long yellow-orange arrow visualizes the azimuthal direction towards the 'Source Entity'. If 'Include Sun + Earth' is on, shorter Sun and Earth arrows will also appear in the indicator with the respective yellow and green-blue colors.
- _Elevation_: A horizontal and half-submerged side view of the surface. The long yellow-orange arrow visualizes the elevational direction towards the 'Source Entity'. If 'Include Sun + Earth' is on, shorter Sun and Earth arrows will also appear in the indicator with the respective yellow and green-blue colors. Note that elevation values only goes from -90 -> 90 but that the rendered elevation arrow can be drawn between 0 -> 360. This is because, while only half a circle is needed, the elevation arrow will choose whether to draw in the left or right half circle depending on which half-circle the azimuth value is in. Azimuth values from 0 -> 180 will result in an elevation arrow drawn in the right half-circle and azimuth values from 180 -> 360 will results in an elevation arrow drawn in the left half-circle. This is to aid in visualizing the 'Source Entity's 3D direction.

### Sightline Modes

Each sightline map item can be set to one of three modes:

- **Static**: Generates a single sightline map at the current time. The sightline map regenerates when parameters change.
- **Composite**: Sweeps through a time range and produces a cumulative heatmap showing how often each point on the ground has line-of-sight across all time steps.
- **Playback**: Sweeps through a time range and stores each frame. Users can play back the sweep as an animation, stepping through individual sightline frames with time controls.

Multiple sightline maps can be created simultaneously (e.g., Sun + Moon). Each element tracks its own sweep progress independently — starting a sweep on one element does not cancel another. A running sweep can be cancelled per-item via the small **×** that floats over the Sweep button (see _Generate / Sweep_ above).

### Charts (Horizon Profile + Visibility Timeline)

Clicking the **Charts** button on a sightline map item opens a combined bottom panel with two visualizations:

#### Horizon Profile

A 360° terrain horizon profile centered on the observer (map center). The chart shows:

- **Terrain silhouette** (brown fill) — computed by ray-casting from the observer across the DEM in all azimuth directions.
- **Source trajectory arcs** — the path of each source entity (Sun, Moon, etc.) across the sky during the sweep time range.
- **Current-frame marker** — a dot on the trajectory showing the source's current position.
- **0° elevation line** (dashed) — the geometric horizon.
- **Curvature correction** — when the tool's `curvature` option is enabled, the horizon profile accounts for planetary curvature by subtracting `d²/2R` from sampled terrain elevations (where `R` is the planet radius).
- **Near-field skip** — DEM samples within the configured minimum distance (default 1m) of the observer are ignored to reduce blockiness from close-in pixels.
- **Fog shading** — The terrain fill opacity varies by distance: nearby horizon terrain is rendered opaque; distant terrain fades out (log-scale mapping). This provides depth perception.
- **Hover tooltip** — Mousing over the horizon chart shows the azimuth, elevation angle, and distance to the horizon at that point.
- **Range slider** — A dual-handle log-scale slider in the panel header controls the min/max horizon lookup distance (default 1m–250km). Adjusting and releasing refetches the profile.

The chart is north-centered (0° N at center, ±180° at edges) and adapts to the current light/dark theme.

#### Visibility Timeline

A per-source horizontal bar showing when the source is visible vs. occluded over the sweep time range:

- **Colored segments** indicate the source is above the local terrain horizon (visible), using the element's configured color.
- **Gray/white segments** indicate the source is occluded.
- Visibility is computed by a **dedicated single-ray query** (`POST /api/sightline/visibility`), independent of the sweep grid. For each sample it casts one ray from the observer toward the source azimuth at the DEM's **native resolution** and compares the local horizon elevation against the source's elevation — so the result is zoom/viewport-independent, unlike the earlier grid-pixel derivation. (The Composite heatmap's percent-visible series still rides on the sweep grid.)
- **Visibility Sampling dropdown** — In the charts panel header, to the right of the Horizon Polygon checkbox, a `1x…256x` selector (default `32x`) controls the **temporal sampling rate** of the timeline. `1x` computes one visibility ray per sweep timestep; higher rates compute that many samples per timestep (interpolated timestamps between sweep frames) for a smoother, higher-fidelity visibility chart. Changing the rate refetches and redraws the timeline.
- A red slider indicator tracks the current playback frame position.
- Time labels along the bottom show UTC timestamps spanning the full time range (denser when a higher sampling rate is selected).

#### Azimuth Lines on Map

While the charts panel is open, colored dashed lines are drawn on the map for each sightline element, showing the current azimuth direction toward each source entity. These update in real-time during playback.

#### Time Controls

The combined panel includes shared time controls:

- **Play/Pause** — auto-advance through frames at the configured interval.
- **Fast-forward** — 4× playback speed.
- **Step forward/back** — advance or rewind one frame at a time.
- **Time slider** — scrub to any frame in the sweep.
- **Time display** — shows the current frame's UTC timestamp.

### Sky Dome

In playback mode, the results section includes a **Sky Dome** — a polar plot showing the full-sky trajectory of source entities. The dome maps azimuth (compass direction, clockwise from north) and elevation (0° at horizon, 90° at zenith) onto a circular projection:

- Cardinal directions (N, S, E, W) are labeled around the perimeter.
- Elevation rings at 30° and 60° are drawn as dashed circles.
- Each source's trajectory is plotted as a colored arc; above-horizon points are dots, below-horizon points are smaller/dimmer.
- The current-frame position is highlighted with a larger marker.

The sky dome background uses a fixed dark color for legibility in both light and dark themes.

### Algorithms

#### Sightmap (Viewshed)

**Endpoint:** `POST /api/sightline/sightmap`

The sightmap computes a 2D visibility grid showing which terrain cells have direct line-of-sight to a source entity.

**Core Algorithm:**

1. **Source position** — SPICE computes the azimuth, elevation, and range from the observer (map center lat/lng/height) to the target entity at the given time. For custom sources, user-supplied az/el is used directly.
2. **DEM composite** — A terrain raster is read from the configured DEM, padded by `shadowReach` in all directions beyond the viewport to capture shadows cast by off-screen terrain. The composite is read at a managed resolution (working dim proportional to viewport, capped at 4× max working dim) to prevent memory exhaustion.
3. **Tangent-plane projection** — The observer position and source vector are projected onto a local tangent plane. The source's effective position is expressed as (x, y, z) in a grid-aligned coordinate system.
4. **Ray-march viewshed** — From each grid cell, a ray is cast toward the source. The algorithm (a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_) checks if any intervening terrain along the ray exceeds the line-of-sight slope from that cell to the source. If so, the cell is shadowed; otherwise it is visible.
5. **Output** — A 2D integer grid where: `0` = shadowed, `1` = visible from target, `2` = also visible from secondary source (Earth), `8` = no DEM data, `9` = out of bounds.

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
| `planetRadius` | number | 0 | Planet radius in meters (for curvature correction) |
| `maxOutputDim` | number | 400 | Max grid dimension (capped at 4096) |
| `shadowReach` | number | 0 | Extra DEM padding in meters for off-screen shadow casting |
| `isCustom` | string | `'false'` | If `'true'`, use `customAz`/`customEl` instead of SPICE |
| `customAz`, `customEl` | number | 0 | Custom source azimuth/elevation (degrees) |
| `viewportBounds` | string | — | Optional viewport bounds for clipping |

**Performance:**

- **Managed resolution** — The composite DEM working dimension is capped (4× max working dim) so large shadow reach values don't cause OOM.
- **Curvature clamp** — Shadow reach is server-side clamped to `√(2 × planetRadius × 10km)` to prevent excessive padding.
- **Batch streaming** — In batch mode (multiple timestamps), the DEM and SPICE kernels are loaded once; each frame only recomputes the source vector and re-runs the march kernel. Progress is reported per-frame via stderr.
- **Frame limits** — Max frames scale inversely with resolution: 2048 frames at low res, 256 at ultra.

---

#### Horizon Profile

**Endpoint:** `POST /api/sightline/horizonprofile`

The horizon profile computes the terrain skyline as seen from the observer in all azimuth directions.

**Core Algorithm:**

For each azimuth (default 360 directions at 1° intervals):

1. **Ray initialization** — A ray is cast outward from the observer pixel in the DEM, in the direction given by the current azimuth angle. The step direction accounts for non-square pixels.
2. **Sample terrain** — At each step along the ray, the terrain elevation is bilinearly interpolated from the DEM grid.
3. **Curvature correction** — If a planet radius is provided, the sampled elevation is reduced by `d² / (2R)` to account for the surface curving away from the observer (where `d` is horizontal distance, `R` is planet radius).
4. **Elevation angle** — The elevation angle from the observer to the sample point is computed: `el = atan2(terrain_elev - observer_elev, horizontal_distance)`.
5. **Track maximum** — The maximum elevation angle encountered along the entire ray is recorded as "the horizon" for that azimuth. The distance to this maximum-angle point is also recorded.
6. **Output** — An array of `[azimuth_deg, max_elevation_angle_deg, distance_meters]` for each azimuth direction.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | — | Path to DEM raster (under `/Missions/`) |
| `lat`, `lng` | number | — | Observer latitude/longitude |
| `observerHeight` | number | 0 | Observer height above terrain (meters) |
| `numAzimuths` | number | 360 | Number of azimuth directions (capped at 3600) |
| `maxRadius` | number | 5000 | Maximum ray march distance in meters (capped at 500km) |
| `minSkipRadius` | number | 0 | Skip terrain samples within this distance (meters) |
| `planetRadius` | number | 0 | Planet radius in meters (for curvature correction; 0 = flat) |

**Performance:**

- **Logarithmic stepping** — Instead of stepping 1 pixel per sample, the step size increases logarithmically with distance: `step = max(1, log₂(r + 1))` pixels. Near the observer (r < 2px) it steps 1px for fine detail; at r = 1000px it steps ~10px. This preserves accuracy for nearby terrain (which subtends large angles) while skipping redundant samples at distance (where per-pixel angle change is negligible). Reduces ~2500 samples/ray to ~600 for a 250km radius.
- **Early termination** — After each sample beyond 1km, the algorithm checks: "Could the tallest plausible terrain (10km relief, minus curvature drop) at this distance produce a steeper angle than the current maximum?" If not, the ray terminates immediately. For typical terrain where the horizon is found within a few km, rays terminate well before the max radius — often at 50–200 samples instead of 600+.
- **Combined speedup** — Together, logarithmic stepping + early termination yield a 4–8× reduction in samples per ray compared to naïve 1px stepping to max radius.

---

#### Visibility (dedicated timeline ray)

**Endpoint:** `POST /api/sightline/visibility`

Computes the Visibility Timeline's per-sample visibility as a **single ray** from the observer toward each source over a time range, at the DEM's **native resolution** (no viewport downsampling). This is separate from the sweep grid: the timeline no longer samples a grid pixel, so its result is independent of zoom and working resolution.

**Core Algorithm:**

For each timestep (start → end at `stepSeconds`):

1. **Source direction** — The source azimuth/elevation is computed from SPICE (or taken from the custom az/el for a custom target).
2. **Single horizon ray** — One ray is cast from the observer toward the source azimuth using the same logarithmic-stepping + early-termination march as the Horizon Profile, yielding the terrain horizon elevation angle along that bearing.
3. **Visibility test** — The source is `visible` when its elevation is above the local horizon angle along its azimuth (and above 0°); otherwise it is occluded.
4. **Output** — An array of `{time, az, el, horizonAngle, visible}` per sample.

**Temporal sampling:** The client sizes `stepSeconds` as `sweepStep / samplingRate`, where `samplingRate` is the `1x…32x` selector in the charts header. `1x` yields one sample per sweep timestep; higher rates interpolate that many samples per timestep. Fine sample index `k·rate` aligns with sweep frame `k`, so the playback slider still maps to sweep frames.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dem` | string | — | Path/URL to DEM raster (under `/Missions/`) |
| `lat`, `lng` | number | — | Observer latitude/longitude |
| `height` | number | 0 | Observer height above terrain (meters) |
| `target` | string | — | Source entity (SPICE body) or `CUSTOM` |
| `startTime`, `endTime` | ISO 8601 | — | Time range |
| `stepSeconds` | number | — | Sample interval in seconds (= sweep step ÷ sampling rate) |
| `maxRadius` | number | — | Maximum ray march distance in meters |
| `minSkipRadius` | number | 0 | Skip terrain samples within this distance (meters) |
| `planetRadius` | number | 0 | Planet radius in meters (for curvature; 0 = flat) |
| `isCustom`, `customAz`, `customEl` | — | — | Custom fixed-direction source parameters |

**Performance:** One ray per sample (vs. a full sightmap grid per frame in the old approach) with the horizon march's logarithmic stepping + early termination; the native-resolution window read is hard-capped to bound memory. Frame count is capped (≤ 32768) and the request supports client cancellation.

