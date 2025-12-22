# Geodata Management & Tile Serving - Feature Specification

## Overview

The MMGIS Geodata Management & Tile Serving system provides comprehensive geospatial data handling capabilities for the Multi-Mission Geographic Information System. The feature enables users to upload, manage, and serve vector and raster geospatial data through a unified interface. It supports multiple data formats (GeoJSON, GeoTIFF), provides flexible tile serving mechanisms (MVT, GeoJSON), and integrates with PostGIS for spatial querying and analysis.

## Feature Description

### Core Capabilities

The Geodata Management & Tile Serving feature implements a complete data lifecycle management system:

1. **Data Ingestion** - Upload and process GeoJSON and GeoTIFF files into managed geodatasets
2. **Metadata Management** - Track dataset properties including temporal fields, grouping identifiers, and feature IDs
3. **Spatial Indexing** - Automatic creation of spatial and temporal indexes for query optimization
4. **Vector Tile Serving** - Generate MapBox Vector Tiles (MVT) with z/x/y tile coordinates
5. **GeoJSON Serving** - Serve full feature collections with property filtering and spatial bounding
6. **Temporal Queries** - Filter features by start/end time fields across date ranges
7. **Spatial Filtering** - Query features within specified geographical regions
8. **Feature Aggregation** - Analyze property distributions and frequency statistics across datasets
9. **Data Append/Replace** - Add new features to existing datasets or replace entire datasets
10. **Access Control** - Integration with mission-based configuration system for visibility control

### Geodataset Architecture

#### Data Model

A geodataset represents a collection of geographic features stored in a dedicated PostgreSQL table with PostGIS geometry support:

```sql
-- Metadata Table
geodatasets {
  id: SERIAL PRIMARY KEY
  name: VARCHAR UNIQUE NOT NULL (user-friendly identifier)
  table: VARCHAR UNIQUE NOT NULL (actual table name: g{id}_geodatasets)
  filename: VARCHAR (source file identifier)
  num_features: INTEGER (count of features in dataset)
  start_time_field: VARCHAR (property name for temporal start)
  end_time_field: VARCHAR (property name for temporal end)
  group_id_field: VARCHAR (property name for grouping/clustering)
  feature_id_field: VARCHAR (property name for feature identification)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}

-- Feature Data Table (per geodataset)
g{id}_geodatasets {
  id: SERIAL PRIMARY KEY
  properties: JSONB (feature attributes)
  geometry_type: VARCHAR (Point, LineString, Polygon, etc.)
  geom: GEOMETRY (PostGIS geometry column, EPSG:4326)
  start_time: BIGINT (epoch milliseconds, optional)
  end_time: BIGINT (epoch milliseconds, optional)
  group_id: VARCHAR (feature grouping identifier, optional)
  feature_id: VARCHAR (external feature identifier, optional)
}
```

#### Indexing Strategy

Automatic index creation for performance optimization:

- **Spatial Index (GIST)**: `{table}_geom_idx` on `geom` column for spatial queries
- **Temporal Index (GIST)**: `{table}_time_idx` on `(start_time, end_time)` for time-range filtering
- **Group ID Index (GIST)**: `{table}_group_id_idx` on `group_id` for grouping queries
- **Feature ID Index (GIST)**: `{table}_feature_id_idx` on `feature_id` for feature lookup

<!-- HUMAN REVIEW NEEDED: Verify if additional indexes (B-tree on properties keys) would improve query performance for specific use cases -->

### Data Ingestion & Processing

#### GeoJSON Upload Pipeline

**Process Flow:**
1. User uploads GeoJSON file through `/configure` interface
2. System validates GeoJSON structure and CRS (EPSG:4326 required)
3. Optional temporal property field mapping (start_time, end_time)
4. Optional grouping property specification (group_id_field)
5. Optional feature ID property specification (feature_id_field)
6. Geodataset metadata record created or updated
7. Feature table created or truncated
8. Features bulk-inserted with geometry validation
9. Spatial and temporal indexes created
10. VACUUM ANALYZE executed for statistics optimization

**File Format Support:**
- Standard GeoJSON FeatureCollection format
- Individual Feature objects (wrapped in FeatureCollection by system)
- CRS handling: EPSG:4326 (WGS84) assumed if not specified
- Geometry types: Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon

**Property Mapping:**
- Temporal properties automatically converted to epoch milliseconds
- Group ID properties support comma-separated field merging (e.g., "track,frame")
- Feature ID properties support comma-separated field merging (e.g., "track,id")
- Additional properties stored as-is in JSONB column

#### Append vs Replace Operations

