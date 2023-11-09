import sys
from osgeo import osr
try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

srs_def = unquote(sys.argv[1])

proj = osr.SpatialReference()
proj.ImportFromProj4(srs_def)
print(proj.ExportToWkt())