#use like: 2ptsToProfile.py raster lat1 lon1 lat2 lon2 steps band

#returns an array of band value for step between (inclusive) [lat1, lon1] and [lat2, lon2]

#example: 2ptsToProfile.py MSL_DEM_v3_webgis.tif -4.66086473 137.36935616 -4.67053145 137.36515045 10 1
#2ptsToProfile.py MSL_DEM_v3_webgis.tif -4.67053145 137.36515045 -4.66086473 137.36935616 10 1

#pip install numpy
import os, sys, gdal, osr, numpy
from gdalconst import *

# Make gdal use exceptions instead of their own errors so that they can be caught
gdal.UseExceptions()

# Takes in a [[x,y],[x,y],[x,y],[x,y]...[x,y],[x,y]]
#and returns an array of values on the raster at those points in order
def getRasterDataValues(pointArray):
    valuesArray = []
    for i in range(0, len(pointArray)):
        try:
            value = band.ReadAsArray(pointArray[i][0], pointArray[i][1], 1, 1)[0][0]
        except:
            #-1100101 = (e)rror
            value = -1100101

        noData = band.GetNoDataValue()
        if noData is not None:
            noData = float(band.GetNoDataValue())
            decPlaces = 1
            if abs(noData) > 1000000000:
                decPlaces = 10
            if abs(value) >= abs( noData / decPlaces ) and abs(value) <= abs( noData * decPlaces ):
                value = -1100101
        valuesArray.append(value)
    return valuesArray

# Takes in a [[x,y],[x,y],[x,y],[x,y]...[x,y],[x,y]]
#and returns an array of values on the raster OF those points in order
def getRasterDataCoords(pointArray):
    coordsArray = []
    for i in range(0, len(pointArray)):
        try:
            valueX = bandX.ReadAsArray(pointArray[i][0], pointArray[i][1], 1, 1)[0][0]
            valueY = bandY.ReadAsArray(pointArray[i][0], pointArray[i][1], 1, 1)[0][0]
        except:
            #-1100101 = (e)rror
            valueX = -1100101
            valueY = -1100101

        noDataX = bandX.GetNoDataValue()
        if noDataX is not None:
            noDataX = float(bandX.GetNoDataValue())
            decPlaces = 1
            if abs(noDataX) > 1000000000:
                decPlaces = 10
            if abs(valueX) >= abs( noDataX / decPlaces ) and abs(valueX) <= abs( noDataX * decPlaces ):
                valueX = -1100101

        noDataY = bandY.GetNoDataValue()
        if noDataY is not None:
            noDataY = float(bandY.GetNoDataValue())
            decPlaces = 1
            if abs(noDataY) > 1000000000:
                decPlaces = 10
            if abs(valueY) >= abs( noDataY / decPlaces ) and abs(valueY) <= abs( noDataY * decPlaces ):
                valueY = -1100101

        coordsArray.append([valueX, valueY])

    return coordsArray

# Takes in a [[x1,y1],[x2,y2]]
#and returns [[x1,y1] + (steps - 2) interpolated pairs + [x2,y2]]
def getInterpolatedArray(endPairs, steps):
    interpolatedArray = []
    # Subtracting 1 from steps so the final point is included in the total steps
    # i.e. number of edges = number of verticies - 1
    steps = steps - 1
    xDif = endPairs[0][0] - endPairs[1][0]
    yDif = endPairs[0][1] - endPairs[1][1]
    xStep = xDif / steps
    yStep = yDif / steps
    for i in reversed(range(0, steps + 1)):
        x = endPairs[1][0] + (xStep * i)
        y = endPairs[1][1] + (yStep * i)
        interpolatedArray.append([x, y])
    return interpolatedArray

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
lat1 = float(sys.argv[2])
lon1 = float(sys.argv[3])
lat2 = float(sys.argv[4])
lon2 = float(sys.argv[5])
steps = int(sys.argv[6])
axes = sys.argv[7]
band = int(sys.argv[8])

latLonEndPairs = [[lat1, lon1],[lat2, lon2]]

# Open the image
ds = gdal.Open(raster, GA_ReadOnly)
if ds is None:
    print "Could not open image"
    sys.exit(1)

# Get the band
if axes == 'xyz':
    try:
        band = ds.GetRasterBand(3)
        bandX = ds.GetRasterBand(1)
        bandY = ds.GetRasterBand(2)
    except:
        print "Failed to get bands 1, 2 and 3"
        sys.exit(1)
else:
    band = ds.GetRasterBand(band)

# Note: converting to pixels first and then interpolating in less accurate
# Interpolate between those latlons
latLonArray = getInterpolatedArray(latLonEndPairs, steps)

# Deep Copy the list
latLonElevArray = [x[:] for x in latLonArray]

# Convert ends to image space pixels
pixelLatLonEndPairs = latLonsToPixel(latLonArray)

# Find the raster value at each of those points
elevArray = getRasterDataValues(pixelLatLonEndPairs)

# Don't use the regular lat lon from the extent of the two points,
# actually capture it from the image. Not all dems have gravity down
if axes == 'xyz':
    latLonElevArray = getRasterDataCoords(pixelLatLonEndPairs)

# Come latlon with elevs and print
for i in range(0, len(latLonElevArray)):
    latLonElevArray[i].append( elevArray[i] )

print latLonElevArray