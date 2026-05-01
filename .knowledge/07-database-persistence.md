# Database Persistence

MMGIS uses PostgreSQL with the PostGIS extension for all persistent data storage.

## Database Initialization

`scripts/init-db.js` is the authoritative source for database initialization:

1. Connects to PostgreSQL via Sequelize
2. Creates the target database via `CREATE DATABASE`
3. Creates PostGIS and btree_gist extensions
4. Creates the `session` table
5. Creates spatial indexes on `user_features` tables

`scripts/server.js` then runs `sequelize.sync()` (without `alter: true`) to create application tables.

**Schema migrations** are handled by `up()` functions in individual model files (e.g., `API/Backend/Draw/models/userfiles.js`). These run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in the `onceSynced` callback.

`npm start` runs `init-db.js && server.js` in sequence.

## Table Groups

### Configuration Tables

- **`configs`**: Versioned JSON configuration objects per mission
- **`long_term_tokens`**: API authentication tokens created by Site Admins
- **`webhooks`**: JSON list of active webhook configurations
- **`datasets`**: References to tabular datasets (CSV-based, tables named `d{int}_dataset`)
- **`geodatasets`**: References to spatial datasets (GeoJSON-based, tables named `g{int}_geodataset`)

### Draw Tool Tables

- **`user_files`**: File metadata (owner, name, description, visibility, template, permissions)
- **`file_histories`**: Complete history of all Draw Tool file states with action tracking
- **`user_features`**: Every Draw Tool feature with PostGIS-encoded geometries
- **`published_stores`**: Intermediary spatial/relational metadata for publish validation
- **`publisheds`**: Published features with PostGIS geometries

### Infrastructural Tables

- **`session`**: User session tracking (enables horizontal scaling)
- **`spatial_ref_sys`**: PostGIS spatial reference system catalog
- **`users`**: User accounts (used when `AUTH=local` and for Site Admin)

### Ancillary Tables

- **`url_shorteners`**: Short link mappings for deep link sharing

## File History System

The Draw Tool uses a versioned history model:

1. `user_files` → file metadata
2. `file_histories` → snapshots of which features belong to a file at each point in time
3. `user_features` → individual features with geometry

Action indices: 0=add, 1=edit, 2=delete, 3=undo, 5=clip(over), 6=merge, 7=clip(under), 8=split

## Database Safety Rules

1. **NEVER** use `DROP DATABASE` in application code (only in `tests/test-db-clean.js` against test DBs)
2. **NEVER** use `DROP TABLE` or `TRUNCATE TABLE` without authorization checks
3. **NEVER** hardcode production credentials in test files
4. **ALWAYS** use dedicated test databases (`mmgis-test`, `mmgis-stac-test`)
5. **ALWAYS** use `DB_USER_TEST`/`DB_PASS_TEST` for test credentials
6. **NEVER** remove `NODE_ENV === 'production'` safety checks in test setup
