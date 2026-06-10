# HorizonProfile.py
# Usage: python HorizonProfile.py <raster_path> <lat> <lng> <observer_height> <num_azimuths> <max_radius_m>
#
# Returns JSON: {"horizonProfile": [[azimuth_deg, horizon_elevation_deg], ...]}

import sys
import json
import math
import numpy as np
from osgeo import gdal, osr
from osgeo.gdalconst import GA_ReadOnly
from osgeo import __version__ as osgeoversion

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

gdal.UseExceptions()

NODATA_VALUE = -1100101


def latLonToPixel(ds, lat, lng):
    transform = ds.GetGeoTransform()
    xOrigin = transform[0]
    yOrigin = transform[3]
    pixelWidth = transform[1]
    pixelHeight = transform[5]

    srs = osr.SpatialReference()
    if int(osgeoversion[0]) >= 3:
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.ImportFromWkt(ds.GetProjection())

    srsLatLong = srs.CloneGeogCS()
    ct = osr.CoordinateTransformation(srsLatLong, srs)

    (projX, projY, _) = ct.TransformPoint(lng, lat)
    px = (projX - xOrigin) / pixelWidth
    py = (projY - yOrigin) / pixelHeight

    if math.isinf(px):
        px = 0
    if math.isinf(py):
        py = 0

    return int(px), int(py)


def getPixelScale(ds):
    """Return approximate meters per pixel (average of x and y)."""
    transform = ds.GetGeoTransform()
    pixelWidth = abs(transform[1])
    pixelHeight = abs(transform[5])

    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())

    if srs.IsProjected():
        linear_unit = srs.GetLinearUnits()
        return ((pixelWidth + pixelHeight) / 2.0) * linear_unit
    else:
        mid_lat = transform[3] + (ds.RasterYSize / 2.0) * transform[5]
        deg2m = 111320.0 * math.cos(math.radians(mid_lat))
        return ((pixelWidth + pixelHeight) / 2.0) * deg2m


def _grid_convergence(ds, obs_px, obs_py):
    """Grid convergence (radians) at observer position.

    Only applies to azimuthal projections (stereographic, gnomonic) where
    meridians converge at the pole. For cylindrical projections (Equidistant
    Cylindrical, Mercator, etc.), grid north = geographic north so returns 0.
    Returns 0 for geographic (unprojected) CRS.
    """
    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())
    if not srs.IsProjected():
        return 0.0
    proj_name = (srs.GetAttrValue('PROJECTION', 0) or '').lower()
    is_azimuthal = ('stereo' in proj_name or 'azimuthal' in proj_name
                    or 'gnomonic' in proj_name)
    if not is_azimuthal:
        return 0.0
    gt = ds.GetGeoTransform()
    x = gt[0] + obs_px * gt[1] + obs_py * gt[2]
    y = gt[3] + obs_px * gt[4] + obs_py * gt[5]
    fe = srs.GetProjParm('false_easting', 0.0)
    fn = srs.GetProjParm('false_northing', 0.0)
    lat_origin = srs.GetProjParm('latitude_of_origin', 0.0)
    north_sign = -1.0 if lat_origin > 0 else 1.0
    return math.atan2(x - fe, north_sign * (y - fn))


