# visibility.py
#
# ============================================================================
# ALGORITHM DOCUMENTATION
# ============================================================================
#
# Overview
# --------
# Computes, for a batch of timestamps, whether a distant source (Sun or any
# SPICE-trackable body, or a custom azimuth/elevation) is visible above the
# local terrain horizon from a single observer point on a DEM.
#
# Unlike the sightmap (which produces a full grid at a viewport-dependent,
# down-sampled resolution and derives the observer's visibility from the
# grid cell under the observer), this script answers the inherently
# one-point / one-direction question directly:
#
#   "At this timestep, is the source above the local horizon in the
#    source's azimuth direction?"
#
# It does so with a single ray-march at the DEM's *native* resolution
# (no viewport-driven decimation), so the answer is zoom- and
# viewport-independent.
#
# Method
# ------
# 1. Load SPICE kernels and open the DEM once.  Read a native-resolution
#    window around the observer (bounded by max_radius and a memory cap).
# 2. For each timestamp compute the source azimuth/elevation at the observer
#    via spiceypy.azlcpo (or use the supplied custom az/el).
# 3. March a single ray at the DEM's native resolution along the source
#    azimuth, tracking the maximum terrain elevation angle (the local
#    horizon altitude in that direction).  Uses the same logarithmic
#    stepping + early-termination as HorizonProfile.py.
# 4. The source is visible when its elevation exceeds both 0 and the local
#    horizon altitude in its azimuth direction.
#
# I/O
# ---
# Reads JSON from stdin, writes a single JSON object to stdout:
# {
#   "results": [
#     {"time": <iso>, "az": <deg>, "el": <deg>,
#      "horizonAngle": <deg>, "visible": <bool>},
#     ...
#   ]
# }
# ============================================================================

import sys
import json
import math
import os

import numpy as np
from osgeo import gdal, osr
from osgeo.gdalconst import GA_ReadOnly
from osgeo import __version__ as osgeoversion

import spiceypy

gdal.UseExceptions()

# Cap the native window read around the observer so a huge max_radius on a
# fine DEM can't blow up memory.  Terrain beyond this radius is not considered
# (the early-termination usually stops the march well before it anyway).
MAX_WINDOW_RADIUS_PX = 3000
MAX_TERRAIN_RELIEF = 10000.0  # conservative upper bound on terrain height (m)


def load_kernels(package_dir, obs_body, target, is_custom):
    """Load all SPICE kernels, return list of loaded paths."""
    PATH_TO_KERNELS = '../../../../../spice/kernels/'
    kernels = []

    for subdir in [
        PATH_TO_KERNELS,
        PATH_TO_KERNELS + obs_body + '/',
    ]:
        try:
            full = os.path.join(package_dir, subdir)
            for f in os.listdir(full):
                if f.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                    kernels.append(subdir + f)
        except Exception:
            pass

    if is_custom != 'true':
        try:
            subdir = PATH_TO_KERNELS + obs_body + '/' + target + '/'
            full = os.path.join(package_dir, subdir)
            for f in os.listdir(full):
                if f.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                    kernels.append(subdir + f)
        except Exception:
            pass

    for k in kernels:
        spiceypy.furnsh(os.path.join(package_dir, k))
    return kernels


def get_obs_azel(lng, lat, height, target, time_str, obs_ref_frame, obs_body):
    """Return (az_deg, el_deg) of the source at the observer position."""
    method = "ELLIPSOID"
    abcorr = "NONE"
    azccw = False
    elplsz = True

    radii = spiceypy.bodvrd(obs_body, "RADII", 3)[1]
    flattening = (radii[0] - radii[2]) / radii[0]

    et = spiceypy.str2et(time_str)
    obspos = spiceypy.georec(
        lng * spiceypy.rpd(), lat * spiceypy.rpd(),
        height / 1000.0, radii[0], flattening
    )
    output = spiceypy.azlcpo(
        method, target, et, abcorr, azccw, elplsz,
        obspos, obs_body, obs_ref_frame
    )
    razel = output[0]
    az_deg = razel[1] * spiceypy.dpr()
    el_deg = razel[2] * spiceypy.dpr()
    return az_deg, el_deg


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
    """Grid convergence (radians) at the observer for azimuthal projections."""
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


