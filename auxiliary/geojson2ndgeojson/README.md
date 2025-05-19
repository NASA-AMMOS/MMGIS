# geojson2ndgeojson

_GeoJSON to Newline Delimited GeoJSON_

## Purpose

In the case of needing to upload large geojson file, 500mb+, it is easier for stream uploading services to chunk such file where each feature is delimited by a new line.

### Turns:

_test.geojson_

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "A" },
      "geometry": {
        "type": "Point",
        "coordinates": [[137, -4]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "B" },
      "geometry": {
        "type": "Point",
        "coordinates": [[136, -4]]
      }
    }
  ]
}
```

### Into:

_test.ndgeojson_

```json
{"type":"Feature","properties":{"name":"A"},"geometry":{"type":"Point","coordinates":[[137,-4]]}}
{"type":"Feature","properties":{"name":"B"},"geometry":{"type":"Point","coordinates":[[136,-4]]}}
```

## Running

Install Dependencies:

```
npm install JSONStream
```

Run:

```
node geojson2ndgeojson.js test.geojson
```
