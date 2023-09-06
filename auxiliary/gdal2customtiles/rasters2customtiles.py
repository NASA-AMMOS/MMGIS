import sys
import subprocess
import optparse
from osgeo import gdal, osr


def optparse_init() -> optparse.OptionParser:
    """Prepare the option parser for input (argv)"""

    usage = "Usage: %prog [options] input_file [output]"
    p = optparse.OptionParser(usage)
    p.add_option(
        "--dem",
        action="store_true",
        dest="isDEMtile",
        help="Indicate if the input is a Digital Elevation Model"
    )
    p.add_option(
        "--processes",
        dest="processes",
        type="int",
        help="Number of processes to use for tiling",
    )
    p.add_option(
        "--tilesize",
        dest="tilesize",
        metavar="PIXELS",
        type="int",
        help="Width and height in pixel of a tile. Defaults to 256 (or 32 for --dem)",
    )
    p.add_option(
        "-z",
        "--zoom",
        dest="zoom",
        help="Zoom levels to render (format:'2-5', '10-' or '10').",
    )
    p.add_option(
        "-e",
        "--resume",
        dest="resume",
        action="store_true",
        help="Resume mode. Generate only missing files.",
    )
    p.add_option(
        "-a",
        "--srcnodata",
        dest="srcnodata",
        metavar="NODATA",
        help="Value in the input dataset considered as transparent",
    )
    return p


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
    gdal_translate = "gdal_translate -of VRT -a_srs EPSG:4326 -gcp 0 0 " + str(geo_extent[0][0]) + " " + str(geo_extent[0][1]) + " -gcp " + str(cols) + " 0 " + str(geo_extent[3][0]) + " " + str(
        geo_extent[3][1]) + " -gcp " + str(cols) + " " + str(rows) + " " + str(geo_extent[2][0]) + " " + str(geo_extent[2][1]) + " " + raster + " " + raster[:-4] + ".vrt"
    print(f"Running: {gdal_translate}\n")
    subprocess.Popen(gdal_translate)


def AutoGdal2Tiles(raster, options, outputdir):
    dem = ""
    if options.isDEMtile is True:
        dem = " --dem"
    processes = ""
    if options.processes is not None:
        processes = f" --processes={options.processes}"
    tilesize = ""
    if options.tilesize is not None:
        tilesize = f" --tilesize={options.tilesize}"
    zoom = ""
    if options.zoom is not None:
        zoom = f" --zoom={options.zoom}"
    resume = ""
    if options.resume is True:
        resume = " --resume"
    srcnodata = " --srcnodata=0,0,0"
    if options.srcnodata is not None:
        srcnodata = f" --srcnodata={options.srcnodata}"
    output = ""
    if outputdir is not None:
        output = f" {outputdir}"
    gdal2tiles = f"python gdal2customtiles.py -n{dem}{processes}{tilesize}{zoom}{resume}{srcnodata} {raster[:-4]}.vrt{output}"
    print(f"Running: {gdal2tiles}\n")
    subprocess.Popen(gdal2tiles)


parser = optparse_init()
options, args = parser.parse_args(args=sys.argv)

raster = args[1]
ds = gdal.Open(raster)

gt = ds.GetGeoTransform()
cols = ds.RasterXSize
rows = ds.RasterYSize
extent = GetExtent(gt, cols, rows)

src_srs = osr.SpatialReference()
src_srs.ImportFromWkt(ds.GetProjection())
tgt_srs = src_srs.CloneGeogCS()

geo_extent = ReprojectCoords(extent, src_srs, tgt_srs)

AutoGdalTranslate(geo_extent, cols, rows, raster)
AutoGdal2Tiles(raster, options, args[2])
