---
layout: page
title: Infrastructural
permalink: /database/infrastructural
parent: Database
nav_order: 2
---

# Infrastructural

![](/MMGIS/assets/images/database_schemas/infrastructural.png)

## Tables

### session

The `session` table enables the MMGIS Server to keep track of and authenticated user sessions. Storing session tokens in a table instead of in memory allows the MMGIS Backend to scale up machines without losing track of users.

### spatial_ref_sys

The `spatial_ref_sys` is used by the PostGIS extension to maintain a catalog of common spatial reference systems such as EPSG and ESRI codes

### users

The `users` table is used when the ENV `AUTH=local` and for the Site Admin's account. It stores usernames, emails and encrypted passwords.
