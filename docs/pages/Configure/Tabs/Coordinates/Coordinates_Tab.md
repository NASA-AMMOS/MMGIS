---
layout: page
title: Look
permalink: /configure/tabs/coordinates
parent: Tabs
grand_parent: Configure
---

# Coordinates Tab

Configure the display coordinates MMGIS will use for the mission.

#### Longitude, Latitude

Check to display Longitude, Latitude coordinates to users. Toggle the right-most radio button to make this coordinate primary. The primary coordinate type becomes the default display and export coordinate type across MMGIS. This is the default primary coordinate type.

#### Easting, Northing

Check to display Easting, Northing coordinates to users. These coordinates are always in a mercator projection and can be manipulated with the input boxes below. Use Primary or Secondary Projection if you need Easting, Northing in another project. Toggle the right-most radio button to make this coordinate primary. The primary coordinate type becomes the default display and export coordinate type across MMGIS.

#### Primary Projection

Check to display Easting, Northing coordinates calculated via proj4 and the projection defined in the Projection Tab. If no projection is specified in the Projection Tab, this setting becomes ignored. Optionally set a Display Name to aid users in identifying the projection. Toggle the right-most radio button to make this coordinate primary. The primary coordinate type becomes the default display and export coordinate type across MMGIS.

#### Secondary Projection

See Primary Projection, however any proj4 string may be entered here to convert coordinates to and without modifying the Map's underlying projection. Toggle the right-most radio button to make this coordinate primary. The primary coordinate type becomes the default display and export coordinate type across MMGIS.

#### Relative X, Y, (Z)

Check to display X, Y, Z coordinates to users relative to point features they highlight. If no point feature is highlighted, X, Y, Z coordinates will be relative to the Map's origin.

#### Relative Y, X, (-Z)

Check to display Y, X, -Z coordinates to users relative to point features they highlight. If no point feature is highlighted, Y, X, -Z coordinates will be relative to the Map's origin.

#### With Elevation

Check to query for and append elevation values to the lower-right coordinates as users mouse around. DEM URL must be set.
