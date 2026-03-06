# Optional Local Tile Layers

This directory is for **optional** user-provided tile layers in TMS or XYZ format.

## Purpose

Demonstrate local tile serving capabilities in MMGIS. The Kitchen Sink configuration includes placeholder tile layers that reference this directory.

## Format

Tiles should follow the standard web mapping tile structure:
```
basemap/{z}/{x}/{y}.png
```

Where:
- `{z}` = Zoom level (e.g., 0-18)
- `{x}` = Tile column (longitude)
- `{y}` = Tile row (latitude)

## Tile Formats Supported

- **PNG**: `{z}/{x}/{y}.png` (most common, supports transparency)
- **JPEG**: `{z}/{x}/{y}.jpg` (smaller file size, no transparency)
- **WebP**: `{z}/{x}/{y}.webp` (modern format, best compression)

## Where to Get Tiles

### Option 1: Download from Public Sources
- **USGS TopoView**: https://ngmdb.usgs.gov/topoview/
- **OpenStreetMap**: Use tile download tools for offline tiles
- **Natural Earth**: https://www.naturalearthdata.com/

### Option 2: Generate Your Own
Use GDAL to tile a GeoTIFF:
```bash
gdal2tiles.py -z 0-14 input.tif output_directory/
```

### Option 3: Use MMGIS Tiling Scripts
See `/auxiliary/gdal2customtiles/` or `/auxiliary/1bto4b/` in the MMGIS repository.

## Configuration

To use local tiles, they're already configured in `config.kitchen-sink.json`:
```json
{
  "name": "Tile - Local - Basemap (Optional)",
  "type": "tile",
  "url": "Missions/Kitchen-Sink/Layers/Tiles/basemap/{z}/{x}/{y}.png"
}
```

If tiles are not present, MMGIS will show placeholder "missing tile" icons - this is expected and acceptable for the demo.

## Example Structure

```
Tiles/
├── basemap/
│   ├── 10/
│   │   ├── 163/
│   │   │   ├── 395.png
│   │   │   ├── 396.png
│   │   │   └── ...
│   │   └── 164/
│   │       └── ...
│   ├── 11/
│   │   └── ...
│   └── 12/
│       └── ...
└── overlay/
    └── (same structure)
```

## Notes

- Tiles are **optional** for Kitchen Sink demo
- External tile providers (ArcGIS, OpenStreetMap) are used by default
- Local tiles useful for offline demos or custom basemaps
