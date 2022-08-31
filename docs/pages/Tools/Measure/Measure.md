---
layout: page
title: Measure
permalink: /tools/measure
parent: Tools
---

# Measure

Measure distances, angles, and generates elevation profiles.

![](/MMGIS/assets/images/Measure_tool.jpg)

On the Configure page, under Tools, you can specify which digital elevation model (DEM) will be used to create profiles from:

```javascript
{
    "dem": "(str) path to Data/defaultDEM.tif",
    "layerDems": {
        "[layer_name]": "(str) path/to/layers/dem.tif"
    },
    "onlyShowDemIfLayerOn": true
}
```

|        Parameter         |   Type    | Required |  Default  |                                                                                       Description                                                                                       |
| :----------------------: | :-------: | :------: | :-------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|         **dem**          | _string_  |  false   |    N/A    |                                                                Path to a primary DEM. Required if `layerDems` is unset.                                                                 |
|      **layerDems**       | _object_  |  false   |    N/A    | Object of layer names and the paths to thier DEMs. Users may switch between DEMs to profile via a dropdown. The dropdown only renders if there is more than one DEM configured overall. |
| **onlyShowDemIfLayerOn** | _boolean_ |  false   |   true    | If true, hides the configured `layerDems` of off layers from the tool's DEM selection dropdown. If false, all `layerDems`, even with invalid layer names, always show in the dropdown.  |
|     **defaultMode**      | _string_  |  false   | 'segment' |                                            Which measurement mode to default to. Options are 'segment', 'continuous' and 'continuous_color'                                             |

DEMs should be georeferenced (i.e. have a projection defined).

A remote DEM may be specified using a GDAL XML description file. See [Remote Virtual Layer](/MMGIS/configure/formats/remote-virtual-layer) for more information.

## Tool Use

- To make a measurement, left-click on the Measure Tool (graph icon), then left-click on the Map to create an anchor point for the measurement. As you move the mouse, the distance and angle (positive clockwise angle from north (i.e. top of map)) will read out and the distance will "rubber band" as you move. If you left-click again, the tool will display an elevation cross-section/profile. Mousing over the profile will show the raw elevation value at the samples points as well as a small yellow ball displayed between the two points on the map that correspond to where you are on the profile. If you left-click on the map at a new location, a new profile will be created between that point and the previous one. The total distance and section distance will be shown.
- The tool default to 100 samples evenly spaced between between the two points You can increase/decrease that sampling amount within the tool.
- Click the 'Download' test in the Measure Tool to download the raw values used in the profile as a comma-separated-value (CSV) file. It will include the easting, northing, and elevation values pulled from the DEM.
