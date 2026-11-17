# Optional Image Layers

This directory is for **optional** user-provided GeoTIFF or Cloud-Optimized GeoTIFF (COG) files.

## Purpose

Demonstrate MMGIS Image layer type capabilities, including single-band and multi-band imagery with dynamic colormaps.

## Format

### GeoTIFF
Standard georeferenced TIFF format:
- Single-band or multi-band
- Must include georeferencing information (GeoTIFF tags)
- Any bit depth (8-bit, 16-bit, 32-bit float)

### Cloud-Optimized GeoTIFF (COG)
Optimized GeoTIFF for efficient web serving:
- Internal tiling for fast random access
- Overviews for multi-resolution display
- HTTP range request support

## Where to Get Data

### Earth Observation Data
- **USGS Earth Explorer**: https://earthexplorer.usgs.gov/
  - Landsat imagery (30m resolution)
  - Sentinel-2 imagery (10m resolution)
  - Aerial photography

- **NASA Earthdata**: https://earthdata.nasa.gov/
  - MODIS products
  - ASTER imagery
  - Various environmental datasets

- **Copernicus Open Access Hub**: https://scihub.copernicus.eu/
  - Sentinel-1, Sentinel-2, Sentinel-3 data

### Processing Tools

Convert to COG using GDAL:
```bash
gdal_translate input.tif output_cog.tif \
  -co TILED=YES \
  -co COMPRESS=DEFLATE \
  -co COPY_SRC_OVERVIEWS=YES
```

Generate overviews:
```bash
gdaladdo -r average input.tif 2 4 8 16
```

## Configuration

Image layers are configured in `config.reference-mission.json`:
```json
{
  "name": "Image - GeoTIFF - Single Band (Optional)",
  "type": "image",
  "url": "Missions/Reference-Mission/Layers/Images/sample.tif",
  "bands": 1,
  "colormap": "viridis"
}
```

If files are not present, the layer will fail to load gracefully - this is expected for the demo.

## Recommended for Reference Mission

For SF Bay Area demo:
- **Landsat 8 scene** of San Francisco Bay (30m resolution)
- **Sentinel-2 scene** for higher resolution (10m)
- **DEM derivatives** (hillshade, slope) from USGS 3DEP

File size: Keep < 100MB for reasonable git storage

## Notes

- Images are **optional** for Reference Mission demo
- Config includes placeholder URLs
- Demonstrates Image layer capabilities even without files
- For production: Consider hosting large imagery externally
