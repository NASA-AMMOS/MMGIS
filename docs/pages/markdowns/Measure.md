# Measure

Measure distances, angles, and generates elevation profiles.

![](images/Measure_tool.jpg)

On the Configure page, under Tools, you can specify which digital elevation model (DEM) will be used to create profiles from:

```javascript
{
    "dem": "Layers/ConamaraChaos_DEM_simpcyl_meters.tif"
}
```

At this time, only one DEM can be specified. This DEM should be georeferenced (i.e. have a projection defined).

## Tool Use

- To make a measurement, left-click on the Measure Tool (graph icon), then left-click on the Map to create an anchor point for the measurement. As you move the mouse, the distance and angle (positive clockwise angle from north (i.e. top of map)) will read out and the distance will "rubber band" as you move. If you left-click again, the tool will display an elevation cross-section/profile. Mousing over the profile will show the raw elevation value at the samples points as well as a small yellow ball displayed between the two points on the map that correspond to where you are on the profile. If you left-click on the map at a new location, a new profile will be created between that point and the previous one. The total distance and section distance will be shown.
- The tool default to 100 samples evenly spaced between between the two points You can increase/decrease that sampling amount within the tool.
- Click the 'Download' test in the Measure Tool to download the raw values used in the profile as a comma-separated-value (CSV) file. It will include the easting, northing, and elevation values pulled from the DEM.