- **Recreate/Replace** (`POST /geodatasets/recreate`): Truncates existing table and reloads all features
- **Append** (`POST /geodatasets/append`): Inserts new features without truncating existing data
- Feature count automatically updated to reflect total features in dataset

### Query & Retrieval Capabilities

#### Vector Tile (MVT) Serving

**Endpoint:** `POST /geodatasets/get?type=mvt&layer={name}&x={x}&y={y}&z={z}`

**Implementation Details:**
- Converts z/x/y tile coordinates to WGS84 bounding box
- Applies ST_AsMvtGeom for tile coordinate transformation
- Expands query bounds by 1/16 of tile size for proper feature inclusion
- Returns Protocol Buffer format binary response
- Supports Content-Type: application/x-protobuf

**Tile Coordinate Conversion:**
```javascript
// Reverse Web Mercator projection
tile2Lng(x, z) = (x / 2^z) * 360 - 180
tile2Lat(y, z) = atan(sinh(π - 2πy/2^z)) * 180/π
```

**Performance Characteristics:**
- Single SQL query with geometric operations
- Optimized with spatial indexes
- No property filtering in MVT (all properties included)
- Binary encoding reduces payload size

<!-- HUMAN REVIEW NEEDED: Determine if MVT should support property filtering to reduce payload size for large feature datasets -->

#### GeoJSON Serving

**Endpoint:** `GET /geodatasets/get?layer={name}&type=geojson` or `POST /geodatasets/get`

**Query Parameters:**
- `layer` (required): Dataset name
- `type` (optional, default: geojson): Return format
- `_source` (optional): Property filtering (comma-separated or array)
- `minx, miny, maxx, maxy` (optional): Bounding box filter (WGS84)
- `starttime, endtime` (optional): Temporal range filter (ISO 8601 strings)
- `startProp, endProp` (optional): Custom temporal property names
- `filters` (optional): Property-based filtering with operators
- `spatialFilter` (optional): Radius-based spatial query (lat,lng,radius)
- `noDuplicates` (optional, boolean): Filter duplicates by group_id or geometry
- `limited` (optional, boolean): Return top 3 results for preview

**Property Filtering (_source):**
```javascript
// Include specific properties only
?_source=name,category,start_time
// Nested property access supported
?_source=properties.name,properties.attributes.type
```

**Filtering Syntax:**
Complex boolean filters with operators:
```
key+operator+type+value,AND,key2+operator2+type2+value2
// Example: name+=+string+Test,AND,severity+>+number+5
```

Supported operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `in`, `contains`, `beginswith`, `endswith`

**Temporal Filtering:**
```
starttime=2024-01-01T00:00:00Z&endtime=2024-12-31T23:59:59Z
// Handles both bounded and unbounded time windows
```

**Spatial Filtering:**
```
spatialFilter=34.0522,-118.2437,1000  // lat,lng,radius(meters)
// Uses ST_Buffer and ST_Transform for spherical calculations
```

