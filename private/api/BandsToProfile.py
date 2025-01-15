# use like: BandsToProfile.py raster x/lat y/lon xy/ll bands
# where bands can be [band, band, ...] or [[startband,endband]], [startband,endband], band, ... ] (inclusive)

# returns an array of [band,value]

# example: BandsToProfile.py MSL_DEM_v3_webgis.tif -4.66086473 137.36935616 ll [[0,7],9]
# 2ptsToProfile.py MSL_DEM_v3_webgis.tif -4.67053145 137.36515045 -4.66086473 137.36935616 10 1

import sys
import ast
import re
import numpy as np
import math
from osgeo import gdal
from osgeo import osr
from osgeo.gdalconst import *
from osgeo import __version__ as osgeoversion
try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

# Make gdal use exceptions instead of their own errors so that they can be caught
gdal.UseExceptions()


def getValueAtBand(b):
    try:
        # Get the band
        band = ds.GetRasterBand(b)
        value = band.ReadAsArray(
            pixelLatLonPair[0][0], pixelLatLonPair[0][1], 1, 1)[0][0]

        bandName = band.GetDescription()
        if isinstance(bandName, str):
            matchedName = re.findall(r"[-+]?\d*\.\d+|\d+", bandName)
            if len(matchedName) > 0:
                bandName = float(matchedName[0])
            else:
                bandName = b
        else:
            bandName = b
        # check for nan
        if value != value:
            value = None
            bandName = None
        elif value == band.GetNoDataValue():
            value = None
    except Exception as e:
        # -1100101 = (e)rror
        value = None
        bandName = None


    return np.array([bandName, value]).tolist()


# Takes in a [[x,y],[x,y],[x,y],[x,y]...[x,y],[x,y]]
# and returns an array of values on the raster at those points in order
def getRasterDataValues():
    valuesArray = []
    for i in range(0, len(bands)):
        # an int or an array of int
        # if part needs work (safer to pass bands: "[[x,y]]" now)
        if(isinstance(bands[i], int)):
            value = getValueAtBand(bands[i])
            valuesArray.append(value)
        else:
            # +1 for inclusivity
            for j in range(bands[i][0], bands[i][1] + 1):
                value = getValueAtBand(j)
                valuesArray.append(value)
    return valuesArray


# Takes in a [[lat,lon],[lat,lon]...[lat,lon]]
# and returns [[pixel,pixel][pixel,pixel]...[pixel,pixel]]
# based on the predeclared ds (gdal.open(raster))
def latLonsToPixel(latLonPairs):
    # get georeference info
    transform = ds.GetGeoTransform()
    xOrigin = transform[0]
    yOrigin = transform[3]
    pixelWidth = transform[1]
    pixelHeight = transform[5]
    # Create a spatial reference object for the dataset
    srs = osr.SpatialReference()
    if int(osgeoversion[0]) >= 3:
        # GDAL 3 changes axis order: https://github.com/OSGeo/gdal/issues/1546
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.ImportFromWkt(ds.GetProjection())
    # Set up the coordinate transformation object
    srsLatLong = srs.CloneGeogCS()
    ct = osr.CoordinateTransformation(srsLatLong, srs)
    # Go through all the point pairs and translate them to latitude/longitude pairings
    pixelPairs = []
    for point in latLonPairs:
        # Change the point locations into the GeoTransform space
        (point[1], point[0], holder) = ct.TransformPoint(point[1], point[0])
        # Translate the x and y coordinates into pixel values
        x = (point[1] - xOrigin) / pixelWidth
        y = (point[0] - yOrigin) / pixelHeight
        if math.isinf(x):
            x = 0
        if math.isinf(y):
            y = 0
        # Add the point to our return array
        pixelPairs.append([int(x), int(y)])
    return pixelPairs


# Get arguments
raster = unquote(sys.argv[1])  # path
lat = float(sys.argv[2])  # x
lon = float(sys.argv[3])  # y
if str(sys.argv[4]).isalnum():
    type = str(sys.argv[4])  # xyorll
bands = ast.literal_eval(unquote(sys.argv[5]))  # bands


latLonPair = [[lat, lon]]

# Open the image
ds = gdal.Open(raster, GA_ReadOnly)
if ds is None:
    print("Could not open image")
    sys.exit(1)

# Convert latlon to image space pixels
if type == 'll':
    pixelLatLonPair = latLonsToPixel(latLonPair)
else:
    pixelLatLonPair = latLonPair
    pixelLatLonPair[0][0] = int(pixelLatLonPair[0][0])
    pixelLatLonPair[0][1] = int(pixelLatLonPair[0][1])

# Find the raster value at each of those points
valueArray = getRasterDataValues()

print(valueArray)
