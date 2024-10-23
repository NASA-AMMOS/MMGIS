---
layout: page
title: Rasters
permalink: /data-processing/rasters
parent: Data Processing
has_children: false
nav_order: 4
---

# Data Processing - Rasters

Methods to get raster data into MMGIS

## TMS

See gdal2tiles and [Scripts](/scripts) for creating TMS tiles.

## COGs (Cloud Optimized GeoTiffs)

### Individual COGs

_The TiTiler service in MMGIS must be enabled._

In a Tile Layer in the Configure Page, simply put the COG's path in the `URL` field and check `Use TiTiler`.

### Mosaicked

_The TiTiler-PgStac and STAC services in MMGIS must be enabled._

A single tile layer can be the product of many individual COGs mosaicked together dynamically on-the-fly.

1. Create a STAC Collection in the Configure Page.
   1. Click 'STAC' in the bottom left of the Configure Page.
   2. Click 'New Collection' in the top-right.
   3. Fill out all the required fields and click 'Create STAC Collection'.
1. Add COG Items to the Collection.
   1. `MMGIS/auxiliary/stac` contains scripts for making COGs and for inserting them into MMGIS' STAC catalog.
      1. `python MMGIS/auxiliary/stac/tifs2cogs/tifs2cogs.py --help`
      1. `python MMGIS/auxiliary/stac/create-stac-items/create-stac-items.py --help`
         1. In order to create and insert stac items, you must use an MMGIS API Token. One can be made through the Configure Page.
         1. For example:
         ```
         python create-stac-items.py "http://localhost:8888" stac-c528a1badb86409f3c1e617aaaaaaaaa myCollection C:\Projects\MMGIS\Missions\Misc\sample_cogs
         ```
1. Set a Tile Layer URL to `stac-collection:{collection_name}`
