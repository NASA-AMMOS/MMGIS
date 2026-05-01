# Database Quick Reference

## Tables Overview

| Table | Category | Key Columns |
|-------|----------|-------------|
| `configs` | Configuration | mission, config (JSON), version |
| `long_term_tokens` | Configuration | token, expiration |
| `webhooks` | Configuration | JSON webhook definitions |
| `datasets` | Configuration | name, table (→ `d{n}_dataset`) |
| `geodatasets` | Configuration | name, table (→ `g{n}_geodataset`) |
| `user_files` | Draw Tool | file_owner, file_name, template, public |
| `file_histories` | Draw Tool | file_id, history (int[]), action_index |
| `user_features` | Draw Tool | file_id, properties (JSON), geom (PostGIS) |
| `published_stores` | Draw Tool | Publish validation metadata |
| `publisheds` | Draw Tool | Published features with geom |
| `session` | Infrastructure | Session tokens |
| `spatial_ref_sys` | Infrastructure | PostGIS SRS catalog |
| `users` | Infrastructure | username, email, password |
| `url_shorteners` | Ancillary | Short link → full link mapping |

## Key Relationships

```
user_files (id) ←── file_histories (file_id)
                         └── history[] ──→ user_features (id)
user_files (id) ←── user_features (file_id)

datasets (table) ──→ d{n}_dataset tables
geodatasets (table) ──→ g{n}_geodataset tables (with geom column)
```

## PostGIS Extensions

- `postgis` — Spatial data types and functions
- `btree_gist` — GiST index operator class for btree data types

## Initialization Order

1. `scripts/init-db.js` — Creates database, extensions, session table, spatial indexes
2. `scripts/server.js` → `sequelize.sync()` — Creates application tables
3. Model `up()` functions — Adds new columns to existing tables

## Dynamic Tables

- `d{int}_dataset` — Created per uploaded CSV dataset
- `g{int}_geodataset` — Created per uploaded GeoJSON geodataset, includes PostGIS `geom` column

## Connection Configuration

Via environment variables:
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
DB_POOL_MAX (default: 10)
DB_POOL_TIMEOUT (default: 30000ms)
DB_POOL_IDLE (default: 10000ms)
DB_SSL (default: false)
```
