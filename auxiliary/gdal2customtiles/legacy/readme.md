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

Any 32-bit image data can be encoded into the RGBA channels of a PNG. MMGIS uses this file type to create terrain meshes as well as for a data layer.

- Certain resampling methods can corrupt `--dem` results.

**Requires:**

- `-m` or `--dem`

**Example:**

```
python gdal2customtiles.py -p raster --extentworld -4022404.001,4022036.893,-4022036.893,4022404.001,367.108150109358121 --dem inputdem.tif output_dir
```

_Notes:_

- Does not include the convenience of rasterstotiles.py yet.
- Can only tile 32-bit images with --dem option.

## gdal2tiles_3.5.2.py

- `rasters2customtiles_3.5.2.py` and `gdal2tiles_3.5.2.py` support only the `--dem` option (and not `--raster` yet). `-m` no longer works and must be `--dem`. Tested with gdal 3.4.3. Upgraded to support multi-processes. See `python rasters2customtiles_3.5.2.py --help`. Unlike `gda2customtiles.py`, does not seam-match DEM tiles (better for Data Layers and Viewshed Tool, bad for 3D Globe).
- Adds the resampling algorithm `near-composite` that uses nearest-neighbor and ovarlays the new tile onto the old tile (if any in output directory)
- Certain resampling methods can corrupt `--dem` results.
- To support the value 0, all 0 data values get mapped to to the value 2^31 (2147483648) (RGBA=79,0,0,0) and then decoded by the MMGIS reader back to 0. This avoids clashes with other nondata-like values writing to 0,0,0,0 in the outputted pngs.

**Example:**

```
python gdal2tiles_3.5.2.py --dem input.tif output_dir --srcnodata=-9999 -r near-composite --tilesize=128
```
