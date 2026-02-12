---
layout: page
title: Layer URLs
permalink: /configure/formats/layer-urls
parent: Formats
grand_parent: Configure
---

# Layer URLs

Layers in the Configure CMS can take in a variety of URLs aside from standard absolute and relative ones. Visit the Layers Tab page for more information about constructing standard URLs.

## API

### `api:publishedall`

_For a vector layer._  
Grabs all features published via the DrawTool.

### `api:published:<file_intent>`

_For a vector layer._  
Grabs all features published via the DrawTool of a certain intent.
Possible values are: `roi, campaign, campsite, signpost, trail, all`

### `api:drawn:<file_id>`

_For a vector layer._
Grabs a user drawn file from the DrawTool.
The `file_id` is an integer and can be found by hovering over the desired file in the DrawTool. Note that if the file chosen is still private, the file owner will be the only user who can view it.

### `api:tacticaltargets`

_For a vector layer._  
If applicable, grabs all ingested tactical targets.

## GeoDatasets

### `geodatasets:<geodataset_name>`

_For a vector or vectortile layer._
Grab features uploaded to the CMS as a geodataset (a geojson dataset). _Case Sensitive_

## STAC Collections

### `stac-collection:<collection_name>`

_For a tile layer._
References a STAC collection from the local MMGIS instance's TiTiler PgSTAC service. The collection must exist in the local PgSTAC database.

**Example:**
```
stac-collection:mars_dem
```

All COG configuration options work with STAC collections:
- **COG Bands**: Specify which bands to display
- **COG Resampling**: Control resampling method (nearest, bilinear, cubic, etc.)
- **Band Math Expression**: Apply expressions across bands
- **Tile Matrix Set**: Specify projection (WebMercatorQuad, WorldCRS84Quad, etc.)
- **Time Support**: Use with TimeControl for temporal collections

### `stac-collection:https://<external-mmgis>/titilerpgstac/collections/<collection_name>`

_For a tile layer._
References a STAC collection from an **external** MMGIS instance. This allows you to link to collections hosted on other MMGIS deployments without duplicating data.

**Format Requirements:**
- Must include the full URL path ending with `/titilerpgstac/collections/{collection_name}`
- External server must have CORS enabled

**Example:**
```
stac-collection:https://mars.nasa.gov/mmgis/titilerpgstac/collections/global_elevation
```

**Example with port:**
```
stac-collection:https://example.com:8888/titilerpgstac/collections/my_collection
```

**Example with IDEAS Digital Twin:**
```
stac-collection:https://ideas-digitaltwin.jpl.nasa.gov/mmgis/titilerpgstac/collections/MASTERL2-LST
```

**CORS Requirements:**

The external MMGIS server must include these headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

**Features:**
- All COG configuration options work identically (bands, expressions, resampling)
- Time-enabled collections are supported
- Identifier tool queries work on external collections
- Animation tool can capture frames from external collections

**Security Note:** Only public STAC collections are supported. Authentication for external collections is not currently implemented.
