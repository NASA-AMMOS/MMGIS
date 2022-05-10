---
layout: page
title: Viewshed
permalink: /tools/viewshed
parent: Tools
---

# Viewshed

The Viewshed tool renders dynamic tilesets based on line-of-sight visibilities from user defined source points. Users can change viewshed colors, opacities, source heights, fields of views and visualize multiple viewsheds simultaneously.

![](/MMGIS/assets/images/Viewshed_tool.jpg)

## Tool Configuration

### Example

```javascript
{
    "data": [
        {
            "name": "Unique Name 1",
            "demtileurl": "Layers/Example/demtileset/{z}/{x}/{y}.png",
            "minZoom": 8,
            "maxNativeZoom": 18
        },
        { "...": "..." }
    ],
    "curvature": false,
    "cameraPresets": [
        {
            "name": "CAM A",
            "height": 2,
            "azCenter": 0,
            "azFOV": 70,
            "elCenter": -10,
            "elFOV": 30
        },
        { "...": "..." }
    ]
}
```

_**data**_ - At minimum, the Viewshed tool requires at least one "data" source. A data source describes a DEM tileset (see /auxiliary/1bto4b) and allows users to select it by name to generate viewsheds over.

_**curvature**_ - Optionally setting this to false disables the account of drop-off based on planetary curvature when calculating viewsheds. If unset or set to true, the configured Major Radius will be used during generations.

_**cameraPresets**_ - Are optional but, if set, require only "name" to be defined. Setting these allows users to quickly navigate to preset camera parameters. "height", "azCenter", "azFOV", "elCenter" and "elFOV" are all optional and are all of type number.

## Tool Use

### Options

Users can modify the following parameters per viewshed:

_**Data**_ - Changes the dataset to perform the viewshed on.

_**Color**_ - Changes the color of the viewshed.

_**Opacity**_ - Changes the opacity of the viewshed.

_**Resolution**_ - Because viewshedding requires a lot of data which can slow things down, four resolutions of data are provided. Ultra, the highest resolution, matches the resolution of the current raster tiles based on zoom. For example if the raster basemap is at 200 meters/pixel, an ultra viewshed would be generated with 200 meters/pixel (or highest available) digital elevation map (DEM) data. The resolution of the DEM impacts the accuracy of the generated viewshed. High is half the resolution of ultra, Medium, the default, is half the resolution of high, and low is half the resolution of medium. Due to performance issues both ultra and high resolutions require manual regeneration upon changes to viewshed parameters or regions.

_**Reverse**_ - Normally viewsheds color the visible regions. Reversing the viewshed colors everything except the visible regions.

_**Camera Preset**_ - Using values configured for the Viewshed Tool, sets other parameters to mock a camera.

_**Height**_ - The distance, in meters, that the viewshed source point sits above the surface.

_**FOV (Az)**_ - The azimuthal (horizontal) field of view.

_**FOV (El)**_ - The elevational (vertical) field of view.

_**Center Azimuth**_ - The azimuthal look-at angle. 0deg (North) -> 360deg (North) increasing clockwise. The generated viewshed will encompass the range such that half its FOV falls on either half of its angle.

_**Center Elevation**_ - The elevational look-at angle. -90deg(Down) -> 90deg (Up). The generated viewshed will encompass the range such that half its FOV falls on both top and bottom halves of its angle.

_**Latitude**_ - The latitude of the viewshed's source point.

_**Longitude**_ - The longitude of the viewshed's source point.

## Technical

- The accuracy of the Viewshed tool has been independently verified within ArcGIS.
- Viewsheds are generated entirely in-browser in JavaScript using tiled data.
  - The algorithm is derived from ["Generating Viewsheds without Using Sightlines. Wang, Jianjun, Robinson, Gary J., and White, Kevin. Photogrammetric Engineering and Remote Sensing. p81"](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) with implementation guidance from [gdal_viewshed](https://github.com/OSGeo/gdal/blob/master/gdal/alg/viewshed.cpp).
  - The algorithm is somewhat special to our DEM tile format in how it deal seam boundaries and stitches tiles together.
  - An additional data manager was written to query for all tiles necessary to render the viewshed for the current screen.
  - Azimuth and elevation fields-of-views and look-ats are new.
