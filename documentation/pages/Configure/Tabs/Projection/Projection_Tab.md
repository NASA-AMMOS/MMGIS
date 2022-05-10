---
layout: page
title: Projection
permalink: /configure/tabs/projection
parent: Tabs
grand_parent: Configure
---

# Projection Tab

MMGIS supports tilesets in non-Web Mercator projections. The Projections Tab enables the configuration of a new projection for the given mission. All tilesets should be in agreement with the projection. Small issues with the settings here can have huge impacts on how the tilesets are rendered in MMGIS.

#### EPSG

A code representing a spatial reference system. [EPSGs](https://www.spatialreference.org/ref/epsg/)

#### Proj4 String

Please see [PROJ projections](https://proj.org/operations/projections/index.html).

#### Globe Projections

_Deprecated. Globe uses Proj4 String now._

#### Path to tilemapresource.xml

Set the path to the tilemapresource.xml that was created with the tileset and click "Populate from XML".
