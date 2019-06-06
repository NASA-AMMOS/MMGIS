#use like: BandsToProfile.py raster x/lat y/lon xy/ll bands
# where bands can be [band, band, ...] or [[startband,endband]], [startband,endband], band, ... ] (inclusive)

#returns an array of [band,value]

#example: BandsToProfile.py MSL_DEM_v3_webgis.tif -4.66086473 137.36935616 [[0,7],9]
#2ptsToProfile.py MSL_DEM_v3_webgis.tif -4.67053145 137.36515045 -4.66086473 137.36935616 10 1

#pip install numpy
import os, sys, gdal, osr, numpy, ast, re
from gdalconst import *

# Make gdal use exceptions instead of their own errors so that they can be caught
gdal.UseExceptions()

def getValueAtBand(b):
    try:
        # Get the band
        band = ds.GetRasterBand(b)
        value = band.ReadAsArray(pixelLatLonPair[0][0], pixelLatLonPair[0][1], 1, 1)[0][0]

        bandName = band.GetDescription()
        if isinstance(bandName, str):
            matchedName = re.findall(r"[-+]?\d*\.\d+|\d+", bandName)
            if len(matchedName) > 0:
                bandName = float(matchedName[0])
            else:
                bandName = b
        else:
            bandName = b
        #check for nan
        if value != value:
            value = None
            bandName = None
        elif value == band.GetNoDataValue():
            value = None
    except Exception as e:
        #print e
        #-1100101 = (e)rror
        value = None
        bandName = None

    return [bandName, value]

# Takes in a [[x,y],[x,y],[x,y],[x,y]...[x,y],[x,y]]
#and returns an array of values on the raster at those points in order
def getRasterDataValues():
    valuesArray = []
    for i in range(0, len(bands)):
        #an int or an array of int
        if(isinstance(bands[i], int)): #if part needs work (safer to pass bands: "[[x,y]]" now)
            value = getValueAtBand(bands[i])
            valuesArray.append(value)
        else:
            # +1 for inclusivity
            for j in range(bands[i][0], bands[i][1] + 1):
                value = getValueAtBand(j)
                valuesArray.append(value)

    return valuesArray

# Takes in a [[lat,lon],[lat,lon]...[lat,lon]]
#and returns [[pixel,pixel][pixel,pixel]...[pixel,pixel]]
#based on the predeclared ds (gdal.open(raster))
def latLonsToPixel(latLonPairs):
    # get georeference info
    transform = ds.GetGeoTransform()
    xOrigin = transform[0]
    yOrigin = transform[3]
    pixelWidth = transform[1]
    pixelHeight = transform[5]
    # Create a spatial reference object for the dataset
    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())
	# Set up the coordinate transformation object
    srsLatLong = srs.CloneGeogCS()
    ct = osr.CoordinateTransformation(srsLatLong,srs)
	# Go through all the point pairs and translate them to latitude/longitude pairings
    pixelPairs = []
    for point in latLonPairs:
        # Change the point locations into the GeoTransform space
        (point[1],point[0],holder) = ct.TransformPoint(point[1],point[0])
        # Translate the x and y coordinates into pixel values
        x = (point[1] - xOrigin) / pixelWidth
        y = (point[0] - yOrigin) / pixelHeight
        # Add the point to our return array
        pixelPairs.append([int(x),int(y)])
    return pixelPairs


# Get arguments
raster = sys.argv[1]
lat = float(sys.argv[2])
lon = float(sys.argv[3])
type = sys.argv[4]
bands = ast.literal_eval(sys.argv[5])

latLonPair = [[lat, lon]]
#raster = '../../../../Missions/MSL/Data/CRISM_Master/frt0000a091_07_if165j_mtr3/frt0000a091_07_if165j_mtr3.img'

# Open the image
ds = gdal.Open(raster, GA_ReadOnly)
if ds is None:
    print "Could not open image"
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

#print valueArray
print valueArray