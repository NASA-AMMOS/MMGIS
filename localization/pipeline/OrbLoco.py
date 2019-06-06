"""
OrbLoco.py
Extracts localization and data product information from PDS-style labels and headers.

Author: Dr. Fred J. Calef III
Version 1.0: 24 Sept 2017
Version 1.0.1: 26 Feb 2019, removed windows path dependency to gdal_polygonize.py on line 135
"""

# Import standard libraries...
import sys
import os
import subprocess

# Extracts PDS label values for key image and mapping parameters
import pdsorb as pds  

# Set up gdal/ogr...
from osgeo import gdal,ogr
gdal.UseExceptions()

# Make sure the file exists...
inFile = sys.argv[1]
if os.path.isfile(inFile):
    pass
else:
    print "The file " + inFile + " does not exist!"
    sys.exit(1)

# Breaks the file name apart...
fileDir = os.path.split(inFile)[0]
fileName = os.path.splitext(os.path.basename(inFile))[0]
fileExt = os.path.splitext(os.path.basename(inFile))[1][1:4]

# Collect image metadata...
if fileExt == "IMG" or fileExt == "LBL":
    pdsLabel = pds.parse(inFile)
    nRows = pds.rows(pdsLabel)
    nCols  = pds.columns(pdsLabel)
    nBands = pds.bands(pdsLabel)
    nBits = pds.bitdepth(pdsLabel)
    pixelType = pds.pixeltype(pdsLabel)
    byteOrder = pds.layout(pdsLabel)
    skipBytes = pds.skipbytes(pdsLabel)
    ulxMap = pds.ulxmap(pdsLabel)
    ulyMap = pds.ulymap(pdsLabel)
    xDim = pds.xydim(pdsLabel)
    yDim = pds.xydim(pdsLabel)
    lblproj = pds.projection(pdsLabel)
    if lblproj == None:
        mapPrj = "(No_Projection)"
    else:
        lblTarget = pds.targetName(pdsLabel)
        lblcrsname = pds.crsname(pdsLabel)
        lblcrstype = pds.crstype(pdsLabel)
        lblclon = pds.clon(pdsLabel)
        lblclat = pds.clat(pdsLabel)
        lblfirstsp = pds.firstsp(pdsLabel)
        lblsecondsp = pds.secondsp(pdsLabel)
        lbllondir = pds.londir(pdsLabel)
        lblreflon = pds.reflon(pdsLabel)
        lblaradius = pds.aradius(pdsLabel)
        lblbradius = pds.bradius(pdsLabel)
        lblcradius = pds.cradius(pdsLabel)
        lblPROJCS = "PROJCS[\"" + str(lblproj) + "\","
        lblGCS = "GEOGCS[\"GCS_" + str(lblTarget) + "\","
        lblDATUM = "DATUM[\"D_" + str(lblTarget) + "\","
        lblSPHEROID = "SPHEROID[\"S_" + str(lblTarget) + "\"," + str(lblaradius*1000) + "," + str(lblaradius/lblbradius) + "]],"
        lblPRIMEM = "PRIMEM[\"" + str(lblTarget) + "\"," + str(lblclon) + "],"
        lbldUNIT = "UNIT[\"Degree,0.0174532925199433]],"
        lblprojection = "PROJECTION[\"" + str(lblproj) + "\"],"
        lblfalseEast = "PARAMETER[\"False_Easting\",0],"
        lblfalseNorth = "PARAMETER[\"False_Northing\",0],"
        lblcentMerid = "PARAMETER[\"Central_Meridian\"," + str(lblclon) + "],"
        lblcentLat = "PARAMETER[\"Latitude_of_Origin\"," + str(lblclat) + "],"
        lblmUNIT = "UNIT[\"METER\",1]]"
        mapPrj = "(" + lblPROJCS + lblGCS + lblDATUM + lblSPHEROID + lblPRIMEM + lbldUNIT + lblprojection + lblfalseEast + lblfalseNorth + lblcentMerid + lblcentLat + lblmUNIT + ")"
        #mapPrj = "(" + str(lblProjection) + "," + str(lblcrsname) + "," + str(lblcrstype) + "," + str(lblfirstsp) + "," + str(lblsecondsp) + "," + str(lbllondir) + "," + str(lblreflon) + "," + str(lblaradius) + "," + str(lblbradius) + "," + str(lblcradius) + ")"
