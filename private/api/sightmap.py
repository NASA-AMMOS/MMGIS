# sightmap.py — Per-cell ray-march solar illumination / sightmap computation
#
# Reads JSON from stdin, computes a visibility grid for each cell of the DEM
# by ray-marching toward the Sun (or other SPICE body) and checking if any
# terrain along the path has a higher elevation angle than the source.
#
# Returns JSON:
# {
#   "grid": [[0|1|9, ...], ...],   0=shadow, 1=illuminated, 9=nodata
#   "az": <float>,                  source azimuth at observer (degrees)
#   "el": <float>,                  source elevation at observer (degrees)
#   "rows": <int>,
#   "cols": <int>,
#   "bounds": [west, south, east, north]   geographic degrees
# }

import sys
import json
import math
import os

import numpy as np
from osgeo import gdal, osr
from osgeo.gdalconst import GA_ReadOnly
from osgeo import __version__ as osgeoversion

import spiceypy

# Ensure PROJ can find its data files when running under a conda/mamba env
_prefix = os.path.dirname(os.path.dirname(sys.executable))
_proj_share = os.path.join(_prefix, "share", "proj")
if os.path.isdir(_proj_share) and "PROJ_DATA" not in os.environ:
    os.environ["PROJ_DATA"] = _proj_share

gdal.UseExceptions()

NODATA_SENTINEL = -1100101


# ---------------------------------------------------------------------------
# SPICE helpers
# ---------------------------------------------------------------------------

def load_kernels(package_dir, obs_body, target, is_custom):
    """Load all SPICE kernels, return list of loaded paths."""
    PATH_TO_KERNELS = '../../spice/kernels/'
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


def get_sun_vector_and_azel(lng, lat, height, target, time_str,
                            obs_ref_frame, obs_body):
    """Return (sun_body_vec, az_deg, el_deg) at the observer position."""
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

    # Sun position in body-fixed frame (km)
    state, _ = spiceypy.spkezr(target, et, obs_ref_frame, abcorr, obs_body)
    sun_vec = np.array(state[0:3])  # km, body-fixed

    return sun_vec, az_deg, el_deg, radii, flattening


# ---------------------------------------------------------------------------
# DEM / coordinate helpers
# ---------------------------------------------------------------------------

def open_dem(dem_path):
    """Open DEM and return (ds, band_array, nodata, geotransform, srs)."""
    ds = gdal.Open(dem_path, GA_ReadOnly)
    if ds is None:
        raise RuntimeError("Could not open DEM: " + dem_path)
    band = ds.GetRasterBand(1)
    arr = band.ReadAsArray()
    nodata = band.GetNoDataValue()
    gt = ds.GetGeoTransform()
    srs = osr.SpatialReference()
    if int(osgeoversion[0]) >= 3:
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.ImportFromWkt(ds.GetProjection())
    return ds, arr, nodata, gt, srs


def pixel_to_geo(gt, srs, px, py):
    """Convert pixel (col, row) to geographic (lng, lat) degrees."""
    proj_x = gt[0] + px * gt[1] + py * gt[2]
    proj_y = gt[3] + px * gt[4] + py * gt[5]

    if srs.IsProjected():
        srs_geo = srs.CloneGeogCS()
        ct = osr.CoordinateTransformation(srs, srs_geo)
        lng, lat, _ = ct.TransformPoint(proj_x, proj_y)
    else:
        lng, lat = proj_x, proj_y
    return lng, lat


def geo_to_pixel(gt, srs, lng, lat):
    """Convert geographic (lng, lat) degrees to pixel (col, row) float."""
    if srs.IsProjected():
        srs_geo = srs.CloneGeogCS()
        ct = osr.CoordinateTransformation(srs_geo, srs)
        proj_x, proj_y, _ = ct.TransformPoint(lng, lat)
    else:
        proj_x, proj_y = lng, lat

    # Invert the geotransform
    det = gt[1] * gt[5] - gt[2] * gt[4]
    if abs(det) < 1e-15:
        return 0.0, 0.0
    col = (gt[5] * (proj_x - gt[0]) - gt[2] * (proj_y - gt[3])) / det
    row = (-gt[4] * (proj_x - gt[0]) + gt[1] * (proj_y - gt[3])) / det
    return col, row


