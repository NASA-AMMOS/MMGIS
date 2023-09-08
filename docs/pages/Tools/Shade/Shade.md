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
  - `/private/api/spice/getKernelUtils` has some wget scripts as examples for downloadign new kernels (however these resources will quickly become outdated)

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
    "defaultHeight": 0
}
```

_**dem**_ - A path to a DEM.tif. This is used to get the current center elevation. This can/should be the same file used for the Measure Tool and the Coordinate's elevation.

_**data**_ - At minimum, the Shade tool requires at least one "data" source. A data source describes a DEM tileset (see /auxiliary/gdal2customtiles or /auxiliary/1bto4b) and allows users to select it by name to generate shade maps over.

_**source**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `ll2aerll.py` script. Ensure the right kernels for the configured source entities/targets exist in `/private/api/spice/kernels`.

_**observers**_ - An array of objects with the properties "name" and "value". "name" is the display name for the Source Entity dropdown. "value" is the SPICE spacecraft ID that gets passed to the backend `chronos.py` scripts. Ensure the right kernels for the configured observers exist in `/private/api/spice/kernels` and that there is a proper chronos setup file for each observer's value `private/api/spice/chronosSetups/chronos-{lowercased_observer_value}.setup`.

_**defaultHeight**_ - Sets a default for the 'Height' parameter (see below). The regular default is 0 meters.

## Tool Use

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visiblity map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Interface

- _Time_
  - The desired datetime to query. Formatted as `YYYY MMM DD HH:MM:SS` and for example `2023 SEP 06 19:27:05`. Updating this time and pressing 'Enter' will set it as the current time for the ShadeTool and for all of MMGIS. It is both connected to the Observer's local time as well as MMGIS' timeline (expandable via the clock icon in the bottom left of the screen).

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
  - Height in meters above the surface to use when calculating line-of-sight shading. For instance, a point on the surface (0m) may not be visible to a 'Source Entity', say the Mars Reconnaissance Orbiter (MRO), but 2m above that point may be. This value does not _only_ apply to the center longtitude and latitude but to all points on the visible terrain. Gradually increaing this value shows the shade map n-meters above the surface.

#### Shaded Region Options

- _Color_
  - The color to shade the shadowed regions on the map.
- _Opacity_
  - The opaqueness to shade the shadowed regions on the map. A value of 0 is fully transparent and a value of 1 is fully opaque.
- _Resolution_
  - MMGIS downloads terrain data needed for the shading alogrithm. Increasing the resolution improves the quality of the shade map and the cost of download and render speed. Each higher option is 4x the resolution of the previous one (i.e. 'ultra' is 4x more terrain data than 'high' and 16x more data than 'medium'). To save on performance, if the resolution is 'high' or 'ultra', the Shade Tool will no longer regenerate the shaded map whenever any parameter changes and instead 'Generate/Regenerate' must manually be pressed.
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
