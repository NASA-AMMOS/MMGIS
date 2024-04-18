---
layout: page
title: Draw Tool
permalink: /database/drawtool
parent: Database
nav_order: 3
---

# Draw Tool

![](/MMGIS/assets/images/database_schemas/drawtool.png)

## Tables

### user_files

The `user_files` table stores an entry for each file a user created via the Draw Tool and contains common file metadata such as owner, name, description, whether it was deleted or not, who can see it, etc. This table does not store the actual features that are within it. To reference those, the user_files' id passes through the `file_histories` table first.

#### Columns

- `file_owner`: Username who owns the file.
- `file_owner_group`: In special cases, a group of users can be the owner of a file. This is currently hardcoded only for Lead users.
- `file_name`: The name of the drawing file.
- `file_description`: The description of the file. File tags also get encoded into this description field based on the following:

  - `~^{str}`: denotes that this file is in a `{tag}` elevated(/prioritized) folder of the Draw Tool.
  - `~@{str}`: denotes that this file is in a `{tag}` folder of the Draw Tool.
  - `~#{str}`: denotes that this file has a tag of the name `{str}`.

  Ex. `This is the visible description. ~^elevFolder1 ~@normalFolder ~#tag1 ~#tag2`  
   _Note: Each pattern must begin with a space_

- `is_master`: Is this file one of the default Lead files.
- `intent`: States the purpose of the file. While being deprecated, Lead Maps still uses this to differentiate between ROIs, Campaigns, etc. This field is important when uses the review/publish functionality.
- `public`: Is the file visible to all users or just its owner.
- `hidden`: If true, behaves like a (recoverable) delete.
- `created_on`: Standard Postgres creation time field.
- `updated_on`: Standard Postgres update time field.
- `template`: A JSON defining rules that each feature's metadata must comply to. Templates can be set on files at creation or through an existing file's information modal.
- `publicity_type`: If the file is public, how public? Read-only, list out other users who can draw and edit in it, all users can draw and edit in it.
- `public_editors`: If the file is public and the publicity type is "list-editors", this is the list of usernames who can draw and edit in this file.

### file_histories

The `file_histories` table provides a complete representation of all Draw Tool files at any point in time. To do this, every time a feature is drawn or edited, a new entry appears in the `file_histories` table that state what action what performed, by whom, when and a list of all the `user_features` ids that now belong in the file. For instance, if the latest `file_histories` entry for `file_id=7` has `history=[1,25,63,85,86,87,88]`, then the rows with ids 1, 25, 63, 85, 86, 87, and 88 are in the `user_file` file with an id of 7. The "History" tab in the Drawl Tool allows users to traverse these history trees.

#### Columns

- `file_id`: The id of the `user_files` file this history entry belongs to.
- `history_id`: An incrementing id that work per file_id.
- `time`: A Unix timestamp of when the drawing action occurred.
- `action_index`: An id for what action was performed.
  - 0: add
  - 1: edit
  - 2: delete
  - 3: undo
  - 4: (unused)
  - 5: Clip (add over)
  - 6: Merge
  - 7: Clip (add under)
  - 8: Split
- `history`: An array of `user_features` ids that are contained in this file at this time.
- `author`: The user who performed this action.

### user_features

The `user_features` table stores every Draw Tool feature and with PostGIS encoded geometries.

#### Columns

- `file_id`: The id of the `user_files` file this feature belongs to.
- `level`: Stores the order in which the feature is to be drawn when rendering the file.
- `intent`: A per-feature intent that takes precedence over the `user_files` file's intent.
- `properties`: The GeoJSON feature's properties object.
- `geom`: PostGIS encoded feature geometry.

### published_stores

In the Draw Tool, Lead users can copy features from various layers into a Lead layer and then publish that layer. Publishing requires various checks to take place such as no duplicate names, no duplicate uuids, certain features must be fully contained within others, what are a polygon's children, etc. The `published_stores` table stores the intermediary spatial, relational and hierarchical metadata in performing this validation. This metadata speeds up a spatial search API that is not yet released publicly.

### publisheds

The `publisheds` table stores every feature from the last published file and does so with PostGIS encoded geometries.