else: # Get metadata from image...
    ds = gdal.Open(sys.argv[1])
    #srs=osr.SpatialReference(wkt=prj)
    nRows = ds.RasterXSize
    nCols = ds.RasterYSize
    nBands = ds.RasterCount
    bitsType = {0 : ['0','unk'], 1 : [8,'BYTE'], 2 : [16, 'UINT'], 3 : [16, 'INT'], 4 : [32,'UINT'], 5 : [32,'INT'], 6 : [32,'FLOAT'], 7 : [64,'FLOAT']}
    nBits = bitsType[ds.GetRasterBand(1).DataType][0]
    pixelType = bitsType[ds.GetRasterBand(1).DataType][1]
    byteOrder = ds.GetMetadata('IMAGE_STRUCTURE')['INTERLEAVE']
    skipBytes = 0
    ulxMap = ds.GetGeoTransform()[0]
    ulyMap = ds.GetGeoTransform()[3]
    xDim = ds.GetGeoTransform()[1]
    yDim = ds.GetGeoTransform()[5]
    mapPrj = "(" + ds.GetProjectionRef() + ")"
    noData = ds.GetRasterBand(1).GetNoDataValue()
    ds = None
#    imageMeta = ds.GetRasterBand(1).GetMetadata()

# Write a GIS-friendly header file (.hdr)...
fileHDR = fileName + ".HDR"
if os.path.isfile(fileHDR):
    os.remove(fileHDR)
print "Making the header file...\n"
hdrFile = open(os.path.join(fileDir, fileHDR), "w")
hdrFile.write("nrows " + str(nRows) + "\n")
hdrFile.write("ncols " + str(nCols) + "\n")
hdrFile.write("nbands " + str(nBands) + "\n")
hdrFile.write("nbits " + str(nBits) + "\n")
hdrFile.write("pixeltype " + str(pixelType) + "\n")
hdrFile.write("byteorder " + str(byteOrder) + "\n")
hdrFile.write("skipbytes " + str(skipBytes) + "\n")
hdrFile.write("ulxmap " + str(ulxMap) + "\n")
hdrFile.write("ulymap " + str(ulyMap) + "\n")
hdrFile.write("xdim " + str(xDim) + "\n")
hdrFile.write("ydim " + str(yDim) + "\n")
hdrFile.close

# Make an image footprint...
# Defines data and nodata areas into alpha channel (band 2)
def initVRT(inras, ndv, outVRT):
    cmd=['gdalwarp', '-srcnodata', str(ndv), '-dstalpha', '-dstnodata', '0', '-of', 'vrt', str(inras), str(outVRT)]
    p = subprocess.Popen(cmd)
    p.wait()
    print "Set nodata area.\n"

# Extracts band 2 (alpha channge) into a separate mask
def maskVRT(inVRT,maskVRT):
    cmd=['gdal_translate', '-b', '2', '-of', 'vrt', str(inVRT), str(maskVRT)]
    p = subprocess.Popen(cmd)
    p.wait()
    print "Masked nodata area.\n"

# Turn the VRT into a vector footprint
def polygonize(maskVRT, inVRT, outFP, typeFP):
    cmd=['gdal_polygonize.py', '-8', '-mask', str(maskVRT), str(inVRT),'-b', '2', '-f', typeFP, str(outFP)]
    print "Making the footprint..."
    p = subprocess.Popen(cmd)
    p.wait()
    print "Made vector footprint.\n"

#fpFilename = fileName + ".json"
fpFilename = fileName + ".shp"
fpType = "ESRI Shapefile"
alphaVRT = os.path.join(fileDir, "initVRT.vrt")
vrtMask = os.path.join(fileDir, "maskVRT.vrt")
fpFile = os.path.join(fileDir, fpFilename)
if os.path.isfile(alphaVRT):
    os.remove(alphaVRT)
if os.path.isfile(vrtMask):
    os.remove(vrtMask)
if os.path.isfile(fpFile):
#    driver = ogr.GetDriverByName("GeoJSON")
    driver = ogr.GetDriverByName(fpType)
    driver.DeleteDataSource(fpFile)

if fileExt != "IMG" and fileExt != "LBL":
    initVRT(inFile, noData, alphaVRT)
    maskVRT(alphaVRT, vrtMask)
    polygonize(vrtMask, alphaVRT, fpFile, fpType)

# Check to see whether input is a USGS-ISIS .hdr file...
#usgsisisHDR = os.path.splitext(os.path.splitext(f)[0])[1]

# Collect and write localization data...
fileLoco = fileName + "_loco.csv"
if os.path.isfile(fileLoco):
    os.remove(fileLoco)
print "Making localization file..."
locoFile = open(os.path.join(fileDir, fileLoco), "w")
locoFile.write("filename,rows,columns,bands,bitdepth,pixeltype,layout,skipbytes,ulxmap,ulymap,xdim,ydim,projection\n")
locoFile.write(str(fileName) + ",")
locoFile.write(str(nRows) + ",")
locoFile.write(str(nCols) + ",")
locoFile.write(str(nBands) + ",")
locoFile.write(str(nBits) + ",")
locoFile.write(str(pixelType) + ",")
locoFile.write(str(byteOrder) + ",")
locoFile.write(str(skipBytes) + ",")
locoFile.write(str(ulxMap) + ",")
locoFile.write(str(ulyMap) + ",")
locoFile.write(str(xDim) + ",")
locoFile.write(str(yDim) + ",")
locoFile.write(str(mapPrj) + "\n") 
locoFile.close
print "Complete.\n"
