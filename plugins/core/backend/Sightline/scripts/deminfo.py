# deminfo.py — Report a DEM's native dataset resolution and dimensions.
#
# Reads a JSON object from stdin: { "dem": "<resolved absolute path>" }
# Opens the DEM, reads its GeoTransform (see out_gt handling in
# auxiliary/gdal2customtiles/gdal2customtiles.py) and spatial reference, and
# returns the true (native) ground sample distance in meters-per-pixel.
#
# Response (stdout, single JSON object):
#   {
#     "nativeResolution": <meters per pixel>,   # from GeoTransform
#     "pixelSizeX": <abs(gt[1])>,               # in dataset units
#     "pixelSizeY": <abs(gt[5])>,
#     "cols": <raster width in pixels>,
#     "rows": <raster height in pixels>,
#     "isProjected": <bool>
#   }
# On error: { "error": true, "message": "..." }

import sys
import json
import math

from osgeo import gdal, osr
from osgeo.gdalconst import GA_ReadOnly


def get_pixel_scale(dem_rows, gt, srs):
    """Return approximate meters per pixel from the GeoTransform.

    Mirrors get_pixel_scale() in sightmap.py so the reported native
    resolution matches what the sightmap computation uses internally.
    """
    pw = abs(gt[1])
    ph = abs(gt[5])
    if srs is not None and srs.IsProjected():
        linear_unit = srs.GetLinearUnits()
        return ((pw + ph) / 2.0) * linear_unit
    else:
        mid_lat = gt[3] + (dem_rows / 2.0) * gt[5]
        deg2m = 111320.0 * math.cos(math.radians(mid_lat))
        return ((pw + ph) / 2.0) * deg2m


if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        dem_path = input_data['dem']

        ds = gdal.Open(dem_path, GA_ReadOnly)
        if ds is None:
            raise RuntimeError("Could not open DEM: " + str(dem_path))

        gt = list(ds.GetGeoTransform())
        cols = ds.RasterXSize
        rows = ds.RasterYSize

        srs = None
        wkt = ds.GetProjection()
        if wkt:
            srs = osr.SpatialReference()
            srs.ImportFromWkt(wkt)

        native_resolution = get_pixel_scale(rows, gt, srs)

        print(json.dumps({
            "nativeResolution": native_resolution,
            "pixelSizeX": abs(gt[1]),
            "pixelSizeY": abs(gt[5]),
            "cols": cols,
            "rows": rows,
            "isProjected": bool(srs is not None and srs.IsProjected()),
        }))

    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "error": True,
            "message": str(sys.exc_info()[1]),
        }))
        sys.exit(1)
