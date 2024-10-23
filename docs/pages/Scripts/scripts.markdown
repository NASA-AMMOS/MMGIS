---
layout: page
title: Auxiliary Scripts
permalink: /scripts
nav_order: 8
---

# Auxiliary Scripts

On the supporting scripts inside `/auxiliary`.

Scripts can help with processing and formatting data. Only the significant ones will be detailed below and otherwise check them from READMEs.

# gdal2customtiles.py

_Python 3.10.5_

Accepts all [gdal2tiles.py](https://gdal.org/programs/gdal2tiles.html) options. Built off of GDAL 3.5.2 and tested with GDAL 3.4.3, it adds the following new features and capabilities.

---

## Raster Extents:

Tile partial world rasters. Useful for tiling non-mercator and non-geodetic projected data.

**Requires:**

- `-p raster`
  - This is necessary for generating tiles with a custom extent.
- `--extentworld` followed by values `ulx,uly,lrx,lry,pixel_resolution`
  - The extentworld is the full bounding area of the projection for the planetary body. The extentworld is the full bounding area of the projection for the planetary body. Units are in meters using upper left (ul) and lower right (lr) order. These values are reported from gdalinfo. Units are in meters using upper left (ul) and lower right (lr) order. These values are reported from gdalinfo. Values are separated by commas with no spaces.

#### Example:

```
python gdal2customtiles.py -p raster --extentworld -931100.000,931100.000,931100.000,-931100.000,100 inputs/WAC_GLOBAL_P900S0000_100M.tif outputs/WAC_GLOBAL_P900S0000_100M
python gdal2customtiles.py -p raster --extentworld -931100.000,931100.000,931100.000,-931100.000,100 inputs/ldem_87s_5mpp_hillshade.tif outputs/ldem_87s_5mpp_hillshade
```

- `WAC_GLOBAL_P900S0000_100M.tif` is in Lunar South Polar projection (IAU2000:30120). Its data covers the full bounds of that projection's world-space (it's world extent/"extentworld") thus we use its bounds and pixel resolution directly from its metadata: `--extentworld -931100.000,931100.000,931100.000,-931100.000,100`

  - _Note: If your basemap does not cover the full world-space, you would need to compute the world-space's bounds and its resolution relative to your datasets_

- `ldem_87s_5mpp_hillshade.tif` is also in Lunar South Polar projection (IAU2000:30120). Its data only covers a small region of the projection's world-space. We still use the previous `--extentworld -931100.000,931100.000,931100.000,-931100.000,100`

_Notes:_

- Only works if set zoom (-z 0-10) encompasses the native zoom of the raster.

---

## Digital Elevation Model Tiles:

Generate Digital Elevation Maps (DEMs) tiles.

Any 32-bit image data can be encoded into the RGBA channels of a PNG. MMGIS uses this file type to create terrain meshes as well as for Data Layers.

**Requires:**

- `-m` or `--dem`

**Example:**

```
python gdal2customtiles.py -p raster --extentworld -4022404.001,4022036.893,-4022036.893,4022404.001,367.108150109358121 --dem inputdem.tif output_dir
```

_Notes:_

- Can only tile 32-bit images with --dem option.
- Current `--dem` tiles do not seam-match tile edges. This may or may not be desired (not seam-matching is better for Data Layers and the Viewshed Tool, but bad for MMGIS' 3D Globe/LithoSphere). If seam-matching is desired use `legacy/gdal2customtiles.py` or `legacy/gdal2customtiles_py27.py`
- Certain resampling methods can corrupt `--dem` results.
- To support the value 0, all 0 data values get mapped to to the value 2^31 (2147483648) (RGBA=79,0,0,0) and then decoded by the MMGIS reader back to 0. This avoids clashes with other nondata-like values writing to 0,0,0,0 in the outputted pngs.

---

## Compositing Tiles:

Adds the resampling algorithm `near-composite` that uses nearest-neighbor resampling and overlays the new tile onto the old tile (if any in output directory). This makes it possible to accumulate or combine tilesets at the individual tile image level. Data in tiles can be overwritten by this process so be cognizant of run order and input extents.

**Example:**

```
python gdal2customtiles.py -r near-composite --srcnodata=-9999 --processes=40 --tilesize=128 --dem input_A.tif output_dir
python gdal2customtiles.py -r near-composite --srcnodata=-9999 --processes=40 --tilesize=128 --dem input_B.tif output_dir
```

_Notes:_

- Nodata values are treated as transparent and will not overwrite existing pixels in the output tile images.

---

# raster2customtiles.py

_Python 3.10.5_

A convenience script that wraps gda2customtiles.py. Translates the input data into EPSG:4326 and sets proper ground control points. Might be outdated. Use gdal2customtiles directly for the most control.

**Usage:**
`rasters2customtiles.py [options] input_file [output]` or see `--help`
