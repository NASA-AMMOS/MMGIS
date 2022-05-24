---
layout: page
title: Vector Styling
permalink: /configure/formats/vector-styling
parent: Formats
grand_parent: Configure
---

# Vector Styling

There are two main ways to style a GeoJSON Vector Layer:

1. Changing a Vector Layer's configuration style fields
1. Adding a style object into a feature's `"properties"` object inside a GeoJSON file.

The priorities of stylings are as follows (from highest to lowest):

1. Vector Layer configuration style fields with `prop:geojson_property_key` entered
   - `prop:geojson_property_key` will set the feature's color to the values of `features[i].properties.geojson_property_key`
2. Style Object per feature
   Example:

   ```javascript
   "properties": {
       "style": {
           "fillColor": "#b3b300",
           "fillOpacity": 1,
           "color": "black",
           "opacity": 1,
           "weight": 2,
           "radius": 10,
           "dashArray": "20",
           "lineCap": "square",
           "lineJoin": "miter",
           "noclick": true,
           "nointeraction": true,
           "minZoom": 10,
           "maxZoom": 17
       }
   }
   ```

   All are optional, including the `"style"` object entirely.

   - `fillColor`: The internal color of the feature.
   - `fillOpacity`: The opacity of the `fillColor`. Alternatively, `fillColor` could hold a color with alpha itself such as `rgba(255,0,0,0.5)` or `hsl(170, 80%, 50%, 0.1)`.
   - `color`: The color of the stroke/border of the feature. If the feature is a line, this is its main color.
   - `opacity`: The opacity of the stroke/border. If the feature is a line, this is its main opacity. Alternatively, `color` could hold a color with alpha itself such as `rgba(255,0,0,0.5)` or `hsl(170, 80%, 50%, 0.1)`.
   - `weight`: The thickness in pixels of the stroke/border.
   - `radius`: If the feature type is a point, the radius in pixels of that point.
   - `dashArray`: A dashed border. See [stroke-dasharray](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray).
   - `lineCap`: How to cap off the ends of lines. See [stroke-linecap](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap).
   - `lineJoin`: How to join line segments. See [stroke-linejoin](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin).
   - `noclick`: True sets the feature to be unclickable.
   - `nointeraction`: True sets the feature to have no interactions (no click, no hover, can click through).
   - `minZoom`: Minimum zoom to render this feature. Overrides the layer's overall `minZoom` (and legeacy `visibilityCutoff`).
   - `maxZoom`: Maximum zoom to render this feature. Overrides the layer's overall `maxZoom` (and legeacy `visibilityCutoff`).

3. Vector Layer configuration style fields (non-`prop:geojson_property_key`)
   - A named color
     - crimson, blue, rebeccapurple
   - A hex color
     - #FFF, #A58101
   - An rgb color
     - rgb(255,89,45)
   - An hsl color
     - hsl(130, 26%, 34%)
   - See [CSS colors](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value) for a complete list.
4. A default black or blue.