def _isNoData(value, noData):
    noData = float(noData)
    decPlaces = 1
    if abs(noData) > 1000000000:
        decPlaces = 10
    return abs(value) >= abs(noData / decPlaces) and abs(value) <= abs(noData * decPlaces)


def horizon_angle_for_azimuth(region, local_obs_x, local_obs_y, obs_total,
                              az_deg, convergence, px_scale_x, px_scale_y,
                              pixel_scale, max_radius_px, min_skip_px,
                              planet_radius, no_data):
    """Max terrain elevation angle (deg) along a single native-res ray."""
    regionH, regionW = region.shape
    az_rad = math.radians(az_deg) + convergence
    raw_dx = math.sin(az_rad) / px_scale_x
    raw_dy = -math.cos(az_rad) / px_scale_y
    step_len = math.sqrt(raw_dx * raw_dx + raw_dy * raw_dy)
    if step_len < 1e-12:
        step_len = 1e-12
    dx = raw_dx / step_len
    dy = raw_dy / step_len
    m_per_step = 1.0 / step_len

    use_curvature = planet_radius > 0
    max_el_angle = -90.0
    step_px = 1.0
    r = max(step_px, min_skip_px) if min_skip_px > 0 else step_px

    while r <= max_radius_px:
        sx = local_obs_x + dx * r
        sy = local_obs_y + dy * r
        ix = int(round(sx))
        iy = int(round(sy))

        if ix < 0 or ix >= regionW or iy < 0 or iy >= regionH:
            break

        sample = float(region[iy, ix])
        if no_data is not None and _isNoData(sample, no_data):
            r += max(1.0, math.log2(r + 1))
            continue

        dist_m = r * m_per_step
        if dist_m < 0.001:
            r += max(1.0, math.log2(r + 1))
            continue

        terrain_elev = sample
        if use_curvature:
            terrain_elev -= (dist_m * dist_m) / (2.0 * planet_radius)

        elev_angle = math.degrees(math.atan2(terrain_elev - obs_total, dist_m))
        if elev_angle > max_el_angle:
            max_el_angle = elev_angle

        # Early termination: if even the tallest possible peak at this
        # distance (after curvature) can't beat current max, stop marching.
        if max_el_angle > -90.0 and dist_m > 1000.0:
            best_possible_elev = MAX_TERRAIN_RELIEF
            if use_curvature:
                best_possible_elev -= (dist_m * dist_m) / (2.0 * planet_radius)
            best_possible_angle = math.degrees(
                math.atan2(best_possible_elev - obs_total, dist_m)
            )
            if best_possible_angle <= max_el_angle:
                break

        r += max(1.0, math.log2(r + 1))

    return max_el_angle