def computeHorizonProfile(ds, band, obs_px, obs_py, observer_height,
                          num_azimuths, max_radius_m,
                          min_skip_radius_m=0, planet_radius=0):
    pixel_scale = getPixelScale(ds)
    max_radius_px = max_radius_m / pixel_scale if pixel_scale > 0 else 500

    # Per-axis physical scale (m/pixel) for correct march direction & distance.
    # Geographic CRS pixels are non-square: 1° lon < 1° lat at non-zero lat.
    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())
    gt = ds.GetGeoTransform()
    if srs.IsProjected():
        lu = srs.GetLinearUnits()
        px_scale_x = abs(gt[1]) * lu
        px_scale_y = abs(gt[5]) * lu
    else:
        obs_lat = gt[3] + obs_py * gt[5]
        px_scale_x = abs(gt[1]) * 111320.0 * math.cos(math.radians(obs_lat))
        px_scale_y = abs(gt[5]) * 111320.0

    xSize = ds.RasterXSize
    ySize = ds.RasterYSize

    margin = int(math.ceil(max_radius_px)) + 1
    xoff = max(obs_px - margin, 0)
    yoff = max(obs_py - margin, 0)
    xend = min(obs_px + margin + 1, xSize)
    yend = min(obs_py + margin + 1, ySize)
    regionW = xend - xoff
    regionH = yend - yoff

    if regionW <= 0 or regionH <= 0:
        return [[i * (360.0 / num_azimuths), 0.0] for i in range(num_azimuths)]

    region = band.ReadAsArray(xoff, yoff, regionW, regionH)
    if region is None:
        return [[i * (360.0 / num_azimuths), 0.0] for i in range(num_azimuths)]

    noData = band.GetNoDataValue()
    local_obs_x = obs_px - xoff
    local_obs_y = obs_py - yoff

    if local_obs_x < 0 or local_obs_x >= regionW or local_obs_y < 0 or local_obs_y >= regionH:
        return [[i * (360.0 / num_azimuths), 0.0] for i in range(num_azimuths)]

    obs_elev_val = region[local_obs_y, local_obs_x]
    if noData is not None and _isNoData(obs_elev_val, noData):
        obs_elev = 0.0
    else:
        obs_elev = float(obs_elev_val)

    obs_total = obs_elev + observer_height

    # Grid convergence: rotate geographic azimuth → pixel march direction
    convergence = _grid_convergence(ds, obs_px, obs_py)

    step_px = 1.0
    min_skip_px = min_skip_radius_m / pixel_scale if (pixel_scale > 0 and min_skip_radius_m > 0) else 0
    use_curvature = planet_radius > 0
    profile = []

    for ai in range(num_azimuths):
        az_deg = ai * (360.0 / num_azimuths)
        az_rad = math.radians(az_deg) + convergence
        # March direction in pixel space, accounting for non-square pixels
        raw_dx = math.sin(az_rad) / px_scale_x
        raw_dy = -math.cos(az_rad) / px_scale_y
        step_len = math.sqrt(raw_dx * raw_dx + raw_dy * raw_dy)
        if step_len < 1e-12:
            step_len = 1e-12
        dx = raw_dx / step_len
        dy = raw_dy / step_len
        m_per_step = 1.0 / step_len  # physical metres per 1-pixel step

        max_el_angle = -90.0
        r = max(step_px, min_skip_px) if min_skip_px > 0 else step_px
        while r <= max_radius_px:
            sx = local_obs_x + dx * r
            sy = local_obs_y + dy * r
            ix = int(round(sx))
            iy = int(round(sy))

            if ix < 0 or ix >= regionW or iy < 0 or iy >= regionH:
                break

            sample = region[iy, ix]
            if noData is not None and _isNoData(float(sample), noData):
                r += step_px
                continue

            dist_m = r * m_per_step
            if dist_m < 0.001:
                r += step_px
                continue

            terrain_elev = float(sample)
            # Subtract curvature drop so distant terrain dips below flat-earth
            if use_curvature:
                curvature_drop = (dist_m * dist_m) / (2.0 * planet_radius)
                terrain_elev -= curvature_drop

            elev_angle = math.degrees(
                math.atan2(terrain_elev - obs_total, dist_m)
            )
            if elev_angle > max_el_angle:
                max_el_angle = elev_angle

            r += step_px

        profile.append([round(az_deg, 2), round(max_el_angle, 2)])

    return profile


def _isNoData(value, noData):
    noData = float(noData)
    decPlaces = 1
    if abs(noData) > 1000000000:
        decPlaces = 10
    return abs(value) >= abs(noData / decPlaces) and abs(value) <= abs(noData * decPlaces)


if __name__ == '__main__':
    raster_path = unquote(sys.argv[1])
    lat = float(sys.argv[2])
    lng = float(sys.argv[3])
    observer_height = float(sys.argv[4])
    num_azimuths = int(sys.argv[5]) if len(sys.argv) > 5 else 360
    max_radius_m = float(sys.argv[6]) if len(sys.argv) > 6 else 5000.0
    min_skip_radius_m = float(sys.argv[7]) if len(sys.argv) > 7 else 0
    planet_radius = float(sys.argv[8]) if len(sys.argv) > 8 else 0

    ds = gdal.Open(raster_path, GA_ReadOnly)
    if ds is None:
        print(json.dumps({"error": True, "message": "Could not open raster"}))
        sys.exit(1)

    band = ds.GetRasterBand(1)
    obs_px, obs_py = latLonToPixel(ds, lat, lng)

    profile = computeHorizonProfile(
        ds, band, obs_px, obs_py, observer_height, num_azimuths, max_radius_m,
        min_skip_radius_m, planet_radius
    )

    print(json.dumps({"horizonProfile": profile}))
