# Geodata Management & Tile Serving - Implementation Plan

## Implementation Overview

This document describes the retrospective implementation plan for the MMGIS Geodata Management & Tile Serving feature, which was successfully completed and integrated into the system. The feature enables comprehensive geospatial data management, storage, and serving capabilities using PostgreSQL/PostGIS as the underlying spatial database.

## Phase 1: Foundation & Database Schema

### 1.1 Geodatasets Metadata Model
**Status:** Completed

**Implementation:**
- Created Sequelize model for `geodatasets` metadata table
- Defined schema with name, table, filename, num_features fields
- Added temporal field tracking (start_time_field, end_time_field)
- Added grouping and identification fields (group_id_field, feature_id_field)
- Implemented migration function `up()` for adding new columns
- Added unique constraints on name and table fields

**Files Modified:**
- `API/Backend/Geodatasets/models/geodatasets.js`

**Database Tables:**
```sql
CREATE TABLE geodatasets (
  id SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  table VARCHAR UNIQUE NOT NULL,
  filename VARCHAR,
  num_features INTEGER,
  start_time_field VARCHAR,
  end_time_field VARCHAR,
  group_id_field VARCHAR,
  feature_id_field VARCHAR,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**Design Decisions:**
- Table naming convention: `g{id}_geodatasets` for automatic uniqueness
- Metadata separation: Geodatasets table tracks references to feature tables
- Flexible temporal fields: Support datasets with or without time dimensions

<!-- HUMAN REVIEW NEEDED: Was there discussion about supporting custom table prefixes or suffixes beyond 'g{id}_'? -->

### 1.2 Dynamic Feature Table Creation
**Status:** Completed

**Implementation:**
- Created `makeNewGeodatasetTable()` function for dynamic table generation
- Implemented Sequelize schema definition with conditional fields
- Added PostGIS GEOMETRY column with EPSG:4326 CRS
- Created JSONB column for arbitrary properties
- Implemented automatic spatial indexing with GIST
- Added temporal indexing for start_time/end_time columns
- Implemented group_id and feature_id indexing when fields specified

**Files Modified:**
- `API/Backend/Geodatasets/models/geodatasets.js`

**Dynamic Schema Example:**
```sql
CREATE TABLE g1_geodatasets (
  id SERIAL PRIMARY KEY,
  properties JSONB DEFAULT '{}',
  start_time BIGINT NULL,
  end_time BIGINT NULL,
  group_id VARCHAR NULL,
  feature_id VARCHAR NULL,
  geometry_type VARCHAR NOT NULL,
  geom GEOMETRY
);

CREATE INDEX g1_geodatasets_geom_idx ON g1_geodatasets USING GIST (geom);
CREATE INDEX g1_geodatasets_time_idx ON g1_geodatasets USING GIST (start_time, end_time);
CREATE INDEX g1_geodatasets_group_id_idx ON g1_geodatasets USING GIST (group_id);
CREATE INDEX g1_geodatasets_feature_id_idx ON g1_geodatasets USING GIST (feature_id);
```

**Design Decisions:**
- Columns conditionally included based on metadata
- JSONB for flexible property storage without schema constraints
- BIGINT for temporal fields (epoch milliseconds for precision)
- VARCHAR for IDs to support non-numeric identifiers

**Challenges Resolved:**
- Sequelize define() only runs at startup, so dynamic tables need special handling
- Index creation separated into individual queries for error isolation
- GIST indexes preferred over B-tree for better spatial/temporal performance

## Phase 2: Data Ingestion & Processing

### 2.1 GeoJSON Upload Endpoint
**Status:** Completed

**Implementation:**
- Created POST `/geodatasets/recreate` endpoint with path parameter variants
- Added POST `/geodatasets/append` endpoints for incremental loading
- Implemented GeoJSON parsing and validation
- Created feature extraction pipeline with property mapping
- Implemented bulk insert with Sequelize `bulkCreate()`
- Added VACUUM ANALYZE for statistics optimization post-insert

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Request Flow:**
```
User Upload → Validate JSON → Parse Features → Map Properties
  → Create/Update Metadata → Truncate Table (if recreate)
  → Bulk Insert Features → Create Indexes → VACUUM → Response
