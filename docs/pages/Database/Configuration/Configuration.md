---
layout: page
title: Configuration
permalink: /database/configuration
parent: Database
has_children: false
nav_order: 1
---

# Configuration

![](/MMGIS/assets/images/database_schemas/configuration.png)

## Tables

### configs

The `configs` table stores versioned configuration json objects per mission.

#### Columns

- `mission`: The mission name this configuration object belongs to.
- `config`: The full JSON configuration object. This is the exact object the MMGIS client uses to set up a mission's page.
- `version`: The version of the configuration object for the mission. Saving a configuration object adds a row to the table with the next version
- `createdAt`: Standard Postgres creation time field.

### long_term_tokens

The `long_term_tokens` table stores a list of tokens to be used as authentication for the Configuration API. The are manually created by a Site Admin through the /configure page and can be set to expire.

### webhooks

The `webhooks` table contains a json list of all active webhook configurations. When their trigger action is performed, they will execute their request.

### datasets

The `datasets` table is a list of names and references to other tables that store the actual dataset. The `table` field is the name of it's associated table and often follows the form "d{int}\_dataset". The d{int}\_dataset tables are merely a tabular representation of a CSV file. Datasets in MMGIS are useful in MMGIS when each vector layer's feature has tons of metadata as this provides a way to only grab that metadata when a user clicks on the feature instead of loading all the metadata up front.

### geodatasets

Similar to the `datasets` table, the `geodatasets` table is a list of names and references to other tables that store the actual geodataset. The `table` field is the name of it's associated table and often follows the form "g{int}\_geodataset". The g{int}\_geodataset tables are merely a tabular representation of a GeoJSON file. The `geom` column encodes each feature's geometry via PostGIS and in order to optimize spatial operations on the data.