def get_pixel_scale(ds, gt, srs):
    """Return approximate meters per pixel."""
    pw = abs(gt[1])
    ph = abs(gt[5])
    if srs.IsProjected():
        linear_unit = srs.GetLinearUnits()
        return ((pw + ph) / 2.0) * linear_unit
    else:
        mid_lat = gt[3] + (ds.RasterYSize / 2.0) * gt[5]
        deg2m = 111320.0 * math.cos(math.radians(mid_lat))
        return ((pw + ph) / 2.0) * deg2m


def is_nodata(value, nodata):
    """Check if a DEM value is nodata."""
    if nodata is not None:
        nd = float(nodata)
        dec = 10 if abs(nd) > 1e9 else 1
        if abs(float(value)) >= abs(nd / dec) and abs(float(value)) <= abs(nd * dec):
            return True
    # Also catch extreme values
    if float(value) > 35000 or float(value) < -35000:
        return True
    if float(value) == 1010101:
        return True
    return False


# ---------------------------------------------------------------------------
# Per-cell Sun az/el via body-fixed Sun vector
# ---------------------------------------------------------------------------

def sun_azel_at_cell(cell_lat, cell_lng, sun_vec_km, radii_km, flattening):
    """
    Compute Sun azimuth and elevation at a surface cell.

    cell_lat, cell_lng: degrees
    sun_vec_km: Sun position in body-fixed frame (km)
    radii_km: [equatorial, equatorial, polar] radii in km
    flattening: (a-c)/a

    Returns (az_deg, el_deg).
    """
    # Cell position on the ellipsoid surface (km)
    cell_pos = np.array(spiceypy.georec(
        cell_lng * spiceypy.rpd(), cell_lat * spiceypy.rpd(),
        0.0, radii_km[0], flattening
    ))

    # Direction from cell to Sun
    to_sun = sun_vec_km - cell_pos
    to_sun_norm = to_sun / np.linalg.norm(to_sun)

    # Surface normal (outward) — for an ellipsoid, the geodetic normal
    # For a sphere approximation: cell_pos / |cell_pos|
    # For the ellipsoid: use the gradient of the ellipsoid equation
    a2 = radii_km[0] ** 2
    c2 = radii_km[2] ** 2
    normal = np.array([cell_pos[0] / a2, cell_pos[1] / a2, cell_pos[2] / c2])
    normal = normal / np.linalg.norm(normal)

    # Elevation = angle above the horizon plane
    sin_el = np.dot(to_sun_norm, normal)
    sin_el = np.clip(sin_el, -1.0, 1.0)
    el_deg = math.degrees(math.asin(sin_el))

    # For azimuth: project to_sun onto the local tangent plane and compute
    # bearing relative to local north
    # Local north = d(pos)/d(lat) direction
    lat_r = cell_lat * spiceypy.rpd()
    lng_r = cell_lng * spiceypy.rpd()
    # North direction in body-fixed (derivative of georec w.r.t. lat)
    north = np.array([
        -radii_km[0] * math.sin(lat_r) * math.cos(lng_r),
        -radii_km[0] * math.sin(lat_r) * math.sin(lng_r),
        radii_km[2] * math.cos(lat_r),
    ])
    # Make it perpendicular to normal and normalise
    north = north - np.dot(north, normal) * normal
    n_len = np.linalg.norm(north)
    if n_len < 1e-12:
        return 0.0, el_deg
    north = north / n_len

    # East = normal × north
    east = np.cross(normal, north)
    east = east / np.linalg.norm(east)

    # Project Sun direction onto tangent plane
    sun_n = np.dot(to_sun_norm, north)
    sun_e = np.dot(to_sun_norm, east)
    az_deg = math.degrees(math.atan2(sun_e, sun_n))
    if az_deg < 0:
        az_deg += 360.0

    return az_deg, el_deg


# ---------------------------------------------------------------------------
# Vectorized helpers (numpy)
# ---------------------------------------------------------------------------

COARSE_AZEL_STEP = 10  # compute Sun az/el every N output cells


def _vectorized_is_nodata(values, nodata):
    """Vectorized equivalent of is_nodata()."""
    mask = np.zeros(values.shape, dtype=bool)
    if nodata is not None:
        nd = float(nodata)
        dec = 10.0 if abs(nd) > 1e9 else 1.0
        abs_vals = np.abs(values)
        mask |= (abs_vals >= abs(nd / dec)) & (abs_vals <= abs(nd * dec))
    mask |= (values > 35000) | (values < -35000)
    mask |= (values == 1010101)
    return mask


