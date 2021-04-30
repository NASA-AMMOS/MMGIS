# API

The `src/essence/API/API.js` file exposes functions that can be called using the global `window.API` object.

### clearVectorLayer(layerName)

This function clears an existing vector layer with a specified name 

#### Function parameters
- `layerName` - name of layer to clear

The following is an example of how to call the `clearVectorLayer` function:

```javascript
window.API.clearVectorLayer('Waypoints')
```

### updateVectorLayer(layerName, inputData, keepN)

This function updates an existing vector layer with a specified name, valid GeoJSON data and keeps the last N number of features after adding the new data

#### Function parameters
- `layerName` - name of layer to update
- `inputData` - valid GeoJSON data
- `keepN` - number of features to keep. A value less than or equal to 0 keeps all previous features

The following is an example of how to call the `updateVectorLayer` function:

```javascript
window.API.updateVectorLayer('Waypoints', {
    "type": "Feature",
    "properties": {
    "sol": 690,
    "site": 39,
    "pos": 726,
    "SCLK_START": 458746227.91,
    "SCLK_END": 458748923.8,
    },
    "geometry": {
        "type": "Point",
            "coordinates": [
                137.38361,
                -4.658036,
                -4461.908691
            ]
    }
}, 5)

```
