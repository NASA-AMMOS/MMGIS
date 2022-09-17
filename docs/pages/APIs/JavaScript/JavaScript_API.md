---
layout: page
title: JavaScript API
permalink: /apis/javascript
parent: APIs
---

# JavaScript API

A client side API for use when using MMGIS embedded as an iframe. The `src/essence/mmgisAPI/mmgisAPI.js` file exposes functions that can be called using the global `window.mmgisAPI` object.

#### _Contents_

- [Layer Control](#layer-control)
- [Time Control](#time-control)
- [Event Listeners](#event-listeners)
- [Map Feature Information](#map-feature-information)
- [Miscellaneous Features](#miscellaneous-features)

---

## Layer Control

### clearVectorLayer(layerName)

This function clears an existing vector layer with a specified name

#### Function parameters

- `layerName` - name of layer to clear

The following is an example of how to call the `clearVectorLayer` function:

```javascript
window.mmgisAPI.clearVectorLayer("Waypoints");
```

### updateVectorLayer(layerName, inputData)

This function updates an existing vector layer with a specified name and valid GeoJSON data

#### Function parameters

- `layerName` - name of layer to update
- `inputData` - valid GeoJSON data
- `keepN` - number of features to keep. A value less than or equal to 0 keeps all previous features

The following is an example of how to call the `updateVectorLayer` function:

```javascript
window.mmgisAPI.updateVectorLayer(
  "Waypoints",
  {
    type: "Feature",
    properties: {
      sol: 690,
      site: 39,
      pos: 726,
      SCLK_START: 458746227.91,
      SCLK_END: 458748923.8,
    },
    geometry: {
      type: "Point",
      coordinates: [137.38361, -4.658036, -4461.908691],
    },
  },
  5
);
```

### trimVectorLayerKeepBeforeTime(layerName, keepBeforeTime, timePropPath)

This function removes features on a specified layer after a specified time

#### Function parameters

- `layerName` - name of layer to update
- `keepBeforeTime` - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; will keep all features before this time
- `timePropPath` - name of time property to compare with the time specified by keepAfterTime

The following is an example of how to call the `trimVectorLayerKeepBeforeTime` function:

```javascript
window.mmgisAPI.trimVectorLayerKeepBeforeTime(
  "Waypoints",
  "2021-12-01T15:10:00.000Z",
  "time"
);
```

### trimVectorLayerKeepAfterTime(layerName, keepAfterTime, timePropPath)

This function removes features on a specified layer before a specified time

#### Function parameters

- `layerName` - name of layer to update
- `keepAfterTime` - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; will keep all features after this time
- `timePropPath` - name of time property to compare with the time specified by keepAfterTime

The following is an example of how to call the `trimVectorLayerKeepAfterTime` function:

```javascript
window.mmgisAPI.trimVectorLayerKeepAfterTime(
  "Waypoints",
  "2021-12-01T15:10:00.000Z",
  "time"
);
```

### keepFirstN(layerName, keepLastN)

This function removes features on a specified layer starting from the tail of of the features list to keep the specified number of existing features. This function is not aware of time and will only keep the previous N number of features based on the order the features were added to the layer.

#### Function parameters

- `layerName` - name of layer to update
- `keepFirstN` - number of features to keep from the beginning of the features list. A value less than or equal to 0 keeps all previous features

The following is an example of how to call the `keepFirstN` function:

```javascript
window.mmgisAPI.keepFirstN("Waypoints", 2);
```

### keepLastN(layerName, keepLastN)

This function removes features on a specified layer starting from the beginning of the features list to keep the specified number of existing features. This function is not aware of time and will only keep the previous N number of features based on the order the features were added to the layer.

#### Function parameters

- `layerName` - name of layer to update
- `keepLastN` - number of features to keep from the tail end of the features list. A value less than or equal to 0 keeps all previous features

The following is an example of how to call the `keepLastN` function:

```javascript
window.mmgisAPI.keepLastN("Waypoints", 2);
```

### trimLineString(layerName, time, timeProp, trimN, startOrEnd)

This function is used to trim a specified number of vertices on a specified layer containing GeoJson LineString features. This makes the following assumptions:

- If trimming from the beginning of the layer, the time in the `time` parameter must be after the start time of the first feature in the layer
- If trimming from the end of the layer, the time in the `time` parameter must be before the end time of the last feature in the layer

#### Function parameters

- `layerName` - name of layer to update
- `time` - absolute time in the format of YYYY-MM-DDThh:mm:ssZ; represents start time if trimming from the beginning, otherwise represents the end time
- `timeProp` - key representing the time property to be updated in the layer
- `trimN` - number of vertices to trim
- `startOrEnd` - direction to trim from; value can only be one of the following options: start, end

The following are examples of how to call the `trimLineString` function:

```javascript
window.mmgisAPI.trimLineString(
  "Traverse",
  "2021-12-01T15:03:00.000Z",
  "start_time",
  7,
  "start"
);
```

```javascript
window.mmgisAPI.trimLineString(
  "Traverse",
  "2021-12-01T15:13:00.000Z",
  "end_time",
  7,
  "end"
);
```

### appendLineString(layerName, inputData, timeProp)

This function appends input data with a GeoJson Feature that contains a LineString. The LineString vertices from the input data is appended as vertices to the last Feature in the layer. The input data should also contain a property with `timeProp` as the key, representing the new end time for the updated data.

#### Function parameters

- `layerName` - name of layer to update
- `inputData` - GeoJson data containing a single Feature containing a LineString
- `timeProp` - key representing the time property to be updated in the layer

The following is an example of how to call the `appendLineString` function:

```javascript
window.mmgisAPI.appendLineString(
  "Traverse",
  {
    type: "Feature",
    properties: {
      name: 2,
      Length_m: 0,
      COLOR: 0,
      route: 0,
      start_time: "2021-12-01T15:10:00.000Z",
      end_time: "2021-12-01T15:20:00.000Z",
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [145.862136, -73.208439],
        [135.063782, -71.898251],
        [130.828697, -75.540527],
        [122.767247, -72.658683],
        [120.133499, -75.018059],
      ],
    },
  },
  "end_time"
);
```

## Time Control

### toggleTimeUI(visibility)

This function toggles the visibility of ancillary Time Control User Interface. It is useful in situations where time functions are controlled by an external application.

#### Function parameters

- `visibility` - Time UI is visibile if true and hidden if false

The following is an example of how to call the `toggleTimeUI` function:

```javascript
window.mmgisAPI.toggleTimeUI(false);
```

### setTime(startTime, endTime, isRelative, timeOffset)

This function sets the global time properties for all of MMGIS. All time enabled layers that are configured to use the `Global` time type will be updated by this function.

Note that layers will not be refreshed on the map until `reloadTimeLayers()` (or `reloadLayer()` for individual layers) is called.

#### Function parameters

- `startTime` - Can be either `YYYY-MM-DDThh:mm:ssZ` if absolute, or `hh:mm:ss` or seconds if relative
- `endTime` - Can be either `YYYY-MM-DDThh:mm:ssZ` if absolute, or `hh:mm:ss` or seconds if relative
- `isRelative` - If true, startTime and endTime are relative to the current UTC time
- `timeOffset` - An offset to use for the current UTC time; can be either a string in `hh:mm:ss` format or an integer value in seconds

The following are examples of how to call the `setTime` function:

```javascript
window.mmgisAPI.setTime("2021-05-13T01:00:00Z", "2021-05-13T07:00:00Z", false);

window.mmgisAPI.setTime("02:00:00", "00:00:00", true, "01:00:00");

window.mmgisAPI.setTime(7200, 0, true, 3600);
```

### setLayerTime(layer, startTime, endTime)

This function sets the start and end time for a single layer. It can be used to override the global time for the layer. Note that `setTime` also updates the times for layers that use the `Global` time type.

For layers that use a single time, `endTime` is used (i.e., `{time}=={endTime}`)

Note that the layer will not be refreshed on the map until `reloadTimeLayers()` (or `reloadLayer()` for individual layers) is called.

#### Function parameters

- `layer` - The layer name string or a layer object
- `startTime` - The start time in `YYYY-MM-DDThh:mm:ssZ` format
- `endTime` - The end time in `YYYY-MM-DDThh:mm:ssZ` format

The following is an example of how to call the `setLayerTime` function:

```javascript
window.mmgisAPI.setLayerTime(
  "Earthquakes",
  "2021-05-01T00:00:00Z",
  "2021-05-13T23:59:59Z"
);
```

### getTime()

Returns the current time on the map with offset included in `YYYY-MM-DDThh:mm:ssZ` format.

The following is an example of how to call the `getTime` function:

```javascript
window.mmgisAPI.getTime();

("2021-05-14T02:06:29Z");
```

### getStartTime()

Returns the global start time on the map with offset included in `YYYY-MM-DDThh:mm:ssZ` format.

The following is an example of how to call the `getStartTime` function:

```javascript
window.mmgisAPI.getStartTime();

("2021-05-14T01:06:29Z");
```

### getEndTime()

Returns the global end time on the map with offset included in `YYYY-MM-DDThh:mm:ssZ` format.

The following is an example of how to call the `getEndTime` function:

```javascript
window.mmgisAPI.getEndTime();

("2021-05-14T03:06:29Z");
```

### getLayerStartTime(layer)

Returns the start time set for an individual in `YYYY-MM-DDThh:mm:ssZ` format.

#### Function parameters

- `layer` - The layer name string or a layer object

The following is an example of how to call the `getLayerStartTime` function:

```javascript
window.mmgisAPI.getStartTime("Earthquakes");

("2021-05-01T00:00:00Z");
```

### getLayerEndTime(layer)

Returns the end time set for an individual in `YYYY-MM-DDThh:mm:ssZ` format.

#### Function parameters

- `layer` - The layer name string or a layer object

The following is an example of how to call the `getLayerEndTime` function:

```javascript
window.mmgisAPI.getEndTime("Earthquakes");

("2021-05-13T23:59:59Z");
```

### reloadTimeLayers()

This function will reload every layer that is time-enabled by re-fetching the data and re-drawing on the map. It should be called after `setTime` or `setLayerTime`. It will return a list of layers that were reloaded.

The following is an example of how to call the `reloadTimeLayers` function:

```javascript
window.mmgisAPI.reloadTimeLayers()[("Lunaserv", "Earthquakes")];
```

### reloadLayer(layer, evenIfOff)

This async function will reload the given time-enabled layer by re-fetching the data and re-drawing on the map. It should be called after `setTime` or `setLayerTime`.

#### Function parameters

- `layer` - The layer name string or a layer object
- `evenIfOff` - Reload this layer even if the user has it toggled off

The following is an example of how to call the `reloadLayer` function:

```javascript
window.mmgisAPI.reloadLayer("Earthquakes", true);
```

### setLayersTimeStatus(color)

This function will set the status icon color (e.g. to indicate staleness) for all global time enabled layers. It returns a list of the layers that were updated.

#### Function parameters

- `color` - The name of a color of hex RGB value

The following is an example of how to call the `reloadLayer` function:

```javascript
window.mmgisAPI.setLayersTimeStatus("#ff0000")[("Lunaserv", "Earthquakes")];

window.mmgisAPI.setLayersTimeStatus("green")[("Lunaserv", "Earthquakes")];
```

### setLayerTimeStatus(layer, color)

This function will set the status icon color (e.g. to indicate staleness) for the specified time enabled layers.

#### Function parameters

- `layer` - The layer name string or a layer object
- `color` - The name of a color of hex RGB value

The following is an example of how to call the `reloadLayer` function:

```javascript
window.mmgisAPI.setLayerTimeStatus("Earthquakes", "#ff0000");

window.mmgisAPI.setLayerTimeStatus("Earthquakes", "green");
```

### updateLayersTime()

This function will synchronize every global time enabled layer with the current global times. Similar to `setTime` but used internally to update values when users change values on the Time UI. Unlikely to be needed elsewhere except for potential edge cases where re-synchronization may be necessary.

The following is an example of how to call the `updateLayersTime` function:

```javascript
window.mmgisAPI.updateLayersTime();
```

## Event Listeners

### addEventListener(eventName, functionReference)

This function adds a map event or MMGIS action listener added using the MMGIS API. This function takes in one of the following events: `onPan`, `onZoom`, `onClick`, `toolChange`, `layerVisibilityChange`. The MMGIS action listener (`toolChange`, `layerVisibilityChange`) functions are called with an `event` parameter.

#### Function parameters

- `eventName` - name of event to add listener to. Available events: `onPan`, `onZoom`, `onClick`
- `functionReference` - function reference to listener event callback function. `null` value removes all functions for a given `eventName`

The following is an example of how to call the `addEventListener` function:

```javascript
function listener() {
  const featuresContained = window.mmgisAPI.featuresContained();
  console.log("featuresContained", featuresContained);

  const activeFeature = window.mmgisAPI.getActiveFeature();
  console.log("activeFeature", activeFeature);
}

window.mmgisAPI.addEventListener("onPan", listener);

function mmgisListener(event) {
  console.log("event", event);
}
window.mmgisAPI.addEventListener("toolChange", mmgisListener);
```

### removeEventListener(eventName, functionReference)

This function removes a map event or MMGIS action listener added using the MMGIS API.

#### Function parameters

- `eventName` - name of event to remove listener from. Available events: `onPan`, `onZoom`, `onClick`, `toolChange`, `layerVisibilityChange`
- `functionReference` - function reference to listener event callback function. `null` value removes all functions for a given `eventName`

The following is an example of how to call the `removeEventListener` function:

```javascript
function listener() {
  const featuresContained = window.mmgisAPI.featuresContained();
  console.log("featuresContained", featuresContained);

  const activeFeature = window.mmgisAPI.getActiveFeature();
  console.log("activeFeature", activeFeature);
}

window.mmgisAPI.removeEventListener("onPan", listener);
```

## Map Feature Information

### map

This is an object which exposes the Leaflet map object.

The following is an example of how to call the `map` object:

```javascript
window.mmgisAPI.map;
```

### featuresContained

This function returns an array of all features in the current map view. The return value is an object containing layer names as keys and values as arrays with all features (as GeoJson Feature objects) contained in the current map view

The following is an example of how to call the `featuresContained` function:

```javascript
window.mmgisAPI.featuresContained();
```

### getActiveFeature

This function returns the currently active feature (i.e. feature thats clicked and displayed in the InfoTool). The return value is the currently selected active feature as an object with the layer name as key and value as an array containing the GeoJson Feature object (MMGIS only allows the section of a single feature).

The following is an example of how to call the `getActiveFeature` function:

```javascript
window.mmgisAPI.getActiveFeature();
```

### getVisibleLayers

This function returns an object with the visiblity state of all layers

The following is an example of how to call the `getVisibleLayers` function:

```javascript
window.mmgisAPI.getVisibleLayers();
```

## Miscellaneous Features

### writeCoordinateURL

This function writes out the current view as a URL. This programmatically returns the long form of the 'Copy Link' feature and does not save a short URL to the database.

The following is an example of how to call the `writeCoordinateURL` function:

```javascript
window.mmgisAPI.writeCoordinateURL();
```

### onLoaded

This function calls the callback function once MMGIS has finished loading.

- `onLoadCallback` - callback function that is called when MMGIS has finished loading

The following is an example of how to call the `onLoaded` function:

```javascript
window.mmgisAPI.onLoaded(() => {
  // Add listener with MMGIS API now that MMGIS has finished loading
  function listener() {
    const featuresContained = window.mmgisAPI.featuresContained();
    console.log("featuresContained", featuresContained);

    const activeFeature = window.mmgisAPI.getActiveFeature();
    console.log("activeFeature", activeFeature);
  }

  window.mmgisAPI.addEventListener("onPan", listener);
});
```

### getActiveTool

This function returns an object with the currently active tool and the name of the active tool.

The following is an example of how to call the `getActiveTool` function:

```javascript
window.mmgisAPI.getActiveTool();
```

### project

This function convert a Longitude, Latitude object into X, Y (i.e. Easting, Northing) coordinates. It uses the map's base projection and the proj4 library to perform the transformation.

Custom map projections can be set in the Configuration page's Projection tab. Otherwise, the default proj4 string is `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a={radiusOfPlanetMajor} +b={F_.radiusOfPlanetMinor} +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`

The following is an example of how to call the `project` function:

```javascript
window.mmgisAPI.project({ lng: 137, lat: -4 });
// returns {x: 8120633.560692952, y: -237291.62355915268}
```

### unproject

This function is the inverse of the `project` function. It takes in a X, Y object and returns a Longitude, Latitude.

The following is an example of how to call the `unproject` function:

```javascript
window.mmgisAPI.unproject({ x: 8120633.560692952, y: -237291.62355915268 });
// returns {lat: -4.000000000000019, lng: 137}
```