**Response Format:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "_": { "idx": 123 }
      },
      "geometry": { "type": "Point", "coordinates": [...] }
    }
  ],
  "feature_id_field": "string or null",
  "group_id_field": "string or null"
}
```

#### Intersection Queries

**Endpoint:** `POST /geodatasets/intersect`

**Purpose:** Find features intersecting with a provided geometry

**Request Body:**
```json
{
  "layer": "dataset_name",
  "intersect": { "type": "Polygon", "coordinates": [[...]] },
  "noDuplicates": boolean,
  "starttime": "2024-01-01T00:00:00Z",
  "endtime": "2024-12-31T23:59:59Z"
}
```

**Implementation:**
- Uses ST_Intersects PostGIS operator
- Supports temporal filtering
- Duplicate removal via DISTINCT ON clause

#### Feature Search

**Endpoint:** `POST /geodatasets/search`

**Purpose:** Navigate between features by property value or spatial bounds

**Request Body:**
```json
{
  "layer": "dataset_name",
  "key": "property_name",
  "value": "property_value",
  "id": feature_id,
  "offset": 1 | -1 | "first" | "last",
  "orderBy": "property_name",
  "restrictToGeometryType": "Point | LineString | Polygon",
  "minx": -180, "miny": -90, "maxx": 180, "maxy": 90
}
```

**Behavior:**
- Returns single feature matching key:value (or all in bounds if no key:value)
- offset parameter enables navigation (next/previous feature)
- "first"/"last" return boundary features
- Filtering by geometry type supported

#### Aggregations

**Endpoint:** `GET /geodatasets/aggregations?layer={name}&limit={limit}&minx={minx}...`

**Purpose:** Analyze property value distributions

**Algorithm:**
1. Sample up to {limit} features (default 500) from specified bounds
2. Extract all properties from sample
3. Determine property type (number, string, boolean)
4. Count value frequencies
5. Return sorted aggregations by count

**Response Format:**
```json
{
  "status": "success",
  "aggregations": {
    "property_name": {
      "type": "string | number | boolean",
      "aggs": {
        "value1": 42,
        "value2": 15
      }
    },
    "Latitude (Centroid)": { "type": "number", "aggs": {} },
    "Longitude (Centroid)": { "type": "number", "aggs": {} }
  }
}
```

#### Entries Metadata

**Endpoint:** `POST /geodatasets/entries`

**Purpose:** List all geodatasets with usage information

**Response Format:**
```json
{
  "status": "success",
  "body": {
    "entries": [
      {
        "name": "dataset_name",
        "filename": "original_filename",
        "num_features": 1000,
        "updated": "2024-01-15T10:30:00Z",
        "start_time_field": "start_time",
        "end_time_field": "end_time",
        "group_id_field": "track_id",
        "feature_id_field": "feature_id",
        "occurrences": {
          "mission_1": [
            { "name": "Layer Name", "uuid": "uuid-value", "path": "layers.layer1" }
          ]
        }
      }
    ]
  }
}
```

### Data Management Operations

#### Dataset Creation

**Endpoint:** `POST /geodatasets/recreate/:name` or `POST /geodatasets/recreate/:name/:start_end_prop`

**Parameters:**
- `name`: Unique dataset identifier (sanitized for SQL safety)
- `start_end_prop` (optional): Comma-separated temporal field names
- Request body: GeoJSON FeatureCollection

**Validation:**
- Name sanitization: Removes special characters
- GeoJSON validation: Must be valid feature collection
- Geometry validation: All features must have valid PostGIS geometries
- CRS assumed EPSG:4326

**Constraints:**
<!-- HUMAN REVIEW NEEDED: Verify maximum dataset size limits and feature count thresholds -->
- Maximum features per dataset: Not enforced (system dependent)
- Supported geometry types: All valid WKT types
- File size limits: Determined by HTTP upload limits

#### Dataset Update (Append)

**Endpoint:** `POST /geodatasets/append/:name`

**Behavior:**
- Appends new features without truncating table
- Updates num_features count
- Does not recreate metadata unless explicitly modified
- Reuses existing start_time_field, end_time_field, etc.

**Use Cases:**
- Incremental data loading for large datasets
- Streaming sensor data ingestion
- Multi-part uploads of related data

#### Dataset Deletion

**Endpoint:** `DELETE /geodatasets/remove/:name`

**Operations:**
1. Drop feature table from database
2. Delete metadata record from geodatasets table
3. Return success/failure status

**Cascade Effects:**
- Any references to deleted dataset in mission configurations become invalid
- No automatic cleanup of references (configuration must be manually updated)

### Integration with Mission Configuration

Geodatasets are referenced in mission configuration files using URL scheme:

```json
{
  "layers": [
    {
      "name": "Vector Layer",
      "url": "geodatasets:dataset_name",
      "type": "vector-tile"
    }
  ]
}
```

**Configuration Integration:**
- Dataset appears in `/configure` interface
- Dataset occurrences tracked across all missions
- Layer names and UUIDs recorded for reference
- Manual or scripted cleanup required when datasets deleted

<!-- HUMAN REVIEW NEEDED: Should system provide automated cleanup or warnings when deleting datasets that are referenced in active configurations? -->

### Data Format & Encoding

#### Geometry Encoding

- **Storage Format**: PostGIS GEOMETRY type (EPSG:4326)
- **Query Format**: ST_AsGeoJSON for output, ST_GeomFromGeoJSON for input
- **Tile Format**: ST_AsMvtGeom for MVT coordinate transformation
- **Validation**: Automatic via PostGIS during insert

#### Property Storage

- **Format**: JSONB (JSON Binary) PostgreSQL type
- **Indexing**: Partial support via jsonb_build_object for specific properties
- **Nested Access**: Dot notation supported (e.g., "attributes.type")
- **Type Inference**: Numbers quoted in JSON treated as strings unless explicitly cast

#### Temporal Encoding

- **Storage**: BIGINT (epoch milliseconds)
- **Input**: ISO 8601 date strings parsed to epoch
- **Filtering**: Range queries on BIGINT with epsilon tolerance
- **Bounds**: Supports unbounded ranges (one side NULL)

### Performance Considerations

#### Spatial Query Optimization

1. **GIST Indexes**: B-tree variant optimized for spatial data (R-tree like behavior)
2. **Bounding Box Filtering**: ST_MakeEnvelope for rectangular bounds
3. **Geometry Operators**: ST_Intersects preferred over ST_Contains for performance
4. **Index Selectivity**: ST_Intersects with bounding box reduces full scan

#### Temporal Query Optimization

1. **Time Range Indexes**: GIST indexes on (start_time, end_time) tuples
2. **Epoch Filtering**: Millisecond precision allows efficient range queries
3. **NULL Handling**: Separate logic for bounded/unbounded windows

#### Data Aggregation

1. **Random Sampling**: RANDOM() DESC LIMIT for representative sampling
2. **Type Inference**: Client-side categorization of property types
3. **Memory Management**: Aggregation limited to sample size (default 500)

<!-- HUMAN REVIEW NEEDED: Verify if aggregation sampling strategy is statistically representative for large datasets with skewed distributions -->

### Error Handling & Validation

#### Input Validation

- SQL Injection: `forceAlphaNumUnder()` utility sanitizes numeric/alphanumeric inputs
- GeoJSON Validation: JSON.parse() with try/catch
- Property Access: Dot notation validated before query construction
- Operator Whitelisting: Only approved operators accepted in filter strings

#### Error Response Format

```json
{
  "status": "failure",
  "message": "Human-readable error description"
}
```

**Common Errors:**
- "Not Found": Dataset does not exist
- "Malformed file": Invalid GeoJSON structure
- "Failure: Malformed file": Parse errors or missing required fields
- "Failed to query Geodataset": Database operation error
- "SQL error": Query construction or execution error

#### Database Integrity

- Transaction safety via Sequelize promises
- Bulk operations with error rollback
- Index creation with IF NOT EXISTS for idempotency
- VACUUM ANALYZE post-insert for statistics

## Storage & Infrastructure

### Database Requirements

- PostgreSQL with PostGIS extension
- PostGIS functions: ST_AsGeoJSON, ST_GeomFromGeoJSON, ST_AsMvt, ST_MakeEnvelope, ST_Intersects, ST_Buffer, ST_Centroid
- Support for JSONB type (PostgreSQL 9.4+)
- GIST index support for spatial queries

### Scaling Considerations

**Single Dataset Limitations:**
- Tested up to millions of features
- Query performance degrades with dataset size (mitigated by indexes)
- Memory usage depends on feature count and property complexity

**Multi-Dataset Architecture:**
- Separate table per dataset ensures isolation
- Cross-dataset queries require UNION operations (not optimized)
- Metadata lookups cached at application level

<!-- HUMAN REVIEW NEEDED: Determine if partitioning strategy should be implemented for very large datasets (100M+ features) -->

## API Response Times

**Expected Performance (on standard hardware):**
- GeoJSON query (10,000 features): 100-500ms
- MVT generation (tile bounds): 50-200ms
- Intersection query: 50-500ms (depending on geometry complexity)
- Aggregation query: 100-1000ms

<!-- HUMAN REVIEW NEEDED: Provide actual benchmark data from production deployments -->

## Security & Access Control

### Data Access

- Geodatasets referenced in mission configurations are implicitly visible
- Mission-based access control enforced at configuration level
- No granular field-level access control
- Read-only API (no authentication checks on GET endpoints)

<!-- HUMAN REVIEW NEEDED: Should read-only endpoints require authentication? Should sensitive datasets have additional access controls? -->

### SQL Safety

- Table names sanitized via `forceAlphaNumUnder()` (whitelist alphanumeric + underscores)
- Numeric values coerced to prevent injection
- Named parameters used for all user-provided values
- Query string construction from validated components

### Data Validation

- CRS validation (must be EPSG:4326)
- Geometry type validation (must match WKT specification)
- Property names validated against JSONB structure
- Temporal values validated as valid dates

## Known Limitations & Future Improvements

1. **No Cross-Dataset Queries**: Cannot join features from multiple geodatasets
2. **Limited Property Filtering**: Cannot query nested JSONB structures deeply
3. **No Feature Versioning**: Dataset updates replace historical data
4. **No Full-Text Search**: Property search limited to exact/wildcard matching
5. **MVT Property Filtering**: All properties included in tiles (payload optimization pending)
6. **Geometry Simplification**: No automatic simplification for large geometries at low zoom levels
7. **Custom CRS**: Only EPSG:4326 supported (reprojection not supported)
8. **Raster Support**: Limited to vector data (raster/GeoTIFF support planned)

<!-- HUMAN REVIEW NEEDED: Prioritize which limitations should be addressed in next development phase -->
