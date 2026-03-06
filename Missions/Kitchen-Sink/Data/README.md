# Optional Data Files

This directory is for **optional** user-provided data files used by MMGIS analysis tools.

## Purpose

Provide Digital Elevation Models (DEMs) and derivative data for tools like Measure, Viewshed, Isochrone, and Shade.

## File Types

### 1. Elevation Data (DEM)
**Purpose**: Elevation profiles, viewshed analysis, terrain modeling

**Format**: GeoTIFF (single-band, 32-bit float recommended)

**Tools that use**:
- **Measure Tool**: Generates elevation profiles along drawn paths
- **Identifier Tool**: Returns elevation at mouse cursor
- **Coordinates Display**: Shows elevation at center point

**Recommended file**: `elevation.tif`

### 2. Slope Data
**Purpose**: Terrain slope analysis for traversability

**Format**: GeoTIFF (single-band, slope in degrees or percent)

**Tools that use**:
- **Isochrone Tool**: Calculates travel time based on slope

**Recommended file**: `slope.tif`

### 3. Cost Surface Data
**Purpose**: Traversability cost maps for path planning

**Format**: GeoTIFF (single-band, cost values)

**Tools that use**:
- **Isochrone Tool**: Custom cost surfaces for analysis

**Recommended file**: `cost.tif`

## Where to Get Data

### USGS 3D Elevation Program (3DEP)
**URL**: https://www.usgs.gov/3d-elevation-program

- **Resolution**: 1m, 3m, 10m, 30m DEMs available
- **Coverage**: Complete USA coverage
- **Format**: GeoTIFF, Cloud-Optimized GeoTIFF
- **Download**: https://apps.nationalmap.gov/downloader/

### NASA SRTM (Shuttle Radar Topography Mission)
**URL**: https://www2.jpl.nasa.gov/srtm/

- **Resolution**: 30m (1 arc-second) globally
- **Coverage**: 60°N to 56°S
- **Format**: GeoTIFF via Earth Explorer

### Copernicus DEM
**URL**: https://spacedata.copernicus.eu/

- **Resolution**: 30m and 90m globally
- **Coverage**: Global
- **Format**: GeoTIFF

## Processing DEMs

### Generate Slope from DEM
```bash
gdaldem slope elevation.tif slope.tif -compute_edges
```

### Generate Cost Surface (Example: Slope-based)
```bash
# Cost = 1 + (slope_degrees / 90)
gdal_calc.py -A slope.tif --outfile=cost.tif \
  --calc="1+(A/90)" --NoDataValue=0
```

### Tile DEM for Viewshed/Shade Tools
```bash
# See /auxiliary/gdal2customtiles/ or /auxiliary/1bto4b/
gdal2tiles.py -z 10-16 elevation.tif dem_tiles/
```

## Configuration

Tools are configured in `config.kitchen-sink.json` with placeholder paths:

### Measure Tool
```json
{
  "name": "Measure",
  "variables": {
    "dem": "Missions/Kitchen-Sink/Data/elevation.tif"
  }
}
```

### Identifier Tool
```json
{
  "name": "Identifier",
  "variables": {
    "layers": [
      {
        "name": "Elevation",
        "url": "Missions/Kitchen-Sink/Data/elevation.tif",
        "bands": 1,
        "unit": " m"
      }
    ]
  }
}
```

### Viewshed Tool
```json
{
  "name": "Viewshed",
  "variables": {
    "data": [
      {
        "name": "SF Bay DEM",
        "demtileurl": "Missions/Kitchen-Sink/Data/dem_tiles/{z}/{x}/{y}.png",
        "minZoom": 10,
        "maxNativeZoom": 16
      }
    ]
  }
}
```

### Isochrone Tool
```json
{
  "name": "Isochrone",
  "variables": {
    "data": {
      "DEM": [{ "name": "Elevation", "tileurl": "..." }],
      "slope": [{ "name": "Slope", "tileurl": "..." }],
      "cost": [{ "name": "Cost", "tileurl": "..." }]
    }
  }
}
```

## Recommended for Kitchen Sink (SF Bay Area)

1. **USGS 3DEP 10m DEM** of San Francisco Bay Area
   - Size: ~50-100MB for bay area
   - Resolution: Good balance of detail and file size

2. **Derived Slope** (from DEM)
   - Calculate using `gdaldem slope`

3. **Simple Cost Surface** (optional)
   - Slope-based or uniform cost

## Notes

- Data files are **optional** for Kitchen Sink demo
- Config includes placeholder URLs
- Tools show appropriate messages when data is missing
- For production: Consider tiling DEMs for performance
- 404 errors from missing files are expected and acceptable