def _pixels_to_geo_batch(gt, srs, px_arr, py_arr):
    """Convert 2D arrays of pixel (col, row) to geographic (lng, lat)."""
    proj_x = gt[0] + px_arr * gt[1] + py_arr * gt[2]
    proj_y = gt[3] + px_arr * gt[4] + py_arr * gt[5]
    if srs.IsProjected():
        srs_geo = srs.CloneGeogCS()
        ct = osr.CoordinateTransformation(srs, srs_geo)
        shape = proj_x.shape
        pts = list(zip(proj_x.ravel().tolist(),
                       proj_y.ravel().tolist(),
                       [0.0] * int(proj_x.size)))
        out = np.array(ct.TransformPoints(pts))
        return out[:, 0].reshape(shape), out[:, 1].reshape(shape)
    return proj_x.copy(), proj_y.copy()


def _sun_azel_batch(lat_arr, lng_arr, sun_vec_km, radii_km, flattening):
    """
    Vectorized Sun az/el for 2D arrays of lat/lng (degrees).
    Pure-numpy equivalent of sun_azel_at_cell().
    """
    rpd = math.pi / 180.0
    a, c = float(radii_km[0]), float(radii_km[2])
    e2 = 1.0 - (c / a) ** 2

    lat_r = lat_arr * rpd
    lng_r = lng_arr * rpd
    cos_lat = np.cos(lat_r)
    sin_lat = np.sin(lat_r)
    cos_lng = np.cos(lng_r)
    sin_lng = np.sin(lng_r)

    # Cell position on ellipsoid (km) — vectorized georec
    N = a / np.sqrt(1.0 - e2 * sin_lat ** 2)
    cx = N * cos_lat * cos_lng
    cy = N * cos_lat * sin_lng
    cz = N * (1.0 - e2) * sin_lat

    # Direction from cell to Sun
    tx = sun_vec_km[0] - cx
    ty = sun_vec_km[1] - cy
    tz = sun_vec_km[2] - cz
    t_len = np.maximum(np.sqrt(tx ** 2 + ty ** 2 + tz ** 2), 1e-12)
    tx /= t_len; ty /= t_len; tz /= t_len

    # Surface normal (ellipsoid gradient)
    a2, c2 = a ** 2, c ** 2
    nx = cx / a2; ny = cy / a2; nz = cz / c2
    n_len = np.maximum(np.sqrt(nx ** 2 + ny ** 2 + nz ** 2), 1e-12)
    nx /= n_len; ny /= n_len; nz /= n_len

    # Elevation = arcsin(dot(to_sun, normal))
    sin_el = np.clip(tx * nx + ty * ny + tz * nz, -1.0, 1.0)
    el = np.degrees(np.arcsin(sin_el))

    # North direction in body-fixed — d(georec)/d(lat)
    nnx = -a * sin_lat * cos_lng
    nny = -a * sin_lat * sin_lng
    nnz = c * cos_lat
    # Project onto tangent plane
    dot = nnx * nx + nny * ny + nnz * nz
    nnx -= dot * nx; nny -= dot * ny; nnz -= dot * nz
    nn_len = np.sqrt(nnx ** 2 + nny ** 2 + nnz ** 2)
    safe = nn_len > 1e-12
    nn_len = np.maximum(nn_len, 1e-12)
    nnx /= nn_len; nny /= nn_len; nnz /= nn_len

    # East = normal × north
    ex = ny * nnz - nz * nny
    ey = nz * nnx - nx * nnz
    ez = nx * nny - ny * nnx
    e_len = np.maximum(np.sqrt(ex ** 2 + ey ** 2 + ez ** 2), 1e-12)
    ex /= e_len; ey /= e_len; ez /= e_len

    # Azimuth = atan2(dot(to_sun, east), dot(to_sun, north))
    sun_n = tx * nnx + ty * nny + tz * nnz
    sun_e = tx * ex + ty * ey + tz * ez
    az = np.degrees(np.arctan2(sun_e, sun_n))
    az = np.where(az < 0, az + 360.0, az)
    az = np.where(safe, az, 0.0)

    return az, el