def compute_visibility_batch(dem_path, obs_lat, obs_lng, obs_height,
                             target, times_spice, times_iso,
                             obs_ref_frame, obs_body, planet_radius,
                             max_radius_m, min_skip_radius_m,
                             is_custom, custom_az, custom_el):
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
    load_kernels(package_dir, obs_body, target, is_custom)

    ds = gdal.Open(dem_path, GA_ReadOnly)
    if ds is None:
        raise RuntimeError("Could not open DEM: " + dem_path)
    band = ds.GetRasterBand(1)
    no_data = band.GetNoDataValue()

    obs_px, obs_py = latLonToPixel(ds, obs_lat, obs_lng)
    pixel_scale = getPixelScale(ds)
    if pixel_scale <= 0:
        pixel_scale = 1.0

    # Per-axis physical scale (m/pixel) for correct march direction & distance.
    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())
    gt = ds.GetGeoTransform()
    if srs.IsProjected():
        lu = srs.GetLinearUnits()
        px_scale_x = abs(gt[1]) * lu
        px_scale_y = abs(gt[5]) * lu
    else:
        px_scale_x = abs(gt[1]) * 111320.0 * math.cos(math.radians(obs_lat))
        px_scale_y = abs(gt[5]) * 111320.0

    # Native-resolution window around the observer, bounded by max_radius
    # and a hard memory cap.
    max_radius_px = max_radius_m / pixel_scale if pixel_scale > 0 else 500
    margin = int(math.ceil(min(max_radius_px, MAX_WINDOW_RADIUS_PX))) + 1

    xSize = ds.RasterXSize
    ySize = ds.RasterYSize
    xoff = max(obs_px - margin, 0)
    yoff = max(obs_py - margin, 0)
    xend = min(obs_px + margin + 1, xSize)
    yend = min(obs_py + margin + 1, ySize)
    regionW = xend - xoff
    regionH = yend - yoff

    convergence = _grid_convergence(ds, obs_px, obs_py)
    # The effective marching radius is limited by the window we read.
    eff_max_radius_px = min(max_radius_px, float(margin))
    min_skip_px = (min_skip_radius_m / pixel_scale
                   if (pixel_scale > 0 and min_skip_radius_m > 0) else 0)

    region = None
    obs_total = obs_height
    if regionW > 0 and regionH > 0:
        region = band.ReadAsArray(xoff, yoff, regionW, regionH)
    local_obs_x = obs_px - xoff
    local_obs_y = obs_py - yoff

    have_region = (region is not None and
                   0 <= local_obs_x < regionW and 0 <= local_obs_y < regionH)
    if have_region:
        obs_elev_val = float(region[local_obs_y, local_obs_x])
        if no_data is not None and _isNoData(obs_elev_val, no_data):
            obs_elev = 0.0
        else:
            obs_elev = obs_elev_val
        obs_total = obs_elev + obs_height

    results = []
    for i, t_spice in enumerate(times_spice):
        if is_custom == 'true':
            az_deg = float(custom_az)
            el_deg = float(custom_el)
        else:
            az_deg, el_deg = get_obs_azel(
                obs_lng, obs_lat, obs_height, target, t_spice,
                obs_ref_frame, obs_body)

        if have_region:
            horizon_angle = horizon_angle_for_azimuth(
                region, local_obs_x, local_obs_y, obs_total,
                az_deg, convergence, px_scale_x, px_scale_y,
                pixel_scale, eff_max_radius_px, min_skip_px,
                planet_radius, no_data)
        else:
            horizon_angle = -90.0

        visible = bool(el_deg > 0.0 and el_deg > horizon_angle)
        results.append({
            "time": times_iso[i],
            "az": round(az_deg, 4),
            "el": round(el_deg, 4),
            "horizonAngle": round(horizon_angle, 4),
            "visible": visible,
        })

    return {"results": results}


if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())

        dem_path = input_data['dem']
        obs_lat = float(input_data['lat'])
        obs_lng = float(input_data['lng'])
        obs_height = float(input_data.get('height', 0))
        target = input_data['target']
        obs_ref_frame = input_data.get('obsRefFrame', 'IAU_MOON')
        obs_body = input_data.get('obsBody', 'MOON')
        planet_radius = float(input_data.get('planetRadius', 0))
        max_radius_m = float(input_data.get('maxRadius', 500000))
        min_skip_radius_m = float(input_data.get('minSkipRadius', 0))
        is_custom = input_data.get('isCustom', 'false')
        custom_az = float(input_data.get('customAz', 0))
        custom_el = float(input_data.get('customEl', 0))

        from datetime import datetime, timedelta
        start_time = input_data['startTime']
        end_time = input_data['endTime']
        step_seconds = float(input_data['stepSeconds'])

        st = str(start_time).replace('Z', '+00:00')
        et = str(end_time).replace('Z', '+00:00')
        dt_start = datetime.fromisoformat(st)
        dt_end = datetime.fromisoformat(et)
        step_td = timedelta(seconds=step_seconds)

        times_spice = []
        times_iso = []
        dt = dt_start
        while dt <= dt_end:
            # Keep sub-second precision so high sampling rates (fine step < 1s)
            # don't collapse consecutive samples to the same timestamp.
            ms = dt.microsecond // 1000
            base = dt.strftime('%Y-%m-%d %H:%M:%S')
            base_iso = dt.strftime('%Y-%m-%dT%H:%M:%S')
            if ms:
                times_spice.append('%s.%03d UTC' % (base, ms))
                times_iso.append('%s.%03dZ' % (base_iso, ms))
            else:
                times_spice.append(base + ' UTC')
                times_iso.append(base_iso + 'Z')
            dt += step_td

        result = compute_visibility_batch(
            dem_path, obs_lat, obs_lng, obs_height,
            target, times_spice, times_iso,
            obs_ref_frame, obs_body, planet_radius,
            max_radius_m, min_skip_radius_m,
            is_custom, custom_az, custom_el,
        )
        print(json.dumps(result))

    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "error": True,
            "message": str(sys.exc_info()[1]),
        }))
