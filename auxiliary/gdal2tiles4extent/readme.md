## gdal2tiles4extent

Modified gdal2tiles script with the option to tile projected rasters.


**Required Options**

-p raster

This is necessary for generating tiles with a custom extent.


-x OR --extentworld ulx,uly,lrx,lry,pixel resolution

The extentworld is the full bounding area of the projection for the planetary body.
Units are in meters using upper left (ul) and lower right (lr) order. These values are reported from gdalinfo.
Values are separated by commas with no spaces.


**Example:**
```
python gdal2tiles4extent.py -p raster --extentworld -4022404.1,4022404.1,4022036.5,-4022036.5,367.1 input.tif output_dir
```


**DEM:**
To output Digital Elevation Maps (DEM) the MMGIS can read, include the `-m` or `--dem`

_Notes:_

- Let the script set the zoom levels.

- 'ERROR 5's are expected and can be ignored.