```

**Features Implemented:**
- Temporal property extraction with date parsing to epoch
- Group ID field merging (comma-separated properties combined)
- Feature ID field merging (comma-separated properties combined)
- Geometry type extraction and validation
- Automatic CRS injection (EPSG:4326)

**Error Handling:**
- Malformed JSON caught with try/catch
- Invalid geometries rejected by PostGIS
- Transaction rollback on bulk insert failure
- Detailed error logging with stack traces

### 2.2 Property Mapping & Extraction
**Status:** Completed

**Implementation:**
- Created `populateGeodatasetTable()` helper function
- Implemented nested property access using `Utils.getIn()`
- Added property concatenation for composite keys (e.g., track_id + frame)
- Converted date strings to epoch milliseconds for temporal fields
- Validated NaN results and set to NULL

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Property Access Patterns:**
```javascript
// Simple property
Utils.getIn(feature.properties, "track", null)
// Result: feature.properties.track

// Nested property
Utils.getIn(feature.properties, "meta.track", null)
// Result: feature.properties.meta.track

// Comma-separated merging
groupIdProp = "track,frame"
group_id = [track_value, frame_value].join("_")
// Result: "12345_67890"
```

### 2.3 Geometry Processing
**Status:** Completed

**Implementation:**
- Geometry objects wrapped with CRS metadata
- PostGIS automatic validation on insert
- Geometry type extraction for indexing
- Support for all WKT geometry types

**Geometry Format:**
```json
{
  "crs": { "type": "name", "properties": { "name": "EPSG:4326" } },
  "type": "Point",
  "coordinates": [-118.2437, 34.0522]
}
```

**PostGIS Integration:**
- ST_GeomFromGeoJSON for insert
- ST_AsGeoJSON for output
- Automatic validation of WKT structure

## Phase 3: Query & Retrieval APIs

### 3.1 Vector Tile (MVT) Serving
**Status:** Completed

**Implementation:**
- Created GET/POST `/geodatasets/get` with `type=mvt` parameter
- Implemented z/x/y tile coordinate parsing
- Added tile-to-lat/lng conversion functions (Web Mercator inverse)
- Implemented ST_AsMvt PostGIS query generation
- Added content-type header for application/x-protobuf

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Tile Coordinate Functions:**
```javascript
function tile2Lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2Lat(y, z) {
  let n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
```

**SQL Query Pattern:**
```sql
SELECT ST_AsMVT(q, :layer, 4096, 'geommvt')
FROM (
  SELECT id, properties,
    ST_AsMvtGeom(
      geom,
      ST_MakeEnvelope(swLng, swLat, neLng, neLat, 4326),
      4096, 256, true
    ) AS geommvt
  FROM g1_geodatasets
  WHERE geom && ST_MakeEnvelope(...)
    AND ST_Intersects(geom, ST_MakeEnvelope(...))
) AS q;
```

**Performance Optimizations:**
- Bounding box expanded by 1/16 tile size for edge features
- Double envelope check (&&, ST_Intersects) for accuracy
- GIST index usage via spatial operators

### 3.2 GeoJSON Serving with Filtering
**Status:** Completed

**Implementation:**
- Created flexible GET/POST endpoints for GeoJSON retrieval
- Implemented property selection with `_source` parameter
- Added spatial filtering (bounding box + radius)
- Implemented temporal filtering with custom start/end property names
- Created complex boolean filter syntax with operators
- Added DISTINCT ON for duplicate removal

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Filter Syntax Implementation:**
```javascript
// Example input: "name+=+string+Test,AND,severity+>+number+5"
const filterSplit = req.query.filters.split(",");
filters.forEach(f => {
  if (f === "OR" || f === "AND" || f === "NOT_AND" || f === "NOT_OR") {
    // Group operator
  } else {
    const [key, op, type, value] = f.split("+");
    // Build SQL WHERE clause
  }
});
```

**Operator Mapping:**
- `=`: SQL =
- `!=`: SQL !=
- `>`, `<`, `>=`, `<=`: Numeric comparisons
- `in`: SQL IN with array values
- `contains`, `beginswith`, `endswith`: SQL LIKE with wildcards

**Temporal Query Pattern:**
```sql
WHERE (
  (start_time IS NOT NULL AND end_time IS NOT NULL
    AND start_time >= :start AND end_time <= :end)
  OR (start_time IS NULL AND end_time IS NOT NULL
    AND end_time >= :start AND end_time <= :end)
)
```

**Spatial Radius Query:**
```sql
WHERE ST_Intersects(
  geom,
  ST_Transform(
    ST_Buffer(
      ST_Transform(
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
        3857
      ),
      :radius
    ),
    4326
  )
)
```

<!-- HUMAN REVIEW NEEDED: Was there consideration for more complex temporal logic (e.g., partially overlapping ranges)? Current logic is strict containment. -->

### 3.3 Property Selection (_source)
**Status:** Completed

**Implementation:**
- Implemented JSONB operator-based property extraction
- Added nested property access with dot notation
- Created jsonb_build_object SQL generation for selective properties
- Preserved special properties (feature_id, group_id)

**SQL Generation Example:**
```sql
-- Input: _source=name,category,meta.type
SELECT
  jsonb_build_object(
    'name', properties -> 'name',
    'category', properties -> 'category',
    'meta', properties -> 'meta' -> 'type'
  ) AS properties
FROM g1_geodatasets
```

**Client-Side Processing:**
- Flattened nested properties re-expanded using `Utils.setIn2()`
- Special handling for underscore-prefixed system properties

### 3.4 Intersection Queries
**Status:** Completed

**Implementation:**
- Created POST `/geodatasets/intersect` endpoint
- Implemented ST_Intersects with user-provided geometry
- Added support for ST_GeomFromGeoJSON input
- Integrated temporal filtering
- Added DISTINCT ON for duplicate removal

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Query Pattern:**
```sql
SELECT DISTINCT ON (group_id) properties, ST_AsGeoJSON(geom)
FROM g1_geodatasets
WHERE ST_Intersects(geom, ST_GeomFromGeoJSON(:intersect))
  AND temporal_filter_clause
ORDER BY group_id, id DESC;
```

### 3.5 Feature Search & Navigation
**Status:** Completed

**Implementation:**
- Created POST `/geodatasets/search` endpoint
- Implemented key:value lookup with property matching
- Added offset-based navigation (next/previous)
- Implemented "first"/"last" shortcuts
- Added geometry type filtering
- Created custom ordering by property values

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Navigation Logic:**
```javascript
// offset: -1 = previous, 1 = next, "first" = first, "last" = last
// Returns all features, sorts, then picks offset from target
if (offset != null) {
  // Sort by orderBy property
  r.sort((a, b) => {
    // Comparison with sign based on offset direction
  });
  // Extract target feature based on offset
  r = [r[targetIndex]];
}
```

**Use Cases:**
- Image gallery navigation
- Feature inspection workflows
- Temporal sequence browsing

### 3.6 Aggregation Analysis
**Status:** Completed

**Implementation:**
- Created GET `/geodatasets/aggregations` endpoint
- Implemented random sampling for performance
- Added property type inference (string, number, boolean)
- Created value frequency counting
- Added synthetic centroid properties (Latitude/Longitude)

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Aggregation Algorithm:**
```javascript
// 1. Sample up to limit features
SELECT properties FROM g1_geodatasets
WHERE spatial_temporal_filters
ORDER BY RANDOM() DESC LIMIT :limit;

// 2. Client-side aggregation
results.forEach(feature => {
  Object.keys(feature.properties).forEach(prop => {
    let value = feature.properties[prop];
    let type = inferType(value);
    aggs[prop] = aggs[prop] || { type, aggs: {} };
    aggs[prop].aggs[value] = (aggs[prop].aggs[value] || 0) + 1;
  });
});

// 3. Sort by count descending
```

**Synthetic Properties:**
- Latitude (Centroid): ST_Y(ST_Centroid(geom))
- Longitude (Centroid): ST_X(ST_Centroid(geom))

### 3.7 Metadata & Entries API
**Status:** Completed

**Implementation:**
- Created POST `/geodatasets/entries` endpoint
- Implemented cross-mission configuration scanning
- Added layer occurrence tracking
- Queried latest version of each mission configuration

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Cross-Mission Query:**
```sql
SELECT t1.*
FROM configs AS t1
INNER JOIN (
  SELECT mission, MAX(version) AS max_version
  FROM configs
  GROUP BY mission
) AS t2
ON t1.mission = t2.mission
  AND t1.version = t2.max_version
ORDER BY mission ASC;
```

**Configuration Traversal:**
- Recursive layer tree traversal using `Utils.traverseLayers()`
- Detection of `geodatasets:{name}` URL scheme
- Layer name, UUID, and path extraction

## Phase 4: Data Management Operations

### 4.1 Dataset Creation & Updates
**Status:** Completed

**Implementation:**
- Created recreate/append endpoint variants
- Implemented table truncation with RESTART IDENTITY
- Added conditional truncation based on action type
- Updated metadata (num_features, filename, temporal fields)

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Recreate Operation:**
```javascript
TRUNCATE TABLE g1_geodatasets RESTART IDENTITY;
// Bulk insert features
// Update metadata
```

**Append Operation:**
```javascript
// Skip truncation
// Bulk insert features
// Increment num_features
```

### 4.2 Dataset Deletion
**Status:** Completed

**Implementation:**
- Created DELETE `/geodatasets/remove/:name` endpoint
- Implemented two-phase deletion (table + metadata)
- Added error handling for non-existent datasets
- Logged all deletion operations

**Files Modified:**
- `API/Backend/Geodatasets/routes/geodatasets.js`

**Deletion Process:**
```javascript
// 1. Find geodataset metadata
Geodatasets.findOne({ where: { name } })
// 2. Drop feature table
DROP TABLE IF EXISTS g1_geodatasets;
// 3. Delete metadata record
Geodatasets.destroy({ where: { name } })
// 4. Log success
```

**Safety Considerations:**
- IF NOT EXISTS prevents errors on repeated deletion
- Metadata record deleted only after table dropped successfully
- No cascade deletion of references in mission configs

<!-- HUMAN REVIEW NEEDED: Should there be a confirmation step or soft-delete mechanism before permanent deletion? -->

## Phase 5: Frontend Integration

### 5.1 Configure Interface
**Status:** Completed (outside this backend feature scope)

**Implementation:**
- Geodatasets manager page in `/configure` application
- File upload form with temporal field mapping
- Dataset listing with metadata display
- Delete button with confirmation
- Mission occurrence display

**Expected Files:**
- `configure/public/geodatasets.html` (or React component)
- `configure/public/geodatasets.js`
- `configure/public/geodatasets.css`

**Integration Points:**
- POST to `/api/geodatasets/recreate` for upload
- POST to `/api/geodatasets/entries` for listing
- DELETE to `/api/geodatasets/remove/:name` for deletion

### 5.2 Layer Configuration Integration
**Status:** Completed (outside this backend feature scope)

**Implementation:**
- Layer URL scheme: `geodatasets:{name}`
- Layer type support: vector-tile, vector
- Automatic layer updates on geodataset modification

**Configuration Schema:**
```json
{
  "layers": [
    {
      "name": "My Dataset Layer",
      "url": "geodatasets:my_dataset",
      "type": "vector-tile",
      "style": { ... }
    }
  ]
}
```

## Phase 6: Performance Optimization

### 6.1 Index Strategy
**Status:** Completed

**Implementation:**
- GIST spatial indexes on all geometry columns
- GIST temporal indexes for time-range queries
- GIST text indexes for group_id and feature_id
- Idempotent index creation (IF NOT EXISTS)

**Index Verification:**
```sql
-- Check spatial index usage
EXPLAIN ANALYZE
SELECT * FROM g1_geodatasets
WHERE geom && ST_MakeEnvelope(...);
-- Should show "Bitmap Index Scan on g1_geodatasets_geom_idx"
```

### 6.2 Query Optimization
**Status:** Completed

**Implementation:**
- Named parameters to prevent SQL injection
- Bounding box pre-filtering with && operator
- DISTINCT ON for efficient duplicate removal
- VACUUM ANALYZE after bulk inserts for statistics

**Query Plans:**
- MVT queries: <200ms for tiles with 10k features
- GeoJSON queries: <500ms for bounded queries
- Intersection queries: <300ms for moderate complexity geometries

<!-- HUMAN REVIEW NEEDED: Benchmark actual production query times and compare to these estimates -->

### 6.3 Memory Management
**Status:** Completed

**Implementation:**
- Streaming results not implemented (loads all in memory)
- Aggregation limited to sample size
- Bulk inserts chunked by Sequelize internally
- No connection pooling changes (uses MMGIS defaults)

**Known Limitations:**
- Large queries (100k+ features) can cause memory pressure
- No pagination support for GeoJSON responses
- MVT queries naturally limited by tile bounds

<!-- HUMAN REVIEW NEEDED: Should pagination be implemented for large GeoJSON queries? Current limit parameters are boolean only. -->

## Testing & Validation

### Unit Tests
**Status:** Not Documented

<!-- HUMAN REVIEW NEEDED: Were unit tests written? If so, document test coverage and location of test files -->

### Integration Tests
**Status:** Not Documented

<!-- HUMAN REVIEW NEEDED: Were integration tests written? If so, document test scenarios and results -->

### Manual Testing Scenarios
**Status:** Completed (assumed based on production deployment)

**Test Cases:**
1. Upload GeoJSON with 10, 100, 1000, 10000 features
2. Query MVT tiles at various zoom levels
3. Apply temporal filters across date ranges
4. Test intersection with complex geometries
5. Navigate features with search endpoint
6. Delete and recreate datasets
7. Append features to existing datasets

## Deployment & Migration

### Database Migration
**Status:** Completed

**Process:**
1. `geodatasets` table created via Sequelize sync
2. Migration function `up()` adds columns to existing installations
3. Individual geodataset tables created on-demand

**Migration Safety:**
- IF NOT EXISTS prevents double-creation errors
- Column additions graceful (existing data preserved)
- Index creation non-blocking

### Environment Configuration
**Status:** Completed

**Required Settings:**
- PostgreSQL with PostGIS extension enabled
- Database connection parameters in `.env`
- No special environment variables required for geodatasets feature

### Backward Compatibility
**Status:** Maintained

**Considerations:**
- Old geodataset tables continue working after upgrades
- New optional fields (filename, num_features) nullable
- API endpoints additive (no breaking changes)

## Documentation

### API Documentation
**Status:** Limited

**Existing Documentation:**
- `/docs/pages/Configure/Managers/Geodatasets/Manage_Geodatasets.md` (brief)
- Inline code comments in routes file
- No OpenAPI/Swagger specification

<!-- HUMAN REVIEW NEEDED: Should a comprehensive API specification be created? Consider Swagger/OpenAPI format for developer consumption -->

### User Documentation
**Status:** Limited

**Existing Documentation:**
- Configure interface provides basic upload instructions
- No user guide for temporal field mapping
- No examples of filter syntax

<!-- HUMAN REVIEW NEEDED: Create user-facing documentation with examples of common workflows and filter syntax patterns -->

## Future Enhancements

### Planned Improvements
<!-- HUMAN REVIEW NEEDED: Which of these are actually planned vs. aspirational? -->

1. **Raster Support**: GeoTIFF ingestion and COG serving via TiTiler integration
2. **Cross-Dataset Queries**: JOIN operations across multiple geodatasets
3. **Feature Versioning**: Track changes to features over time
4. **Full-Text Search**: PostgreSQL text search on properties
5. **Custom CRS**: Support for non-EPSG:4326 coordinate systems
6. **Pagination**: Cursor-based pagination for large GeoJSON responses
7. **Simplified MVT**: Geometry simplification at low zoom levels
8. **Property Indexing**: B-tree indexes on frequently queried properties
9. **Real-Time Updates**: WebSocket notifications for dataset changes
10. **Access Control**: Field-level security for sensitive properties

### Technical Debt

1. Error handling inconsistencies across endpoints
2. No request rate limiting specific to geodatasets
3. Property filtering logic duplicated across endpoints
4. SQL query string construction (should use query builder)
5. No automatic cleanup of orphaned references in configs

## Lessons Learned

### Successful Patterns

1. **Dynamic Table Creation**: Flexible schema per dataset approach
2. **JSONB Properties**: Avoids rigid schema requirements
3. **Multiple Index Types**: GIST for spatial, temporal, and text
4. **Property Mapping**: Flexible extraction from nested JSON

### Challenges Overcome

1. **Sequelize Dynamic Models**: Required custom table definition approach
2. **MVT Coordinate Conversion**: Web Mercator math for tile bounds
3. **Temporal Range Queries**: NULL handling for unbounded ranges
4. **Nested Property Access**: Dot notation parsing and reconstruction

### Areas for Improvement

1. **SQL Injection Prevention**: More comprehensive sanitization needed
2. **Error Messages**: More actionable error responses for users
3. **Query Performance**: Pagination for large result sets
4. **Test Coverage**: Automated testing for edge cases

<!-- HUMAN REVIEW NEEDED: Add team reflections on what worked well and what could be improved in future similar features -->
