import sys
import os
import subprocess

def GeoJSONtoPoly(injson,outshp):
    ogr2poly="ogr2ogr -nlt POLYGON -skipfailures " + str(outshp) + " " + str(injson) + " OGRGeoJSON"
    subprocess.Popen(ogr2poly)

def noemptyPoly(inshp,outshp):
    ogrselect="ogr2ogr -where "name <> ''" " + str(outshp) + " " + str(inshp) + ""
    subprocess.Popen(ogrselect)
	
def defineGCS(projfile,inshp,outshp):
    makegeo="ogr2ogr -a_srs " + str(projfile) + " " + str(outshp) + " " + str(inshp)
    subprocess.Popen(makegeo)

def projectShapefile(projfile,inshp,outshp):
    projShp="ogr2ogr -t_srs ESRI::" + str(projfile) + " -f "ESRI Shapefile" " + str(outshp) + " " + str(inshp)
    subprocess.Popen(projShp)
	
def rasterizeLabels(inshp,outraster):
    shp2ras="gdal_rasterize -tr 0.25 0.25 -init 255 -ot Byte -a descriptio -l " + shapefilelayername + " " + str(inshp) + " " + str(outraster)
    subprocess.Popen(shp2ras)

def rasSmall(inras,outras):
    smallRas="gdal_translate -a_nodata 255 -co COMPRESS=LZW " + str(inras) + " " + str(outras)
    subprocess.Popen(smallRas)
