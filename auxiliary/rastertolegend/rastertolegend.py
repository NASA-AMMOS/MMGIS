import os
import sys
import subprocess
from osgeo import gdal,ogr,osr

raster = sys.argv[1]
splitfilenameR = os.path.splitext(raster)
colorfile = sys.argv[2]
splitfilenameC = os.path.splitext(colorfile)
discrete = ""
values = []

if len(sys.argv) > 3:
    discrete = sys.argv[3]

#
def colorRelief(raster, colorfile, discrete):
    exactOrNearest = ""
    if discrete == "-discrete":
        exactOrNearest = "-nearest_color_entry"
    gdalDEMcr= "gdaldem color-relief " + exactOrNearest + " " + raster + " " + colorfile + " " + splitfilenameR[0] + "_" + splitfilenameC[0] + splitfilenameR[1]
    subprocess.Popen(gdalDEMcr)

def colorToLegend(colorfile, min, max, discrete):
    legend = open(splitfilenameR[0] + "_" + splitfilenameC[0] + "_legend.csv", "w")
    legend.write("color,strokecolor,shape,value")
    cf = open(colorfile)

    percents = False

    for line in cf:
        split = line.split(" ", 1)
        value = split[0]
        if value[-1:] == "%":
            value = split[0][:-1]
            percents = True
        if value.lower() != "nv":
            values.append(float(value))

    cf.close()
    cf = open(colorfile)
    highToLow = True
    if values[0] < values[1]:
        highToLow = False

    if discrete == "-discrete":
        if percents:
            j = 0
            for v in values:
                values[j] = int(mapPercent(float(v)/100, min, max))
                j += 1
        i = 0
        for line in cf:
            if i > 0 and i < len(values) - 1:
                value = str(values[i] - ((values[i] - values[i-1])/2)) + " - " + str(values[i] + ((values[i+1] - values[i])/2))
            elif i == 0:
                sign = str(int(min)) + " - "
                if not percents:
                    sign = "< "
                if highToLow:
                    sign = str(int(max)) + " - "
                    if not percents:
                        sign = "> "
                value = sign + str((values[i+1] + values[i])/2)
            elif i == len(values) - 1:
                sign = " - " + str(int(max))
                if not percents:
                    sign = "> "
                if highToLow:
                    sign = " - " + str(int(min))
                    if not percents:
                        sign = "< "
                value = str((values[i] + values[i-1])/2) + sign
                if not percents:
                    value = sign + str((values[i] + values[i-1])/2)
            split = line.split(" ", 1)
            if split[0].lower() != "nv":
                legend.write("\n" + rgb_to_hex(tuple(map(int, split[1].split()))) + ",black,square," + value)
            i += 1
    else:
        for line in cf:
            split = line.split(" ", 1)
            value = split[0]
            if value[-1:] == "%":
                value = split[0][:-1]
            if split[0].lower() != "nv":
                legend.write("\n" + rgb_to_hex(tuple(map(int, split[1].split()))) + ",black,square," + str(int(mapPercent(float(value)/100, min, max))))
    legend.close()
    cf.close()

#helper functions
def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % rgb
def mapPercent(p, min, max):
    return ((max - min) * p) + min


r = gdal.Open(raster)
#stats[0] is min, stats[1] is max
stats = r.GetRasterBand(1).GetStatistics(1, 1)

colorRelief(raster, colorfile, discrete)
colorToLegend(colorfile, stats[0], stats[1], discrete)