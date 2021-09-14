import subprocess
from osgeo import gdal, osr
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter

# Windows
# GDAL2TILE_PATH = 'C:\Python27\Lib\site-packages\osgeo\scripts\gdal2tiles.py'
# Linux
GDAL2TILE_PATH = '/usr/local/bin/gdal2tiles.py'


def parse_args():
    # Parse input arguments
    parser = ArgumentParser(description=__doc__, formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument('input_file', help='Input file')
    parser.add_argument('-o', '--output', help='Output directory')

    args = parser.parse_args()
    return args


def GetExtent(gt, cols, rows):
    ''' Return list of corner coordinates from a geotransform

        @type gt:   C{tuple/list}
        @param gt: geotransform
        @type cols:   C{int}
        @param cols: number of columns in the dataset
        @type rows:   C{int}
        @param rows: number of rows in the dataset
        @rtype:    C{[float,...,float]}
        @return:   coordinates of each corner
    '''
    ext = []
    xarr = [0, cols]
    yarr = [0, rows]

    for px in xarr:
        for py in yarr:
            x = gt[0]+(px*gt[1])+(py*gt[2])
            y = gt[3]+(px*gt[4])+(py*gt[5])
            ext.append([x, y])
        yarr.reverse()
    return ext


def ReprojectCoords(coords, src_srs, tgt_srs):
    ''' Reproject a list of x,y coordinates.

        @type geom:     C{tuple/list}
        @param geom:    List of [[x,y],...[x,y]] coordinates
        @type src_srs:  C{osr.SpatialReference}
        @param src_srs: OSR SpatialReference object
        @type tgt_srs:  C{osr.SpatialReference}
        @param tgt_srs: OSR SpatialReference object
        @rtype:         C{tuple/list}
        @return:        List of transformed [[x,y],...[x,y]] coordinates
    '''
    trans_coords = []
    transform = osr.CoordinateTransformation(src_srs, tgt_srs)
    for x, y in coords:
        x, y, z = transform.TransformPoint(x, y)
        trans_coords.append([x, y])
    return trans_coords


def AutoGdalTranslate(geo_extent, cols, rows, raster):
    gdal_translate = "gdal_translate -of VRT -a_srs EPSG:4326 -gcp 0 0 " + str(geo_extent[0][0]) + " " + str(geo_extent[0][1]) + " -gcp " + str(cols) + " 0 " + str(geo_extent[3][0]) + " " + str(geo_extent[3][1]) + " -gcp " + str(cols) + " " + str(rows) + " " + str(geo_extent[2][0]) + " " + str(geo_extent[2][1]) + " " + raster + " " + raster[:-4] + ".vrt"
    print(gdal_translate)
    subprocess.Popen(gdal_translate, shell=True)


def AutoGdal2Tiles(raster, outputDir):
    if outputDir is None:
        gdal2tiles = "python " + GDAL2TILE_PATH + " -p mercator -a 0,0,0 " + raster[:-4] + ".vrt"
    else:
        gdal2tiles = "python " + GDAL2TILE_PATH + " -p mercator -a 0,0,0 " + raster[:-4] + ".vrt" + " " + outputDir

    print(gdal2tiles)
    subprocess.Popen(gdal2tiles, shell=True)


def tile(raster, outputDir=None):
    ds = gdal.Open(raster)

    # reproject to EPSG:4326 if it's a projection we can't handle downstream
    projection = osr.SpatialReference(wkt=ds.GetProjection()).GetName()
    if projection == "unnamed":
        gdal_warp = "gdalwarp -t_srs EPSG:4326 " + raster + " " + raster[:-4] + "_epsg4326" + raster[-4:]
        print(gdal_warp)
        raster = raster[:-4] + "_epsg4326" + raster[-4:]
    gdal_warp_process = subprocess.Popen(gdal_warp, shell=True)
    gdal_warp_process.wait()
    ds = gdal.Open(raster)

    gt = ds.GetGeoTransform()
    cols = ds.RasterXSize
    rows = ds.RasterYSize
    extent = GetExtent(gt, cols, rows)

    src_srs = osr.SpatialReference()
    src_srs.ImportFromWkt(ds.GetProjection())
    # tgt_srs=osr.SpatialReference()
    # tgt_srs.ImportFromEPSG(4326)
    tgt_srs = src_srs.CloneGeogCS()

    geo_extent = ReprojectCoords(extent, src_srs, tgt_srs)

    AutoGdalTranslate(geo_extent, cols, rows, raster)
    AutoGdal2Tiles(raster, outputDir)


if __name__ == '__main__':
    args = parse_args()
    tile(args.input_file, args.output)
    exit()
