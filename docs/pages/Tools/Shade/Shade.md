---
layout: page
title: Shade
permalink: /tools/shade
parent: Tools
---

# Shade

_Shades the ground when line-of-sights to an orbiting target are occluded._

## SPICE

Site administrators are responsible for keeping SPICE kernels up-to-date in `/private/api/spice/kernels` and CHRONOS setup files relevant in `/private/api/spice/chronosSetups`.

There are two SPICE python scripts that require these backend kernel setups:

- `/private/api/spice/chronos.py`
  - Converts between time systems.
  - Looks for `/private/api/spice/chronosSetups/chronos-{target}.setup` where `{target}` here is filled in as a lowercased ShadeTool variables `"observers"`s `"value"`.
- `/private/api/spice/ll2aer11.py`
  - Turns a lnglat and target into a directional azimuth, elevation, range, and lntlat
  - Reads in all kernels `/private/api/spice/kernels`.
  - `/private/api/spice/getKernelUtils` has some wget scripts as examples for downloading new kernels (however these resources will quickly become outdated)

## Tool Configuration

### Example

```javascript
{
    "dem": "Data/missionDEM.tif",
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

_**dem**_ - A path to a DEM.tif. This is used to get the current center elevation. This can/should be the same file used for the Measure Tool and the Coordinate's elevation.

_**data**_ - At minimum, the Shade tool requires at least one "data" source. A data source describes a DEM tileset (see /auxiliary/gdal2customtiles or /auxiliary/1bto4b) and allows users to select it by name to generate shade maps over.

_**source**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `ll2aerll.py` script. Ensure the right kernels for the configured source entities/targets exist in `/private/api/spice/kernels`.

_**observers**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `chronos.py` scripts. Ensure the right kernels for the configured observers exist in `/private/api/spice/kernels` and that there is a proper chronos setup file for each observer's value `private/api/spice/chronosSetups/chronos-{lowercased_observer_value}.setup`.

_**defaultHeight**_ - Sets a default for the 'Height' parameter (see below). The regular default is 0 meters.

_**observerTimePlaceholder**_ - Sets the placeholder information for when the observer time's input box is cleared. Useful for denoting the expected time format to be inputed. For example "SOL DDDD HH:MM:SS". Default null.

_**utcTimeFormat**_ - Sets the placeholder information for when the observer time's input box is cleared. Useful for denoting the expected time format to be inputed. Uses [d3 time syntax](https://d3js.org/d3-time-format#locale_format). Example for day-of-year: `"%Y-%j %H:%M:%S"`. Defaults to times like so: `2023 SEP 06 19:27:05`.

## Tool Use

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visibility map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Interface

- _Time_
  - The desired datetime to query. Formatted as `YYYY MMM DD HH:MM:SS` and for example `2023 SEP 06 19:27:05` (or based on `utcTimeFormat`). Updating this time and pressing 'Enter' will set it as the current time for the ShadeTool and for all of MMGIS. It is both connected to the Observer's local time as well as MMGIS' timeline (expandable via the clock icon in the bottom left of the screen).

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
  - Height in meters above the surface to use when calculating line-of-sight shading. For instance, a point on the surface (0m) may not be visible to a 'Source Entity', say the Mars Reconnaissance Orbiter (MRO), but 2m above that point may be. This value does not _only_ apply to the center longitude and latitude but to all points on the visible terrain. Gradually increasing this value shows the shade map n-meters above the surface.

#### Shaded Region Options

- _Color_
  - The color to shade the shadowed regions on the map.
- _Opacity_
  - The opaqueness to shade the shadowed regions on the map. A value of 0 is fully transparent and a value of 1 is fully opaque.
- _Resolution_
  - MMGIS downloads terrain data needed for the shading algorithm. Increasing the resolution improves the quality of the shade map and the cost of download and render speed. Each higher option is 4x the resolution of the previous one (i.e. 'ultra' is 4x more terrain data than 'high' and 16x more data than 'medium'). To save on performance, if the resolution is 'high' or 'ultra', the Shade Tool will no longer regenerate the shaded map whenever any parameter changes and instead 'Generate/Regenerate' must manually be pressed.
- _Elevation Map_

  - Specifies the terrain dataset to use.

- _Generate/Regenerate_
  - Submits a request to generate a shade map with the provided parameters. Note that if the resolution is 'high' or 'ultra', the Shade Tool will not regenerate the shaded map whenever any parameter changes and instead 'Generate/Regenerate' must manually be pressed.

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

### Shade Modes

Each shade map item can be set to one of three modes:

- **Static**: Generates a single shade map at the current time. The shade map regenerates when parameters change.
- **Composite**: Sweeps through a time range and produces a cumulative heatmap showing how often each point on the ground is shaded across all time steps.
- **Playback**: Sweeps through a time range and stores each frame. Users can play back the sweep as an animation, stepping through individual shade frames with time controls.

Multiple shade maps can be created simultaneously (e.g., Sun + Moon). Each element tracks its own sweep progress independently — starting a sweep on one element does not cancel another.

### Charts (Horizon Profile + Occultation Timeline)

Clicking the **Charts** button on a shade map item opens a combined bottom panel with two visualizations:

#### Horizon Profile

A 360° terrain horizon profile centered on the observer (map center). The chart shows:

- **Terrain silhouette** (brown fill) — computed by ray-casting from the observer across the DEM in all azimuth directions.
- **Source trajectory arcs** — the path of each source entity (Sun, Moon, etc.) across the sky during the sweep time range.
- **Current-frame marker** — a dot on the trajectory showing the source's current position.
- **0° elevation line** (dashed) — the geometric horizon.
- **Curvature correction** — when the tool's `curvature` option is enabled, the horizon profile accounts for planetary curvature by subtracting `d²/2R` from sampled terrain elevations (where `R` is the planet radius).
- **Near-field skip** — DEM samples within 50m of the observer are ignored to reduce blockiness from close-in pixels.

The chart is north-centered (0° N at center, ±180° at edges) and adapts to the current light/dark theme.

#### Occultation Timeline

A per-source horizontal bar showing when the source is visible vs. occluded over the sweep time range:

- **Colored segments** indicate the source is occluded (terrain blocks line-of-sight), using the element's configured color.
- **Gray/white segments** indicate the source is visible.
- Visibility is computed using the same terrain horizon profile as the chart — the source is visible when its elevation exceeds the interpolated terrain elevation at that azimuth.
- Transitions between visible/occluded states use a gradient fade.
- A red slider indicator tracks the current playback frame position.
- Time labels along the bottom show UTC timestamps spanning the full time range.

#### Azimuth Lines on Map

While the charts panel is open, colored dashed lines are drawn on the map for each shade element, showing the current azimuth direction toward each source entity. These update in real-time during playback.

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
