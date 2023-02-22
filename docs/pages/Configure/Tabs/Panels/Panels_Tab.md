---
layout: page
title: Panels
permalink: /configure/tabs/panels
parent: Tabs
grand_parent: Configure
---

# Panels Tab

## Viewer

The Viewer sits to the left of the main Map. It can be expanded by clicking the double arrow in the middle left of the page. The Viewer can render images, DZIs, mosaics and models attached to layer features. A feature is configured to use the Viewer on click through an array under `properties` called `images`. Other tools may use the Viewer in their own way.

```javascript
"properties": {
    "name": "Example",
    "description": "An example showcases the images array.",
    "images": [
        {
            "name": "Regular Image Example",
            "url": "http://www.jpl.nasa.gov/assets/images/logo_nasa_trio_black@2x.png",
            "type": "image"
        },
        {
            "url": "http://mars.jpl.nasa.gov/msl-raw-images/msss/00582/mrdi/0582MD0002120000101703E01_DXXX.jpg",
            "type": "image"
        },
        {
            "url": "Layers/GPR/Data/GPR_radargram.jpg",
            "type": "radargram"
        },
        {
            "name": "Model Example",
            "url": "Data/models/example_model.obj",
            "texture": "Data/models/example_texture.jpg",
            "type": "image",
            "isModel": true
        },
        {
            "name": "DZI Example",
            "url": "Data/dzc_output.xml",
            "isDZI": true
        },
        {
            "name": "Panorama Example",
            "url": "Data/Mosaics/N_L000_1384_ILT055CYL_S_0940_UNCORM1.jpg",
            "isPanoramic": true,
            "rows": 1753,
            "columns": 6666,
            "azmin": 96.7294,
            "azmax": 48.5537,
            "elmin": -75.0502,
            "elmax": 6.95029,
            "elzero": 149.584,
            "originOffset": [-0.675,-0.5778,-1.946123]
        }
    ]
}
```

_Note: The first image in the images array is loaded on feature click._

### Regular Image

A standard image. Simply provide a url. If a name is not set, the file name is used instead.

### Radargram

Renders as a standard image. The Curtain Tool will find this type and use it.

### Model

A 3D model viewer. Supports .obj and .dae.

### DZI

A Deep Zoom Image is a format of tiled imagery used to render massive images. Point the url to the .xml within the DZI's directory. Ways to create DZIs can be found [here](https://openseadragon.github.io/examples/creating-zooming-images/).

### Panoramic

This deprojects a cylindrical mosaic by wrapping it to a 3D sphere (think Google StreetView). To do this, additional parameters are needed.

- `rows`: Y-axis pixel dimension.
- `columns`: X-axis pixel dimension.
- `azmin`: The azimuth in degrees of the left side of the image. Values are between 0 and 360 with 0 being north and 90 being east.
- `azmax`: The azimuth in degrees of the right side of the image. Values are between 0 and 360 with 0 being north and 90 being east.
- `elmin`: The elevation in degrees of the bottom of the image. Values are between -90 and 90 with -90 being straight down and 90 being straight up.
- `elmax`: The elevation in degrees of the top of the image. Values are between -90 and 90 with -90 being straight down and 90 being straight up.
- `elzero`: The number of pixels from the top of the image where the elevation is zero.
- `originOffset`: If not centered on the feature, the vector offset in meters from the feature's center. If not in [X, Y, Z] order, the coordinate order of this vector can be redefined in the `layerAttachments.pairings.originOffsetOrder` field in the layer's raw variables.

_Note: Extremely large mosaics may need to be scaled down ahead of time._

## Map

The main 2D Map. It cannot be disabled.

## Globe

The Globe sits to the right of the main Map. It can be expanded by clicking the double arrow in the middle right of the page. It renders a 3D view of the Map. Elevation data is brought into it by generating DEM tiles and setting the DEM URL in the layers' configurations. Digital Elevation Map tilesets can be generated with `auxillary/1bto4b/rasterstotiles1bto4b.py`
