# gdal2customtiles

This wraps together:

- gdal2tiles4extent.py
- gdal2tiles1bto4b_v3.py

---

## Raster Extents:

Tile partial world rasters.

**Requires:**

- `-p raster`
  - This is necessary for generating tiles with a custom extent.
- `-x` OR `--extentworld` followed by values `ulx,uly,lrx,lry,pixel_resolution`
  - The extentworld is the full bounding area of the projection for the planetary body. The extentworld is the full bounding area of the projection for the planetary body. Units are in meters using upper left (ul) and lower right (lr) order. These values are reported from gdalinfo. Units are in meters using upper left (ul) and lower right (lr) order. These values are reported from gdalinfo. Values are separated by commas with no spaces.

**Example:**

```
python gdal2customtiles.py -p raster --extentworld -4022404.001,4022036.893,-4022036.893,4022404.001,367.108150109358121 input.tif output_dir
```

_Notes:_

- Only works if set zoom (-z 0-10) encompasses the native zoom of the raster.
- 'ERROR 5's are expected.

---

## Digital Elevation Model Tiles:

Generate Digital Elevation Maps (DEMs) tiles.

Any 32-bit image data can be encoded into the RGBA channels of a PNG. MMGUS uses this file type to create terrain meshes as well as for a data layer.

**Requires:**

- `-m` or `--dem`

**Example:**

```
python gdal2customtiles.py -p raster --extentworld -4022404.001,4022036.893,-4022036.893,4022404.001,367.108150109358121 --dem inputdem.tif output_dir
```
_Notes:_

- Does not include the convenience of rasterstotiles.py yet.
- Can only tile 32-bit images with --dem option.
