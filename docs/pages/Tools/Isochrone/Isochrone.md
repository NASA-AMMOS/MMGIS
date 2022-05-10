---
layout: page
title: Isochrone
permalink: /tools/isochrone
parent: Tools
---

# Isochrone

The Isochrone tool shades regions of the map based on traverse time (or other "costs") from user-defined source points. Analysis is done by one of several selectable models and based on user-defined constraints. Hover over the generated shape to view the least-cost path to any given point from the start point. Users may view multiple isochrones simultaneously, and change the size, resolution, color ramp, color steps, and opacity of each one.

## Tool Configuration

### Example

```javascript
{
    "data": {
        "DEM": [
            {
                "name": "Unique Name 1",
                "tileurl": "Layers/Example/{z}/{x}/{y}.png",
                "minZoom": 8,
                "maxNativeZoom": 18,
                "resolution": 256,
                "interpolateSeams": true
            },
            { "...": "..." }
        ],
        "slope": [
            { "...": "..." }
        ],
        "cost": [
            { "...": "..." }
        ]
    },
    "interpolateSeams": false,
    "models": ["Traverse Time", "Isodistance", "..."]
}
```

_**data**_ - Each key in the "data" field should be the name of a type of data to be used in analysis. Examples of data types may include "DEM", "slope", "obstacle", "cost", or "shade". Values are an array of data source objects.

Data source objects must include a unique _**name**_, a _**tileurl**_, _**minZoom**_ and _**maxNativeZoom**_, and a _**resolution**_ indicating a power of 2 tile size between 32 and 256. Sources may also include an optional _**interpolateSeams**_ property, indicating per-source whether to correct tile seams (see global `interpolateSeams` property, below). Tiles should be in the same format as a DEM tileset (see `/auxiliary/1bto4b`). Note that the tool has no means of verifying that the tileset it is pointed to contains the right kind of data, so configure carefully.

Each model may require one or more of these data types to operate. Users will be prompted to select one of the configured sources for each of these data types. If no valid sources are configured for a data type a model needs, the tool will display an error message.

_**interpolateSeams**_ - Because `1bto4b` generates tiles with matching edges, data loaded and passed to models may have "seams," or regularly-spaced pairs of identical rows and columns. Depending on the data type and model, these seams may or may not cause inaccurate results. The default behavior of the tool is therefore to attempt to correct these seams. Set this property to false to disable this behavior for all sources that do not explicitly set their own `interpolateSeams` property to `true`.

_**models**_ - An optional list of models to make available. If not configured, a default list will be used.

## Tool Use

With the isochrone tool active, click on the map to generate an isochrone starting from the clicked point. This isochrone will update dynamically as its properties are changed. Hover over the isochrone to view least-cost paths and total accumulated costs at any shaded point. Note that while many isochrones may be visible at once, only one "focused" isochrone will render least-cost paths. An isochrone may be brought into "focus" by clicking its marker on the map, its name in the toolbar, or by modifying any of its properties.

### General Properties

General display options available to all isochrones.

_**Max Radius**_ - The radius of data to fetch around the start point. Note that, depending on the max cost setting, isochrones may run into this boundary. If the edge of the isochrone appears jagged, this property should be increased.

_**Color**_ - Selects a color ramp for the isochrone.

_**Opacity**_ - Changes the opacity of the isochrone.

_**Steps**_ - Picks the number of color steps in the isochrone, to reveal contours inside the shape. Set to 0 for a continuous ramp.

_**Model**_ - Selects which model to use to generate the isochrone. See `/src/essence/Tools/Isochrone/models` to create custom models.

### Data Properties

Options related to how data is retrieved and displayed.

_**Resolution**_ - Changes the resolution of the isochrone. This number represents the zoom level at which the resulting layer will be rendered.

**Data Sources** - Options to set the source for every data set required by the selected model. If no valid source has been listed for one or more required data set, an error message will appear and the isochrone will not render.

### Model properties

Options specific to the selected model.

**Max Cost** - This section will always include a max cost option, in units relevant to the selected model. This represents the cost to reach the edges of the isochrone from the start point, and will thus determine the ultimate size of the shape.

This section may have additional options specified by the selected model.

## Technical

The Isochrone tool runs a version of Dijkstra's algorithm on tiled data to generate results. In this implementation, every pixel is a vertex which is implicitly connected by an edge to 16 of its neighbors: its 8 immediate neighbors, plus neigbors that can be reached by the "knight's move" - i.e. the move a knight makes on a chessboard. Analysis is performed entirely in-browser in JavaScript.
