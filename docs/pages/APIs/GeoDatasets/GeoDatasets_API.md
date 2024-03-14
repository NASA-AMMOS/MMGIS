---
layout: page
title: GeoDatasets API
permalink: /apis/geodatasets
parent: APIs
---

# GeoDatasets API

Enables programmatic control over GeoDataset layers. GeoDatasets are GeoJSON files uploaded and managed by MMGIS and stored in MMGIS' Postgres/PostGIS database.

### Root path: `/api/geodatasets`

#### _Contents_

- [API Tokens](#api-tokens)
- [Endpoints](#endpoints)
  - [GET /get](#get-get)
  - [GET /get/:layer](#get-getlayer)
  - [POST /entries](#post-entries)
  - [POST /search](#post-search)
  - [POST /append/:name](#post-appendname)
  - [POST /append/:name/:start_end_prop](#post-appendnamestart_end_prop)
  - [POST /recreate](#post-recreate)
  - [POST /recreate/:name](#post-recreatename)
  - [POST /recreate/:name/:start_end_prop](#post-recreatenamestart_end_prop)
  - [DELETE /remove/:name](#delete-removename)

---

## API Tokens

To use the Configure API through HTTP requests, an API Token must be used for authentication.

1. Login to the configuration page `/configure`
2. Navigate to the "API Tokens" page
3. Set a name and expiration time if desired and click "Generate New Token"
4. Copy the newly generated token (you will not see it in full again)
5. When interacting with the Configure API, use the header `Authorization:Bearer <token>`

---

## Endpoints

### GET /get

Queries and geodataset and returns geojson or vectortiles.

|   Parameter   |   Type    | Required | Default |                        Description                         |
| :-----------: | :-------: | :------: | :-----: | :--------------------------------------------------------: |
|   **layer**   | _string_  |   true   |   N/A   |                   Geodataset layer name                    |
|   **type**    | _string_  |   true   |   N/A   | Format to return. 'geojson' or 'mvt' (Mapbox Vector Tiles) |
|   **minx**    | _number_  |  false   |   N/A   |   Minimum X (lng) value for a bounding-box extent query    |
|   **miny**    | _number_  |  false   |   N/A   |   Minimum Y (lat) value for a bounding-box extent query    |
|   **maxx**    | _number_  |  false   |   N/A   |   Maximum X (lng) value for a bounding-box extent query    |
|   **maxy**    | _number_  |  false   |   N/A   |   Maximum Y (lat) value for a bounding-box extent query    |
| **startProp** | _string_  |  false   |   N/A   |        Name of key of feature's start time property        |
| **starttime** |  _time_   |  false   |   N/A   |             Start time of time window to query             |
|  **endProp**  | _string_  |  false   |   N/A   |         Name of key of feature's end time property         |
|  **endtime**  |  _time_   |  false   |   N/A   |              End time of time window to query              |
|     **x**     | _integer_ |  false   |   N/A   |               If type=mvt, x of tile to get                |
|     **y**     | _integer_ |  false   |   N/A   |               If type=mvt, y of tile to get                |
|     **z**     | _integer_ |  false   |   N/A   |               If type=mvt, z of tile to get                |

#### Example

`curl -X GET -H "Authorization:Bearer <token>" http://localhost:8889/api/geodatasets/get?layer=my_geodataset&type=geojson&maxy=45.02695045318546&maxx=-77.23388671875&miny=29.70713934813417&minx=-123.77197265625001&starttime=2022-12-19T03%3A25%3A12.335Z&startProp=start_time&endtime=2024-03-13T21%3A26%3A22.090Z&endProp=end_time`

---

### GET /get/:layer

See [GET /get](#get-get). `layer` parameter can be passed in through URL instead.

#### Example

`curl -X GET -H "Authorization:Bearer <token>" http://localhost:8889/api/geodatasets/get/my_geodataset?type=geojson&maxy=45.02695045318546&maxx=-77.23388671875&miny=29.70713934813417&minx=-123.77197265625001&starttime=2022-12-19T03%3A25%3A12.335Z&startProp=start_time&endtime=2024-03-13T21%3A26%3A22.090Z&endProp=end_time`

---

### POST /entries

Lists out available geodatasets and their last updated dates

#### Example

`curl -X GET http://localhost:8889/api/geodatasets/entries`

```javascript
=> {
    "status": "success",
    "body": {
        "entries": [
            {
                "name": "terrain",
                "updated": "2022-05-23T17:49:09.097Z"
            },
            {
                "name": "footprints",
                "updated": "2023-12-07T17:08:05.552Z"
            }
        ]
    }
}
```

---

### POST /search

Returns all features that match a geojson `properties` property key's value.

| Parameter |   Type   | Required | Default |                    Description                    |
| :-------: | :------: | :------: | :-----: | :-----------------------------------------------: |
| **layer** | _string_ |   true   |   N/A   |               Geodataset layer name               |
|  **key**  | _string_ |   true   |   N/A   | Path and name to properties key/field to query on |
| **value** | _string_ |   true   |   N/A   |            Value of key to search for             |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"layer": "my_geodataset", "key": "flavor", "value": "peppermint"}' http://localhost:8889/api/geodatasets/search`

---

### POST /append/:name

Append geojson features to an existing geodataset.

| Parameter |   Type   | Required | Default |                 Description                 |
| :-------: | :------: | :------: | :-----: | :-----------------------------------------: |
| **:name** | _string_ |   true   |   N/A   | Geodataset layer name - included in the url |
| **body**  | _object_ |  false   |   N/A   |        Entire body is a geojson file        |

_Note:_ The geojson body can include the top-level foreign geojson members `startProp` and `endProp` to specific which feature properties fields to use as the start and end times.

```json
{
  "type": "FeatureCollection",
  "startProp": "start_time",
  "endProp": "end_time",
  "features": [
    {
      "geometry": {
        "type": "Polygon",
        "coordinates": ["..."],
        "properties": {
          "start_time": "2022-08-10T03:41:03Z",
          "end_time": "2022-08-10T03:41:15Z"
        }
      }
    },
    "..."
  ]
}
```

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" --data-binary "@my_geojson_to_append.json" http://localhost:8889/api/geodatasets/append/my_geodataset`

---

### POST /append/:name/:start_end_prop

See [POST /append/:name](#post-append-name). `startProp` and `endProp` parameters can be passed in through URL instead. `startProp` and `endProp` are comma-separated.

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" --data-binary "@my_geojson_to_append.json" http://localhost:8889/api/geodatasets/append/my_geodataset/start_time,end_time`

---

### POST /recreate

Creates or replaces an existing geodataset with a new geojson.

|   Parameter   |   Type   | Required | Default |                 Description                  |
| :-----------: | :------: | :------: | :-----: | :------------------------------------------: |
|   **name**    | _string_ |   true   |   N/A   |            Geodataset layer name             |
|  **geojson**  | _object_ |   true   |   N/A   |         The geojson object to create         |
| **startProp** | _object_ |  false   |   N/A   | Name of key of feature's start time property |
|  **endProp**  | _object_ |  false   |   N/A   |  Name of key of feature's end time property  |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"name":"my_geodataset", "geojson": {"type": "FeatureCollection", "features": []}}' http://localhost:8889/api/geodatasets/recreate`

---

### POST /recreate/:name

See [POST /recreate](#post-recreate). `name` is part of url and the POST body is the full geojson file. `startProp` and `endProp` are unsupported for this scheme unless specified in the top-level of the geojson.

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" --data-binary "@my_geodataset.json" http://localhost:8888/api/geodatasets/recreate/my_geodataset`

---

### POST /recreate/:name/:start_end_prop

See [POST /recreate](#post-recreate). `name` is part of url and the POST body is the full geojson file. `startProp` and `endProp` parameters can be passed in through URL instead. `startProp` and `endProp` are comma-separated.

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" --data-binary "@my_geodataset.json" http://localhost:8888/api/geodatasets/recreate/my_geodataset/start_time,end_time`

---

### DELETE /remove/:name

Removes a geodataset.

#### Example

`curl -X DELTE -H "Authorization:Bearer <token>" - http://localhost:8888/api/geodatasets/remove/my_geodataset`
