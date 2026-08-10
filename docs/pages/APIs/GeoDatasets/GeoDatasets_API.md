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
  - [POST /intersect](#post-intersect)
  - [GET /aggregations](#get-aggregations)
  - [GET /bulk_aggregations](#get-bulk_aggregations)
  - [GET /schema](#get-schema)
  - [POST /entries](#post-entries)
  - [POST /search](#post-search)
  - [POST /append/:name](#post-appendname)
  - [POST /append/:name/:start_end_prop](#post-appendnamestart_end_prop)
  - [POST /recreate](#post-recreate)
  - [POST /recreate/:name](#post-recreatename)
  - [POST /recreate/:name/:start_end_prop](#post-recreatenamestart_end_prop)
  - [POST /recompute_stats/:name](#post-recompute_statsname)
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
|  **format**   | _string_  |  false   | `YYYY-MM-DDTHH:MI:SSZ` | PostgreSQL date format used to parse starttime/endtime |
| **group_id**  | _string_  |  false   |   N/A   |     Return only features with this group_id value          |
|    **id**     | _integer_ |  false   |   N/A   |  Return only the single feature with this internal row id  |
|**spatialFilter**| _string_|  false   |   N/A   | Return features intersecting a circle: `lat,lng,radius` (radius in meters) |
| **noDuplicates**| _boolean_|  false   |  false  | Return only DISTINCT features. Uses the `group_id` field, if set, for distinctness, else the geometry |
|  **_source**  | _string_  |  false   |   N/A   | Comma-separated list of feature properties fields to return. Defaults to all. Dotted paths supported |
|   **stats**   | _string_  |  false   |   N/A   | Comma-separated list of numeric feature properties fields to also summarize per group. See [Statistics](#statistics) |
|  **filters**  | _string_  |  false   |   N/A   | Filter on feature properties: `key+op+type+value,...`. `op` is `>`, `<`, `=` or `in` (with `value` a `$`-separated list); `type` is `string` or `number` |
|   **limit**   | _integer_ |  false   |   N/A   | Maximum number of features to return (clamped to 1–10000) |
|  **offset**   | _integer_ |  false   |    0    | Number of features to skip, for use with `limit`           |
|  **limited**  | _boolean_ |  false   |  false  | If type=geojson, return only the first three features      |
|     **x**     | _integer_ |  false   |   N/A   |               If type=mvt, x of tile to get                |
|     **y**     | _integer_ |  false   |   N/A   |               If type=mvt, y of tile to get                |
|     **z**     | _integer_ |  false   |   N/A   |               If type=mvt, z of tile to get                |

#### Statistics

`stats` adds `min`, `max`, `avg`, `sum` and `stddev` (population) of the requested numeric fields to every returned feature, under `properties._.stats`:

```javascript
=> {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": { "...": "..." },
            "properties": {
                "elevation": 4.5,
                "_": {
                    "idx": 1234,
                    "stats": {
                        "elevation": { "min": 0.1, "max": 9.8, "avg": 4.2, "sum": 21, "stddev": 3.4 }
                    }
                }
            }
        }
    ]
}
```

- Statistics describe the feature's **group** — the same grouping `noDuplicates` uses (the geodataset's `group_id` field if it has one, else identical geometry). They are reported whether or not `noDuplicates` is used, so a single request can return one feature per group along with each group's summary.
- They cover the whole set matched by the query's extent, time, `filters` and `group_id` parameters, **before** `limit`/`offset` — paging does not narrow them.
- Non-numeric and missing values are ignored. A field that is nowhere numeric reports `null` for each statistic rather than failing.
- `stats` is ignored for `type=mvt`.
- For statistics over the whole geodataset rather than a group, see the `field_stats` returned by [GET /schema](#get-schema).

#### Example

`curl -X GET -H "Authorization:Bearer <token>" "http://localhost:8889/api/geodatasets/get?layer=my_geodataset&type=geojson&stats=elevation&noDuplicates=true"`

`curl -X GET -H "Authorization:Bearer <token>" http://localhost:8889/api/geodatasets/get?layer=my_geodataset&type=geojson&maxy=45.02695045318546&maxx=-77.23388671875&miny=29.70713934813417&minx=-123.77197265625001&starttime=2022-12-19T03%3A25%3A12.335Z&startProp=start_time&endtime=2024-03-13T21%3A26%3A22.090Z&endProp=end_time`

---

### GET /get/:layer

See [GET /get](#get-get). `layer` parameter can be passed in through URL instead.

#### Example

`curl -X GET -H "Authorization:Bearer <token>" http://localhost:8889/api/geodatasets/get/my_geodataset?type=geojson&maxy=45.02695045318546&maxx=-77.23388671875&miny=29.70713934813417&minx=-123.77197265625001&starttime=2022-12-19T03%3A25%3A12.335Z&startProp=start_time&endtime=2024-03-13T21%3A26%3A22.090Z&endProp=end_time`

---

### POST /intersect

Returns the features of a geodataset that spatially intersect a supplied GeoJSON geometry. Parameters are sent in the JSON body.

|   Parameter   |      Type       | Required | Default |                     Description                     |
| :-----------: | :-------------: | :------: | :-----: | :-------------------------------------------------: |
|   **layer**   |    _string_     |   true   |   N/A   |                Geodataset layer name                |
| **intersect** | _object/string_ |   true   |   N/A   | GeoJSON geometry (object or stringified) to intersect against |
|**noDuplicates**|  _boolean_     |  false   |  false  |    Return only DISTINCT features (by group_id/geom) |
| **starttime** |     _time_      |  false   |   N/A   |             Start time of time window to query      |
|  **endtime**  |     _time_      |  false   |   N/A   |              End time of time window to query       |
| **startProp** |    _string_     |  false   |`start_time`|        Name of feature's start time column       |
|  **endProp**  |    _string_     |  false   | `end_time` |         Name of feature's end time column        |
|  **format**   |    _string_     |  false   |`YYYY-MM-DDTHH:MI:SSZ`| PostgreSQL date format for time window |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"layer":"my_geodataset","intersect":{"type":"Polygon","coordinates":[[[-1,-1],[-1,1],[1,1],[1,-1],[-1,-1]]]}}' http://localhost:8889/api/geodatasets/intersect`

---

### GET /aggregations

Returns histograms/aggregations of feature `properties` values for a single geodataset (built from a random sample).

|   Parameter   |   Type   | Required | Default |                    Description                     |
| :-----------: | :------: | :------: | :-----: | :------------------------------------------------: |
|   **layer**   | _string_ |   true   |   N/A   |               Geodataset layer name                |
|   **limit**   | _integer_|  false   |   500   |    Random sample size used to build aggregations   |
| **minx/miny/maxx/maxy** | _number_ | false | N/A | Optional bounding-box extent                     |
| **starttime** |  _time_  |  false   |   N/A   |             Start time of time window              |
|  **endtime**  |  _time_  |  false   |   N/A   |              End time of time window               |
| **startProp** | _string_ |  false   |`start_time`|         Name of feature's start time column     |
|  **endProp**  | _string_ |  false   | `end_time` |          Name of feature's end time column      |
|  **format**   | _string_ |  false   |`YYYY-MM-DDTHH:MI:SSZ`| PostgreSQL date format for time window |

#### Example

`curl -X GET -H "Authorization:Bearer <token>" "http://localhost:8889/api/geodatasets/aggregations?layer=my_geodataset&limit=500"`

---

### GET /bulk_aggregations

Like [GET /aggregations](#get-aggregations) but aggregates across multiple layers in one call.

|   Parameter   |   Type   | Required | Default |                    Description                     |
| :-----------: | :------: | :------: | :-----: | :------------------------------------------------: |
|  **layers**   | _string_ |   true   |   N/A   | Comma-separated list of layer names (max 100)      |
|   **limit**   | _integer_|  false   |   500   | Sample size per layer (clamped to 1–1000)          |
| **starttime** |  _time_  |  false   |   N/A   |  Start time of time window (used with `endtime`)   |
|  **endtime**  |  _time_  |  false   |   N/A   |   End time of time window (used with `starttime`)  |
| **startProp** | _string_ |  false   |`start_time`| Start time column used for time filtering       |
|  **endProp**  | _string_ |  false   | `end_time` |  End time column used for time filtering         |

#### Example

`curl -X GET -H "Authorization:Bearer <token>" "http://localhost:8889/api/geodatasets/bulk_aggregations?layers=layer_a,layer_b&limit=500"`

---

### GET /schema

Returns field names, types, and source layers for one or more geodataset layers in bulk, plus each layer's dataset-wide statistics.

| Parameter |   Type   | Required | Default |                 Description                  |
| :-------: | :------: | :------: | :-----: | :------------------------------------------: |
|**layers** | _string_ |   true   |   N/A   | Comma-separated list of layer names (max 100)|

#### Example

`curl -X GET -H "Authorization:Bearer <token>" "http://localhost:8889/api/geodatasets/schema?layers=layer_a,layer_b"`

```javascript
=> {
    "status": "success",
    "schema": {
        "elevation": { "type": "number", "layers": ["layer_a"] }
    },
    "field_stats": {
        "layer_a": {
            "elevation": {
                "type": "number",
                "min": 0.1,
                "max": 9.8,
                "sum": 420,
                "sumsq": 2100,
                "count": 100,
                "nullCount": 4,
                "avg": 4.2,
                "stddev": 2.32
            }
        }
    }
}
```

`field_stats` covers **every** feature of every numeric field, unlike `schema`, which is inferred from a sample. It is computed when a geodataset is created or recreated, and widened by each append — `sum`, `sumsq` and `count` are stored (rather than only `avg` and `stddev`) so an append can update it exactly without re-reading the table.

`count` is how many features held a number for the field and `nullCount` how many did not, whether the property was absent, null or non-numeric. `avg`, the population `stddev` and `nullCount` are derived on read; only `min`, `max`, `sum`, `sumsq` and `count` are stored.

It is absent for geodatasets that have not been created or recreated since MMGIS added it. Appending to such a geodataset leaves it absent rather than reporting only the appended features; recreate the geodataset to compute it. (An append that *creates* the geodataset does compute it, since those features are all of them.) A field is only summarized where its value is a whole number, so text that merely starts with digits (`"2024-01-15"`, `"1.2.3"`) is not.

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
                "updated": "2022-05-23T17:49:09.097Z",
                "field_stats": {
                    "elevation": {
                        "type": "number",
                        "min": 0.1,
                        "max": 9.8,
                        "sum": 420,
                        "sumsq": 2100,
                        "count": 100,
                        "nullCount": 4,
                        "avg": 4.2,
                        "stddev": 2.32
                    }
                }
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

|    Parameter     |   Type   |  In   | Required | Default |                 Description                 |
| :--------------: | :------: | :---: | :------: | :-----: | :-----------------------------------------: |
|    **:name**     | _string_ |  url  |   true   |   N/A   | Geodataset layer name - included in the url |
|  **start_prop**  | _string_ | query |  false   |   N/A   | Property key to use as each feature's start time |
|   **end_prop**   | _string_ | query |  false   |   N/A   |  Property key to use as each feature's end time  |
| **group_id_prop**| _string_ | query |  false   |   N/A   | Property key to use as each feature's group id (comma-separate to merge, e.g. `track,frame`) |
|**feature_id_prop**| _string_| query |  false   |   N/A   | Property key to use as each feature's feature id (comma-separate to merge) |
|   **filename**   | _string_ | query |  false   |   N/A   |  Optional source filename recorded on the entry  |
|     **body**     | _object_ | body  |   true   |   N/A   |        Entire body is a geojson file        |

_Note:_ The geojson body can also include the top-level foreign geojson members `startProp`, `endProp`, `groupIdProp`, and `featureIdProp` to specify which feature properties fields to use. Body-level members take precedence over the equivalent query parameters.

> **Important:** Append does **not** automatically reuse the `start_time_field` / `end_time_field` / `group_id_field` / `feature_id_field` that were configured when the geodataset was created. If you do not supply the corresponding prop on the append request (via query param or body-level member), the appended features are stored with `NULL` `start_time`/`end_time`/`group_id`/`feature_id` and therefore will **not** match temporal or `group_id` queries. Pass the same field names on every append.

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

See [POST /append/:name](#post-appendname). `startProp` and `endProp` parameters can be passed in through the URL instead as a comma-separated `startProp,endProp` pair. To set group id / feature id on this route, include the body-level `groupIdProp`/`featureIdProp` geojson members.

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" --data-binary "@my_geojson_to_append.json" http://localhost:8889/api/geodatasets/append/my_geodataset/start_time,end_time`

---

### POST /recreate

Creates or replaces an existing geodataset with a new geojson.

|     Parameter     |   Type   | Required | Default |                 Description                  |
| :---------------: | :------: | :------: | :-----: | :------------------------------------------: |
|     **name**      | _string_ |   true   |   N/A   |            Geodataset layer name             |
|    **geojson**    | _object_ |   true   |   N/A   |         The geojson object to create         |
|   **startProp**   | _string_ |  false   |   N/A   | Name of key of feature's start time property |
|    **endProp**    | _string_ |  false   |   N/A   |  Name of key of feature's end time property  |
|  **groupIdProp**  | _string_ |  false   |   N/A   | Name of key of feature's group id property (comma-separate to merge) |
| **featureIdProp** | _string_ |  false   |   N/A   | Name of key of feature's feature id property (comma-separate to merge) |
|   **filename**    | _string_ |  false   |   N/A   |  Optional source filename recorded on the entry  |
|    **action**     | _string_ |  false   |`recreate`| `recreate` truncates & replaces; `append` adds to existing features |

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

### POST /recompute_stats/:name

Recomputes a geodataset's dataset-wide `field_stats` from the features already in it, in one pass over its table. Needed only for a geodataset written before those statistics were kept, since an append summarizes just the features it appends. See [GET /schema](#get-schema) for what is returned per field.

#### Example

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8888/api/geodatasets/recompute_stats/my_geodataset`

---

### DELETE /remove/:name

Removes a geodataset.

#### Example

`curl -X DELTE -H "Authorization:Bearer <token>" - http://localhost:8888/api/geodatasets/remove/my_geodataset`