def _bilinear_interp_2d(coarse_data, coarse_rows, coarse_cols,
                         out_rows, out_cols):
    """Pure-numpy 2D bilinear interpolation on a non-uniform coarse grid."""
    fy = np.arange(out_rows, dtype=np.float64)
    fx = np.arange(out_cols, dtype=np.float64)
    cr = coarse_rows.astype(np.float64)
    cc = coarse_cols.astype(np.float64)

    iy = np.clip(np.searchsorted(cr, fy, side='right') - 1, 0, len(cr) - 2)
    ix = np.clip(np.searchsorted(cc, fx, side='right') - 1, 0, len(cc) - 2)

    y0 = cr[iy]; y1 = cr[iy + 1]
    x0 = cc[ix]; x1 = cc[ix + 1]
    ty = np.where(y1 != y0, (fy - y0) / (y1 - y0), 0.0)
    tx = np.where(x1 != x0, (fx - x0) / (x1 - x0), 0.0)

    TY, TX = np.meshgrid(ty, tx, indexing='ij')
    IY, IX = np.meshgrid(iy, ix, indexing='ij')

    v00 = coarse_data[IY, IX]
    v01 = coarse_data[IY, IX + 1]
    v10 = coarse_data[IY + 1, IX]
    v11 = coarse_data[IY + 1, IX + 1]

    return (v00 * (1 - TY) * (1 - TX) + v10 * TY * (1 - TX) +
            v01 * (1 - TY) * TX + v11 * TY * TX)


# ---------------------------------------------------------------------------
# Core sightmap algorithm (vectorized)
# ---------------------------------------------------------------------------

def _ray_march_grid(dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
                    step, out_rows, out_cols, obs_height, sun_vec_km,
                    obs_az, obs_el, radii_km, flattening, planet_radius):
    """
    Vectorized visibility grid: all cells processed simultaneously per march
    step.  Uses a coarse subgrid (#4) for Sun az/el to avoid per-cell SPICE
    calls, and numpy array ops (#1) instead of Python loops.
    """
    result = np.full((out_rows, out_cols), 0, dtype=np.int8)
    march_step = max(2.0, float(step))
    max_march = max(dem_rows, dem_cols) * 1.5

    # Output cell pixel coordinates
    oy_arr = np.arange(out_rows)
    ox_arr = np.arange(out_cols)
    oy_grid, ox_grid = np.meshgrid(oy_arr, ox_arr, indexing='ij')
    py_grid = np.minimum(oy_grid * step, dem_rows - 1).astype(np.float64)
    px_grid = np.minimum(ox_grid * step, dem_cols - 1).astype(np.float64)

    # Sample DEM heights at cell positions
    cell_vals = dem[py_grid.astype(int), px_grid.astype(int)].astype(np.float64)
    nodata_mask = _vectorized_is_nodata(cell_vals, nodata)
    result[nodata_mask] = 9
    cell_heights = cell_vals + obs_height

    # ---- #4: Coarse Sun az/el subgrid with bilinear interpolation ----
    if sun_vec_km is not None:
        cs = COARSE_AZEL_STEP
        c_rows = np.arange(0, out_rows, cs)
        c_cols = np.arange(0, out_cols, cs)
        if c_rows[-1] != out_rows - 1:
            c_rows = np.append(c_rows, out_rows - 1)
        if c_cols[-1] != out_cols - 1:
            c_cols = np.append(c_cols, out_cols - 1)

        cr_g, cc_g = np.meshgrid(c_rows, c_cols, indexing='ij')
        c_py = np.minimum(cr_g * step, dem_rows - 1).astype(np.float64)
        c_px = np.minimum(cc_g * step, dem_cols - 1).astype(np.float64)
        c_lng, c_lat = _pixels_to_geo_batch(gt, srs, c_px, c_py)
        c_az, c_el = _sun_azel_batch(c_lat, c_lng, sun_vec_km, radii_km,
                                      flattening)

        cell_az = _bilinear_interp_2d(c_az, c_rows, c_cols, out_rows, out_cols)
        cell_el = _bilinear_interp_2d(c_el, c_rows, c_cols, out_rows, out_cols)
    else:
        cell_az = np.full((out_rows, out_cols), obs_az)
        cell_el = np.full((out_rows, out_cols), obs_el)

    # Below-horizon → shadow
    below = cell_el <= 0
    result[below & ~nodata_mask] = 0

    # Active mask: not nodata and above horizon
    active = ~nodata_mask & ~below

    # ---- Ray direction per cell (pixel space) ----
    is_proj = bool(srs.IsProjected())
    az_rad = np.radians(cell_az)
    if is_proj:
        dx = np.sin(az_rad)
        dy = np.cos(az_rad) if gt[5] < 0 else -np.cos(az_rad)
    else:
        lng_all, lat_all = _pixels_to_geo_batch(gt, srs, px_grid, py_grid)
        cos_lat = np.maximum(np.cos(np.radians(lat_all)), 0.01)
        dx_geo = np.sin(az_rad) / cos_lat
        dy_geo = np.cos(az_rad)
        if gt[5] < 0:
            dy_geo = -dy_geo
        mag = np.maximum(np.sqrt(dx_geo ** 2 + dy_geo ** 2), 1e-12)
        dx = dx_geo / mag
        dy = dy_geo / mag

    # ---- Vectorized ray march ----
    max_el_ang = np.full((out_rows, out_cols), -90.0)
    still_active = active.copy()

    r = march_step
    while r < max_march and np.any(still_active):
        sx = px_grid + dx * r
        sy = py_grid + dy * r
        ix = np.round(sx).astype(np.intp)
        iy = np.round(sy).astype(np.intp)

        # Out-of-bounds → resolve cell (no more terrain to check)
        oob = still_active & (
            (ix < 0) | (ix >= dem_cols) | (iy < 0) | (iy >= dem_rows))
        result[oob] = np.where(
            cell_el[oob] > max_el_ang[oob], 1, 0).astype(np.int8)
        still_active[oob] = False

        if not np.any(still_active):
            break

        # Sample DEM (clamp indices for safety; inactive cells don't matter)
        ix_s = np.clip(ix, 0, dem_cols - 1)
        iy_s = np.clip(iy, 0, dem_rows - 1)
        sample = dem[iy_s, ix_s].astype(np.float64)
        sample_nd = _vectorized_is_nodata(sample, nodata)

        dist_m = r * pixel_scale
        terrain_h = sample.copy()
        if planet_radius > 0:
            terrain_h -= (dist_m * dist_m) / (2.0 * planet_radius)

        el_angle = np.degrees(np.arctan2(terrain_h - cell_heights, dist_m))

        # Update max elevation angle for active, non-nodata samples
        updatable = still_active & ~sample_nd
        max_el_ang[updatable] = np.maximum(
            max_el_ang[updatable], el_angle[updatable])

        # Terrain blocks Sun → shadow
        blocked = updatable & (max_el_ang >= cell_el)
        result[blocked] = 0
        still_active[blocked] = False

        r += march_step

    # Remaining active cells: illuminated if Sun above max terrain angle
    result[still_active] = np.where(
        cell_el[still_active] > max_el_ang[still_active], 1, 0
    ).astype(np.int8)

    return result, obs_az, obs_el


