# use like: gdalinfoMinMax.py filepath bands
# where bands can be [band, band, ...] or [[startband,endband]], [startband,endband], band, ... ] (inclusive)

# returns a json of {{'min': value, 'max': value}}

import sys
import ast
import json

from osgeo import gdal
try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

# Make gdal use exceptions instead of their own errors so that they can be caught
gdal.UseExceptions()


def getStatsAtBand(b):
    data = []
    for i in range(0, len(bands)):
        try:
            # an int or an array of int
            # if part needs work (safer to pass bands: "[[x,y]]" now)
            if(isinstance(bands[i], int)):
                band = ds.GetRasterBand(bands[i])
                minVal, maxVal, _, _ = band.GetStatistics(True, True)
                data.append({'band': bands[i], 'min': minVal, 'max': maxVal})
            else:
                # +1 for inclusivity
                for j in range(bands[i][0], bands[i][1] + 1):
                    band = ds.GetRasterBand(j)
                    minVal, maxVal, _, _ = band.GetStatistics(True, True)
                    data.append({'band': j, 'min': minVal, 'max': maxVal})
        except Exception as e:
            minVal = None
            maxVal = None
    return data


# Get arguments
raster = unquote(sys.argv[1])  # path
bands = ast.literal_eval(unquote(sys.argv[2]))  # bands

# Open the image
ds = gdal.Open(raster.strip(), gdal.GA_ReadOnly)
if ds is None:
    print("Could not open image")
    sys.exit(1)

value = getStatsAtBand(bands)
print(json.dumps(value))
