# Devin Knowledge Notes for MMGIS

Curated knowledge from past Devin sessions working on this repo. These capture lessons learned, conventions, and gotchas that aren't obvious from the codebase alone.

---

## CI/CD: Ignore Docker Image Build Failures

The `build-arm64` and `build-amd64` Docker image build failures are pre-existing and not your responsibility — focus only on the required CI checks:
- `test (local)`
- `test (off)`
- `secret-detection`
- `generate-tags`
- `bump-version`

---

## Child Sessions: No Separate PRs

When using child sessions for parallel work that will be consolidated into a single PR, instruct each child session to push to a named branch but **NOT** create a PR. The parent session should be the only one creating the consolidated PR. This avoids PR sprawl (e.g., 14 child PRs that need to be manually closed) and confusion for reviewers.

---

## Environment Variables: Triple-Update Rule

When updating or adding environment variables in MMGIS, you must update all three locations:
1. The `.env` file (or the actual configuration) — note that this file is gitignored
2. The `sample.env` file (template for new setups)
3. The `docs/pages/Setup/ENVs/ENVs.md` file (documentation of available environment variables)

---

## Error Handling: Use Logger for Fatal Startup Errors

Fatal startup errors (such as missing or invalid environment variables) should use the `logger` function with `infrastructure_error` as the error type, rather than throwing plain `Error` objects with `throw new Error(...)`.

```javascript
// BAD
throw new Error('SECRET env var is required');

// GOOD
logger('error', 'SECRET env var is required', 'server', null, 'infrastructure_error');
```

---

## Path Traversal Security

Relative URLs are commonly used in the Configure page (e.g., `Layers/shapes.geojson`). MMGIS automatically prepends `/Missions/{current_mission}/` to relative paths. Users legitimately use `../` to reference files in other missions (e.g., `../OtherMission/Layers/shapes.geojson`), so `../` can jump out of an individual mission directory but must **NEVER** escape the `/Missions` directory.

Key considerations:
- Path traversal validation should enforce that resolved paths stay within `/Missions`, not within a specific mission subdirectory
- There are nuances with timetilesets and pathing that may need special handling
- All path logic must work correctly when site admins serve MMGIS at a subpath (not just at root `/`)
- Key files: `scripts/middleware.js` (`onlyExistingFilepaths`, `isPathInsideRoot`), `API/Backend/Utils/routes/utils.js` (time-directory listing with `_time_` split paths)

---

## Database Initialization Architecture

Database initialization follows a specific sequence:

1. **`scripts/init-db.js`** is the baseline for auto-creating any database instance:
   - Connects to PostgreSQL via Sequelize
   - Creates the target database via `CREATE DATABASE`
   - Creates PostGIS and btree_gist extensions
   - Creates the `session` table
   - Creates spatial indexes on `user_features` tables

2. **`scripts/server.js`** runs `sequelize.sync()` (WITHOUT `alter: true`) after `init-db.js`. This creates application tables if they don't exist but does NOT add new columns to existing tables.

3. **Schema migrations** are handled by `up()` functions in individual model files (e.g., `API/Backend/Draw/models/userfiles.js`). These run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. They are called from each backend module's `setup.js` in the `onceSynced` callback — but some are async and NOT awaited, creating race conditions.

4. `npm start` runs `init-db.js && server.js` in sequence. Test infrastructure should follow this same pattern.

5. **Do NOT write custom SQL** to insert or modify data. Always use the application's own APIs and UI workflows.

6. **Two separate frontend builds**: The main application (`npm run build`) and the configure page. The configure page must be built separately (`cd configure && npm install && npm run build`) before it can be accessed at `/configure`.

---

## API Authentication Behavior

Some API endpoints always require authentication regardless of the `AUTH` environment variable:

- The CMS at `/api/configure/*` is restricted to Site Admins only (session permission `"111"` or `"110"`)
- The `ensureAdmin` middleware in `scripts/server.js` controls access
- Whitelisted read-only endpoints (accessible to all): `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`, `/api/geodatasets/search`
- When `AUTH=off`, there is no login mechanism — use session permission directly or long-term tokens
- When `AUTH=local`, admin accounts created via `/api/users/first_signup` (first user gets admin `"111"`)
- Tests interacting with admin-protected endpoints must handle auth even in `AUTH=off` mode

---

## Auto-Generated MMGIS Index

**Purpose**: Web-based geospatial visualization and collaborative mapping platform for planetary mission science operations.

**Key Technologies**: Node.js, Express, React, PostgreSQL/PostGIS, Leaflet, CesiumJS, LithoSphere, Sequelize, GDAL, Proj4, TiTiler.

**Key Concepts**:
- **Mission**: Top-level container for specific planetary project configurations
- **L_ (Layers_)**: Global state controller managing layer lifecycles and visibility
- **Map_ / Globe_**: Abstraction layers for 2D (Leaflet) and 3D (Litho/Cesium) views
- **DrawTool**: Collaborative vector editing system with versioned history
- **Intent**: Semantic categories (e.g., ROI, Trail) enforcing feature styling
- **Dynamic Extent**: Viewport-based data loading for high-density datasets
- **COG/STAC**: Cloud-native raster formats supported via TiTiler integration
- **Litho**: Specialized 3D planetary rendering engine for terrain/vectors
- **Essence**: The primary mapping environment and frontend state manager
- **Geodatasets**: Internal PostgreSQL storage for uploaded vector data
- **Time-Enabled**: Layers filtered via `{starttime}` and `{endtime}` parameters
- **Identifier**: Tool for sampling raw pixel values from remote rasters
- **Legend Tool**: Dynamic symbology generator based on layer metadata
- **Coordinate States**: Multiple spatial frames (ll, en, site, relative xy)
- **Adjacent Servers**: Proxy architecture for Python-based geospatial microservices