def compute_sightmap(dem_path, obs_lat, obs_lng, obs_height,
                     target, time_str, obs_ref_frame, obs_body,
                     planet_radius, max_output_dim=400,
                     is_custom='false', custom_az=0, custom_el=0):
    """
    Compute the sightmap grid for a single timestamp.
    """
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
    kernels = load_kernels(package_dir, obs_body, target, is_custom)

    if is_custom == 'true':
        obs_az = float(custom_az)
        obs_el = float(custom_el)
        sun_vec_km = None
        radii_km = spiceypy.bodvrd(obs_body, "RADII", 3)[1]
        flattening = (radii_km[0] - radii_km[2]) / radii_km[0]
    else:
        sun_vec_km, obs_az, obs_el, radii_km, flattening = \
            get_sun_vector_and_azel(
                obs_lng, obs_lat, obs_height, target, time_str,
                obs_ref_frame, obs_body
            )

    for k in kernels:
        spiceypy.unload(os.path.join(package_dir, k))

    ds, dem, nodata, gt, srs = open_dem(dem_path)
    dem_rows, dem_cols = dem.shape
    pixel_scale = get_pixel_scale(ds, gt, srs)
    step = max(1, max(dem_rows, dem_cols) // max_output_dim)
    out_rows = (dem_rows + step - 1) // step
    out_cols = (dem_cols + step - 1) // step

    result, obs_az, obs_el = _ray_march_grid(
        dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
        step, out_rows, out_cols, obs_height, sun_vec_km,
        obs_az, obs_el, radii_km, flattening, planet_radius
    )

    bounds_info = _compute_bounds(ds, gt, srs, dem_rows, dem_cols)
    ds = None

    return {
        "grid": result.tolist(),
        "az": round(obs_az, 4),
        "el": round(obs_el, 4),
        "rows": out_rows,
        "cols": out_cols,
        **bounds_info,
    }


def compute_sightmap_batch(dem_path, obs_lat, obs_lng, obs_height,
                           target, times, obs_ref_frame, obs_body,
                           planet_radius, max_output_dim=400,
                           is_custom='false', custom_az=0, custom_el=0):
    """
    Compute sightmap grids for multiple timestamps in one call.
    The DEM and SPICE kernels are loaded once and reused.
    Returns a list of result dicts (one per timestamp).
    """
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
    kernels = load_kernels(package_dir, obs_body, target, is_custom)

    radii_km = spiceypy.bodvrd(obs_body, "RADII", 3)[1]
    flattening = (radii_km[0] - radii_km[2]) / radii_km[0]

    # Pre-compute SPICE positions for all timestamps (kernels loaded once)
    time_positions = []
    for t_str in times:
        if is_custom == 'true':
            time_positions.append({
                'sun_vec_km': None,
                'obs_az': float(custom_az),
                'obs_el': float(custom_el),
            })
        else:
            sun_vec_km, obs_az, obs_el, _, _ = get_sun_vector_and_azel(
                obs_lng, obs_lat, obs_height, target, t_str,
                obs_ref_frame, obs_body
            )
            time_positions.append({
                'sun_vec_km': sun_vec_km,
                'obs_az': obs_az,
                'obs_el': obs_el,
            })

    for k in kernels:
        spiceypy.unload(os.path.join(package_dir, k))

    # Open DEM once
    ds, dem, nodata, gt, srs = open_dem(dem_path)
    dem_rows, dem_cols = dem.shape
    pixel_scale = get_pixel_scale(ds, gt, srs)
    step = max(1, max(dem_rows, dem_cols) // max_output_dim)
    out_rows = (dem_rows + step - 1) // step
    out_cols = (dem_cols + step - 1) // step
    bounds_info = _compute_bounds(ds, gt, srs, dem_rows, dem_cols)

    # Compute grid for each timestamp
    results = []
    for i, tp in enumerate(time_positions):
        grid, az, el = _ray_march_grid(
            dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
            step, out_rows, out_cols, obs_height, tp['sun_vec_km'],
            tp['obs_az'], tp['obs_el'], radii_km, flattening, planet_radius
        )
        results.append({
            "grid": grid.tolist(),
            "az": round(az, 4),
            "el": round(el, 4),
            "rows": out_rows,
            "cols": out_cols,
            **bounds_info,
        })
        # Print progress to stderr for the caller to track
        sys.stderr.write(json.dumps({"progress": i + 1, "total": len(times)}) + "\n")
        sys.stderr.flush()

    ds = None
    return results


def _compute_bounds(ds, gt, srs, dem_rows, dem_cols):
    """Compute geographic and projected bounds from a DEM dataset."""
    is_projected = bool(srs.IsProjected())
    bounds_proj = None
    if is_projected:
        proj_x_min = gt[0]
        proj_y_max = gt[3]
        proj_x_max = gt[0] + gt[1] * dem_cols
        proj_y_min = gt[3] + gt[5] * dem_rows
        bounds_proj = [proj_x_min, proj_y_min, proj_x_max, proj_y_max]

    west, north = pixel_to_geo(gt, srs, 0, 0)
    east, south = pixel_to_geo(gt, srs, dem_cols - 1, dem_rows - 1)
    if west > east:
        west, east = east, west
    if south > north:
        south, north = north, south

    return {
        "bounds": [round(west, 6), round(south, 6),
                   round(east, 6), round(north, 6)],
        "projBounds": [round(v, 2) for v in bounds_proj] if bounds_proj else None,
        "isProjected": is_projected,
    }


# ---------------------------------------------------------------------------
# Entry point — reads JSON from stdin
# ---------------------------------------------------------------------------

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
        max_output_dim = int(input_data.get('maxOutputDim', 400))
        is_custom = input_data.get('isCustom', 'false')
        custom_az = float(input_data.get('customAz', 0))
        custom_el = float(input_data.get('customEl', 0))

        # Batch mode: multiple timestamps in one call
        times = input_data.get('times', None)
        if times and isinstance(times, list) and len(times) > 0:
            result = compute_sightmap_batch(
                dem_path, obs_lat, obs_lng, obs_height,
                target, times, obs_ref_frame, obs_body,
                planet_radius, max_output_dim,
                is_custom, custom_az, custom_el,
            )
        else:
            time_str = input_data['time']
            result = compute_sightmap(
                dem_path, obs_lat, obs_lng, obs_height,
                target, time_str, obs_ref_frame, obs_body,
                planet_radius, max_output_dim,
                is_custom, custom_az, custom_el,
            )
        print(json.dumps(result))
    except Exception:
        import traceback
        print(json.dumps({
            "error": True,
            "message": "sightmap error: " + str(sys.exc_info()[1]),
            "traceback": traceback.format_exc(),
        }))
        sys.exit(1)
