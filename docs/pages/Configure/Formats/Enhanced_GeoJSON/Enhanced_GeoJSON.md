---
layout: page
title: Enhanced GeoJSON
permalink: /configure/formats/enhanced-geojson
parent: Formats
grand_parent: Configure
---

# Enhanced GeoJSON

MMGIS's GeoJSON supports per-coordinate properties. For example:

```json
{
  "type": "FeatureCollection",
  "coord_properties": ["longitude", "latitude", "elevation"],
  "features": [
    {
      "type": "Feature",
      "properties": {
        "coord_properties": [
          "longitude",
          "latitude",
          "elevation",
          "index",
          "event_seconds",
          "yaw",
          "uncertainty_x",
          "uncertainty_y",
          "uncertainty_z"
        ]
      },
      "geometry": {
        "type": "MultiLineString",
        "coordinates": [
          [
            [137.335, -4.689, -4500, 0, 1700920000, 11, null, 0.61, 0.0],
            [137.336, -4.688, -4500, 1, 1700920000, 171, 0.14, 0.61, null],
            [137.34, -4.685, -4500, 2, 1700920000, 51, 0.14, 0.61],
            [
              137.35, -4.687, -4500, 3, 1700920000, 51, 0.14, 0.61, 0.0, 3333333
            ],
            [137.354, -4.6943, -4497, 4, 1700940000, 158, 0.37, 0.33, 0.0],
            [137.357, -4.692, -4508, 5, 1700930000, 160, 0.41, 0.28, 0.0]
          ],
          [
            [137.36, -4.69, -4505, 6, 1700950000, 124, 0.34, 0.32, 0.0],
            [137.362, -4.685, -4504, 7, 1700960000, 108, 0.21, 0.62, 0.0]
          ],
          [
            [137.363, -4.683467, -4505, 8, 1700950000, 124, 0.34, 0.32, 0.0],
            [137.365, -4.68397846, -4504, 9, 1700960000, 108, 0.21, 0.62, 0.0],
            [137.3657, -4.68356, -4504, 10, 1700960000, 108, 0.21, 0.62, 0.0]
          ]
        ]
      }
    }
  ]
}
```

### coord_properties

- It names the members of every leaf coordinate array. ie. The 5th member in `coord_properties` names all the 5th member in the `geometry.coordinates` arrays.
- A foreign member when used file-wide or a reserved property when feature specific. If it occurs within `feature.properties` it will take precedence over any file-wide definition.
- `longitude`, `latitude`, `elevation` are still the required first three coordinates.
- See Vector Layer -> Raw Variables -> coordinateAttachments for uses.
