# sightmap.py — Per-cell ray-march solar illumination / sightmap computation
#
# ============================================================================
# ALGORITHM DOCUMENTATION
# ============================================================================
#
# Overview
# --------
# Determines cast-shadow visibility for each cell of a Digital Elevation Model
# (DEM) with respect to a light/signal source (typically the Sun, but may be
# any SPICE-trackable body or a user-supplied custom azimuth/elevation).
#
# Method: Maximum Horizon Angle Ray-Casting
# ------------------------------------------
# For every DEM cell:
#   1. Compute the source azimuth and elevation at that cell.  For SPICE
#      bodies the position is computed via spiceypy; for custom sources the
#      az/el is supplied directly.  Because the DEM may span a large area,
#      az/el is interpolated on a coarse sub-grid (grid convergence correction)
#      to account for azimuthal projection distortions across the tile.
#   2. March along the DEM in the source's azimuth direction, sampling terrain
#      elevation at each step.
#   3. At each sample compute the elevation angle from the cell to the terrain:
#        el_angle = atan2(terrain_h - cell_h, dist_m)
#      Track the running maximum elevation angle (max_el_angle).
#   4. If max_el_angle >= source_elevation, the cell is in shadow (value 0).
#      Otherwise the cell is illuminated (value 1).  NoData cells are marked 9.
#
# Curvature Correction
# --------------------
# At distance d (meters) from the cell, terrain elevation is adjusted by
# subtracting the planetary curvature drop:
#   terrain_h -= d² / (2 * planet_radius)
# This accounts for the fact that on a spherical body distant terrain appears
# lower than on a flat plane.
#
# Optimizations
# -------------
# - Adaptive step size: when the margin between source elevation and the
#   current max elevation angle is large (>5°), the march step is multiplied
#   by 4; when moderate (>2°), by 2.  This dramatically reduces iterations for
#   cells far from the shadow boundary.
# - Early cutoff: the march is limited to MAX_TERRAIN_H / tan(source_el)
#   pixels, beyond which no terrain could possibly occlude the source.
# - Curvature-based early termination: beyond a distance where the curvature
#   drop exceeds MAX_TERRAIN_H, no terrain can reach the source, so the march
#   stops.
# - Configurable min/max distance: samples within minDistance (meters) are
#   skipped; the march stops beyond maxDistance (meters).
#
# Batch Mode
# ----------
# compute_sightmap_batch() processes multiple timestamps in a single call.
# DEM and SPICE kernels are loaded once; each timestamp only recomputes the
# sun vector and runs the ray-march kernel.
#
# Differences from ViewshedTool
# -----------------------------
# This module performs *cast shadow* analysis (is terrain shadowed by other
# terrain w.r.t. a distant source).  The separate ViewshedTool uses the
# reference-plane viewshed algorithm from Wang, Robinson, and White (2000)
# "Generating Viewsheds without Using Sightlines" for *observer viewshed*
# analysis (what terrain is visible from a point).
#
# I/O
# ---
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
# ============================================================================

import sys
import json
import math
import os

import numpy as np
import numba
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

def _is_cog(ds):
    """Check if a GDAL dataset is a Cloud Optimized GeoTIFF."""
    driver = ds.GetDriver()
    if driver is None or driver.ShortName != 'GTiff':
        return False
    md = ds.GetMetadata('IMAGE_STRUCTURE') or {}
    layout = md.get('LAYOUT', '').upper()
    if layout == 'COG':
        return True
    # Also accept tiled TIFFs with overviews (effectively COG-like)
    band = ds.GetRasterBand(1)
    block_w, block_h = band.GetBlockSize()
    has_tiling = (block_w < ds.RasterXSize or block_h < ds.RasterYSize)
    has_overviews = band.GetOverviewCount() > 0
    return has_tiling and has_overviews


def _proj_bounds_to_pixel_window(gt, native_cols, native_rows, viewport_bounds):
    """Convert projected viewport bounds [xmin,ymin,xmax,ymax] to pixel window.

    Returns (xoff, yoff, win_cols, win_rows) clipped to the DEM extent,
    or None if the viewport doesn't overlap the DEM.
    """
    xmin, ymin, xmax, ymax = viewport_bounds
    # Inverse geotransform: pixel = (proj - origin) / pixel_size
    # gt[2] and gt[4] are typically 0 for north-up rasters
    col_min = (xmin - gt[0]) / gt[1]
    col_max = (xmax - gt[0]) / gt[1]
    if gt[5] < 0:
        row_min = (ymax - gt[3]) / gt[5]  # ymax → smaller row
        row_max = (ymin - gt[3]) / gt[5]
    else:
        row_min = (ymin - gt[3]) / gt[5]
        row_max = (ymax - gt[3]) / gt[5]
    # Ensure min < max
    if col_min > col_max:
        col_min, col_max = col_max, col_min
    if row_min > row_max:
        row_min, row_max = row_max, row_min
    # Clamp to raster extent
    col_min = max(0, int(math.floor(col_min)))
    col_max = min(native_cols, int(math.ceil(col_max)))
    row_min = max(0, int(math.floor(row_min)))
    row_max = min(native_rows, int(math.ceil(row_max)))
    win_cols = col_max - col_min
    win_rows = row_max - row_min
    if win_cols <= 0 or win_rows <= 0:
        return None
    return (col_min, row_min, win_cols, win_rows)


def open_dem(dem_path, max_working_dim=None, viewport_bounds=None):
    """Open DEM and return (ds, band_array, nodata, geotransform, srs).

    If *viewport_bounds* is [xmin,ymin,xmax,ymax] in projected coords,
    only the intersecting region is read (at native resolution, capped
    at max_working_dim).

    If *max_working_dim* is given and the region exceeds it, the raster
    is decimated using GDAL overview bands (requires COG).

    Raises RuntimeError if the DEM is not a COG and decimation is needed.
    Small DEMs that don't need decimation are read directly regardless of format.
    """
    ds = gdal.Open(dem_path, GA_ReadOnly)
    if ds is None:
        raise RuntimeError("Could not open DEM: " + dem_path)
    band = ds.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    gt = list(ds.GetGeoTransform())
    srs = osr.SpatialReference()
    if int(osgeoversion[0]) >= 3:
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.ImportFromWkt(ds.GetProjection())

    native_cols = ds.RasterXSize
    native_rows = ds.RasterYSize

    # Determine pixel window from viewport bounds
    win = None
    if viewport_bounds is not None:
        win = _proj_bounds_to_pixel_window(gt, native_cols, native_rows,
                                           viewport_bounds)

    if win is not None:
        xoff, yoff, win_cols, win_rows = win
        max_win = max(win_rows, win_cols)
        # Adjust geotransform origin to window top-left
        gt[0] = gt[0] + xoff * gt[1] + yoff * gt[2]
        gt[3] = gt[3] + xoff * gt[4] + yoff * gt[5]

        if max_working_dim is not None and max_win > max_working_dim:
            if not _is_cog(ds):
                raise RuntimeError(
                    "DEM is not a Cloud Optimized GeoTIFF (COG)."
                )
            scale = max_working_dim / max_win
            buf_cols = max(1, int(round(win_cols * scale)))
            buf_rows = max(1, int(round(win_rows * scale)))
            arr = band.ReadAsArray(xoff=xoff, yoff=yoff,
                                   win_xsize=win_cols, win_ysize=win_rows,
                                   buf_xsize=buf_cols, buf_ysize=buf_rows)
            gt[1] = gt[1] * win_cols / buf_cols
            gt[5] = gt[5] * win_rows / buf_rows
        else:
            arr = band.ReadAsArray(xoff=xoff, yoff=yoff,
                                   win_xsize=win_cols, win_ysize=win_rows)
        gt = tuple(gt)
    else:
        max_native = max(native_rows, native_cols)
        if max_working_dim is not None and max_native > max_working_dim:
            if not _is_cog(ds):
                raise RuntimeError(
                    "DEM is not a Cloud Optimized GeoTIFF (COG)."
                )
            arr = _read_via_overview(band, native_cols, native_rows,
                                     max_working_dim)
            if arr is not None:
                buf_rows, buf_cols = arr.shape
            else:
                scale = max_working_dim / max_native
                buf_cols = max(1, int(round(native_cols * scale)))
                buf_rows = max(1, int(round(native_rows * scale)))
                arr = band.ReadAsArray(buf_xsize=buf_cols, buf_ysize=buf_rows)
            gt[1] = gt[1] * native_cols / buf_cols
            gt[5] = gt[5] * native_rows / buf_rows
            gt = tuple(gt)
        else:
            arr = band.ReadAsArray()
            gt = tuple(gt)

    return arr, nodata, gt, srs


def _read_via_overview(band, native_cols, native_rows, max_working_dim):
    """Read from the best GDAL overview band near max_working_dim.

    Returns the decimated numpy array, or None if no suitable overview exists.
    """
    n_overviews = band.GetOverviewCount()
    if n_overviews == 0:
        return None

    best_ovr = None
    best_dim = None

    for i in range(n_overviews):
        ovr = band.GetOverview(i)
        ovr_max = max(ovr.XSize, ovr.YSize)
        if best_ovr is None:
            best_ovr, best_dim = ovr, ovr_max
        elif ovr_max >= max_working_dim:
            if best_dim < max_working_dim or ovr_max < best_dim:
                best_ovr, best_dim = ovr, ovr_max
        elif ovr_max > best_dim:
            best_ovr, best_dim = ovr, ovr_max

    if best_ovr is None:
        return None

    ovr_cols, ovr_rows = best_ovr.XSize, best_ovr.YSize
    ovr_max = max(ovr_rows, ovr_cols)
    if ovr_max > max_working_dim * 1.5:
        scale = max_working_dim / ovr_max
        buf_cols = max(1, int(round(ovr_cols * scale)))
        buf_rows = max(1, int(round(ovr_rows * scale)))
        return best_ovr.ReadAsArray(buf_xsize=buf_cols, buf_ysize=buf_rows)
    else:
        return best_ovr.ReadAsArray()


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


def get_pixel_scale(dem_rows, gt, srs):
    """Return approximate meters per pixel."""
    pw = abs(gt[1])
    ph = abs(gt[5])
    if srs.IsProjected():
        linear_unit = srs.GetLinearUnits()
        return ((pw + ph) / 2.0) * linear_unit
    else:
        mid_lat = gt[3] + (dem_rows / 2.0) * gt[5]
        deg2m = 111320.0 * math.cos(math.radians(mid_lat))
        return ((pw + ph) / 2.0) * deg2m


# ---------------------------------------------------------------------------
# Vectorized helpers (numpy)
# ---------------------------------------------------------------------------

COARSE_AZEL_STEP = 50  # compute Sun az/el every N output cells


def _vectorized_is_nodata(values, nodata):
    """Check which DEM values are nodata (vectorized)."""
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
    """Vectorized Sun az/el for 2D arrays of lat/lng (degrees)."""
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

    # East = north × normal  (right-hand rule: N×Up = E, CW azimuth)
    ex = nny * nz - nnz * ny
    ey = nnz * nx - nnx * nz
    ez = nnx * ny - nny * nx
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
# Numba JIT march kernel
# ---------------------------------------------------------------------------

@numba.njit(cache=True)
def _numba_march_kernel(result_flat, dem, px_flat, py_flat, dx_flat, dy_flat,
                        heights_flat, el_flat, nodata_flat,
                        dem_rows, dem_cols, pixel_scale,
                        planet_radius, march_step, max_march,
                        nd_lo, nd_hi, has_nd,
                        min_distance_m, max_distance_m):
    """
    Numba-JIT compiled per-cell ray-march kernel.
    Includes adaptive stepping, elevation-based early cutoff,
    and configurable min/max distance limits.
    """
    DEG2RAD = 0.017453292519943295
    RAD2DEG = 57.29577951308232
    MAX_TERRAIN_H = 10000.0  # conservative max terrain relief (meters)
    n = result_flat.shape[0]

    # Convert distance limits from meters to pixels
    min_march_px = min_distance_m / pixel_scale if min_distance_m > 0.0 else 0.0
    max_march_px = max_distance_m / pixel_scale if max_distance_m > 0.0 else max_march

    for i in range(n):
        if nodata_flat[i]:
            result_flat[i] = 9
            continue

        cell_el = el_flat[i]
        if cell_el <= 0.0:
            result_flat[i] = 0
            continue

        cell_h = heights_flat[i]
        cpx = px_flat[i]
        cpy = py_flat[i]
        cdx = dx_flat[i]
        cdy = dy_flat[i]

        # Early cutoff: shadow cannot extend beyond MAX_TERRAIN_H / tan(el)
        el_rad = cell_el * DEG2RAD
        tan_el = math.tan(el_rad)
        if tan_el > 0.001:
            cutoff = min(max_march_px, MAX_TERRAIN_H / (tan_el * pixel_scale) + 10.0)
        else:
            cutoff = max_march_px

        # Curvature-based early termination: beyond a certain distance,
        # curvature drop exceeds possible terrain height advantage
        if planet_radius > 0.0 and tan_el > 0.001:
            # At distance d, curvature drops terrain by d²/(2R).
            # If curvature_drop > MAX_TERRAIN_H, no terrain can occlude.
            max_curv_dist = math.sqrt(2.0 * planet_radius * MAX_TERRAIN_H)
            curv_cutoff = max_curv_dist / pixel_scale
            if curv_cutoff < cutoff:
                cutoff = curv_cutoff

        max_el_angle = -90.0
        r = max(march_step, min_march_px) if min_march_px > 0.0 else march_step
        cur_step = march_step
        blocked = False

        while r < cutoff:
            sx = cpx + cdx * r
            sy = cpy + cdy * r
            ix = int(sx + 0.5) if sx >= 0 else int(sx - 0.5)
            iy = int(sy + 0.5) if sy >= 0 else int(sy - 0.5)

            if ix < 0 or ix >= dem_cols or iy < 0 or iy >= dem_rows:
                break

            sample = float(dem[iy, ix])

            abs_s = abs(sample)
            if has_nd and abs_s >= nd_lo and abs_s <= nd_hi:
                r += cur_step
                continue
            if abs_s > 35000.0 or sample == 1010101.0:
                r += cur_step
                continue

            dist_m = r * pixel_scale
            terrain_h = sample
            if planet_radius > 0.0:
                terrain_h -= (dist_m * dist_m) / (2.0 * planet_radius)

            dh = terrain_h - cell_h
            el_angle = math.atan2(dh, dist_m) * RAD2DEG

            if el_angle > max_el_angle:
                max_el_angle = el_angle

            if max_el_angle >= cell_el:
                blocked = True
                break

            # Adaptive step: larger steps when far from shadow threshold
            margin = cell_el - max_el_angle
            if margin > 5.0:
                cur_step = march_step * 4.0
            elif margin > 2.0:
                cur_step = march_step * 2.0
            else:
                cur_step = march_step

            r += cur_step

        if blocked:
            result_flat[i] = 0
        elif cell_el > max_el_angle:
            result_flat[i] = 1
        else:
            result_flat[i] = 0


# Warm up Numba JIT so the compilation happens at module load, not during
# the first real sightmap call.  Uses a tiny 2×2 dummy array.
_warmup_dem = np.zeros((2, 2), dtype=np.float64)
_warmup_res = np.zeros(1, dtype=np.int8)
_numba_march_kernel(
    _warmup_res, _warmup_dem,
    np.array([0.0]), np.array([0.0]),
    np.array([1.0]), np.array([0.0]),
    np.array([0.0]), np.array([10.0]),
    np.array([False]),
    2, 2, 100.0, 1737400.0, 1.0, 3.0,
    0.0, 0.0, False,
    0.0, 0.0,
)
del _warmup_dem, _warmup_res


# ---------------------------------------------------------------------------
# Core sightmap algorithm (numpy pre-compute + Numba march)
# ---------------------------------------------------------------------------

def _precompute_grid_arrays(dem, nodata, gt, srs, pixel_scale, dem_rows,
                            dem_cols, step, out_rows, out_cols, obs_height):
    """Pre-compute shared arrays that don't depend on the timestamp."""
    oy_arr = np.arange(out_rows)
    ox_arr = np.arange(out_cols)
    oy_grid, ox_grid = np.meshgrid(oy_arr, ox_arr, indexing='ij')
    py_grid = np.minimum(oy_grid * step, dem_rows - 1).astype(np.float64)
    px_grid = np.minimum(ox_grid * step, dem_cols - 1).astype(np.float64)

    cell_vals = dem[py_grid.astype(int), px_grid.astype(int)].astype(np.float64)
    nodata_mask = _vectorized_is_nodata(cell_vals, nodata)
    cell_heights = cell_vals + obs_height

    if nodata is not None:
        nd = float(nodata)
        dec = 10.0 if abs(nd) > 1e9 else 1.0
        nd_lo = abs(nd / dec)
        nd_hi = abs(nd * dec)
        has_nd = True
    else:
        nd_lo, nd_hi, has_nd = 0.0, 0.0, False

    return (px_grid, py_grid, cell_heights, nodata_mask, nd_lo, nd_hi, has_nd)


def _compute_directions(gt, srs, cell_az, px_grid, py_grid):
    """Compute per-cell ray direction in pixel space.

    For azimuthal projected CRS (e.g. polar stereographic), geographic north
    at each cell is rotated from grid north by the grid convergence angle.
    For cylindrical projections (Equidistant Cylindrical, Mercator, etc.),
    grid north equals geographic north so convergence is 0.
    """
    is_proj = bool(srs.IsProjected())
    if is_proj:
        # Determine if the projection is azimuthal (stereo/gnomonic/etc.)
        # vs cylindrical where grid convergence = 0
        proj_name = (srs.GetAttrValue('PROJECTION', 0) or '').lower()
        is_azimuthal = ('stereo' in proj_name or 'azimuthal' in proj_name
                        or 'gnomonic' in proj_name)
        if is_azimuthal:
            # Projected (x, y) from the geotransform — pure numpy, no GDAL
            proj_x = gt[0] + px_grid * gt[1] + py_grid * gt[2]
            proj_y = gt[3] + px_grid * gt[4] + py_grid * gt[5]
            # Grid convergence = atan2(x - FE, sign*(y - FN))
            # For south-pole stereo: north is away from pole (+y), sign = +1
            # For north-pole stereo: north is toward -y, sign = -1
            fe = srs.GetProjParm('false_easting', 0.0)
            fn = srs.GetProjParm('false_northing', 0.0)
            lat_origin = srs.GetProjParm('latitude_of_origin', 0.0)
            north_sign = -1.0 if lat_origin > 0 else 1.0
            convergence = np.degrees(np.arctan2(proj_x - fe,
                                                north_sign * (proj_y - fn)))
            grid_az = cell_az + convergence
        else:
            # Cylindrical/conic projections: grid north = geographic north
            grid_az = cell_az
        az_rad = np.radians(grid_az)
        dx = np.sin(az_rad)
        dy = -np.cos(az_rad) if gt[5] < 0 else np.cos(az_rad)
    else:
        # Geographic CRS: geotransform gives lng/lat directly
        lat_all = gt[3] + px_grid * gt[4] + py_grid * gt[5]
        cos_lat = np.maximum(np.cos(np.radians(lat_all)), 0.01)
        az_rad = np.radians(cell_az)
        dx_geo = np.sin(az_rad) / cos_lat
        dy_geo = np.cos(az_rad)
        if gt[5] < 0:
            dy_geo = -dy_geo
        mag = np.maximum(np.sqrt(dx_geo ** 2 + dy_geo ** 2), 1e-12)
        dx = dx_geo / mag
        dy = dy_geo / mag
    return dx, dy


def _compute_sun_grid(sun_vec_km, obs_az, obs_el, radii_km, flattening,
                      gt, srs, step, out_rows, out_cols, dem_rows, dem_cols):
    """Compute per-cell Sun az/el via coarse subgrid interpolation."""
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
        # Interpolate az in sin/cos space to avoid 360°/0° wrap artifacts
        c_az_rad = np.radians(c_az)
        interp_sin = _bilinear_interp_2d(np.sin(c_az_rad), c_rows, c_cols,
                                         out_rows, out_cols)
        interp_cos = _bilinear_interp_2d(np.cos(c_az_rad), c_rows, c_cols,
                                         out_rows, out_cols)
        cell_az = np.degrees(np.arctan2(interp_sin, interp_cos))
        cell_az = np.where(cell_az < 0, cell_az + 360.0, cell_az)
        cell_el = _bilinear_interp_2d(c_el, c_rows, c_cols, out_rows, out_cols)
    else:
        cell_az = np.full((out_rows, out_cols), obs_az)
        cell_el = np.full((out_rows, out_cols), obs_el)
    return cell_az, cell_el


def _ray_march_grid(dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
                    step, out_rows, out_cols, obs_height, sun_vec_km,
                    obs_az, obs_el, radii_km, flattening, planet_radius,
                    min_distance=0.0, max_distance=0.0):
    """
    Compute visibility grid using Numba JIT march kernel with:
    - Coarse Sun az/el subgrid interpolation
    - Adaptive march step size
    - Elevation-based early cutoff
    - Configurable min/max distance limits (meters)
    """
    march_step = max(2.0, float(step))
    max_march = max(dem_rows, dem_cols) * 1.5

    (px_grid, py_grid, cell_heights, nodata_mask,
     nd_lo, nd_hi, has_nd) = _precompute_grid_arrays(
        dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
        step, out_rows, out_cols, obs_height)

    cell_az, cell_el = _compute_sun_grid(
        sun_vec_km, obs_az, obs_el, radii_km, flattening,
        gt, srs, step, out_rows, out_cols, dem_rows, dem_cols)

    dx, dy = _compute_directions(gt, srs, cell_az, px_grid, py_grid)

    dem_f64 = dem.astype(np.float64) if dem.dtype != np.float64 else dem
    result_flat = np.zeros(out_rows * out_cols, dtype=np.int8)

    _numba_march_kernel(
        result_flat, dem_f64,
        px_grid.ravel().astype(np.float64),
        py_grid.ravel().astype(np.float64),
        dx.ravel().astype(np.float64),
        dy.ravel().astype(np.float64),
        cell_heights.ravel().astype(np.float64),
        cell_el.ravel().astype(np.float64),
        nodata_mask.ravel(),
        dem_rows, dem_cols, pixel_scale,
        planet_radius, march_step, max_march,
        nd_lo, nd_hi, has_nd,
        float(min_distance), float(max_distance),
    )

    return result_flat.reshape(out_rows, out_cols), obs_az, obs_el


def compute_sightmap(dem_path, obs_lat, obs_lng, obs_height,
                     target, time_str, obs_ref_frame, obs_body,
                     planet_radius, max_output_dim=400,
                     is_custom='false', custom_az=0, custom_el=0,
                     viewport_bounds=None,
                     min_distance=0.0, max_distance=0.0):
    """
    Compute the sightmap grid for a single timestamp.

    If *viewport_bounds* is [xmin,ymin,xmax,ymax] in projected coords,
    only the visible DEM region is read — at native resolution when the
    window fits within max_output_dim, otherwise decimated.
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

    # Skip kernel unloading — process exits immediately after response

    # Working DEM: 2× output grid for terrain detail, min 500px.
    working_dim = max(max_output_dim * 2, 500)
    dem, nodata, gt, srs = open_dem(dem_path,
                                    max_working_dim=working_dim,
                                    viewport_bounds=viewport_bounds)
    dem_rows, dem_cols = dem.shape
    pixel_scale = get_pixel_scale(dem_rows, gt, srs)
    step = max(1, max(dem_rows, dem_cols) // max_output_dim)
    out_rows = (dem_rows + step - 1) // step
    out_cols = (dem_cols + step - 1) // step

    result, obs_az, obs_el = _ray_march_grid(
        dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
        step, out_rows, out_cols, obs_height, sun_vec_km,
        obs_az, obs_el, radii_km, flattening, planet_radius,
        min_distance=min_distance, max_distance=max_distance,
    )

    bounds_info = _compute_bounds(gt, srs, dem_rows, dem_cols)

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
                           is_custom='false', custom_az=0, custom_el=0,
                           viewport_bounds=None,
                           min_distance=0.0, max_distance=0.0):
    """
    Compute sightmap grids for multiple timestamps in one call.
    DEM and SPICE kernels loaded once; timestamps processed sequentially.
    """
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
    kernels = load_kernels(package_dir, obs_body, target, is_custom)

    radii_km = spiceypy.bodvrd(obs_body, "RADII", 3)[1]
    flattening = (radii_km[0] - radii_km[2]) / radii_km[0]

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

    # Skip kernel unloading — process exits immediately after response

    working_dim = max(max_output_dim * 2, 500)
    dem, nodata, gt, srs = open_dem(dem_path,
                                    max_working_dim=working_dim,
                                    viewport_bounds=viewport_bounds)
    dem_rows, dem_cols = dem.shape
    pixel_scale = get_pixel_scale(dem_rows, gt, srs)
    step = max(1, max(dem_rows, dem_cols) // max_output_dim)
    out_rows = (dem_rows + step - 1) // step
    out_cols = (dem_cols + step - 1) // step
    bounds_info = _compute_bounds(gt, srs, dem_rows, dem_cols)

    march_step = max(2.0, float(step))
    max_march = max(dem_rows, dem_cols) * 1.5
    n_cells = out_rows * out_cols

    (px_grid, py_grid, cell_heights, nodata_mask,
     nd_lo, nd_hi, has_nd) = _precompute_grid_arrays(
        dem, nodata, gt, srs, pixel_scale, dem_rows, dem_cols,
        step, out_rows, out_cols, obs_height)

    dem_f64 = dem.astype(np.float64) if dem.dtype != np.float64 else dem
    px_flat = px_grid.ravel().astype(np.float64)
    py_flat = py_grid.ravel().astype(np.float64)
    heights_flat = cell_heights.ravel().astype(np.float64)
    nodata_flat = nodata_mask.ravel()

    results = []
    for i, tp in enumerate(time_positions):
        cell_az, cell_el = _compute_sun_grid(
            tp['sun_vec_km'], tp['obs_az'], tp['obs_el'],
            radii_km, flattening, gt, srs, step, out_rows, out_cols,
            dem_rows, dem_cols)
        dx, dy = _compute_directions(gt, srs, cell_az, px_grid, py_grid)

        result_flat = np.zeros(n_cells, dtype=np.int8)
        _numba_march_kernel(
            result_flat, dem_f64,
            px_flat, py_flat,
            dx.ravel().astype(np.float64),
            dy.ravel().astype(np.float64),
            heights_flat,
            cell_el.ravel().astype(np.float64),
            nodata_flat,
            dem_rows, dem_cols, pixel_scale,
            planet_radius, march_step, max_march,
            nd_lo, nd_hi, has_nd,
            float(min_distance), float(max_distance),
        )

        results.append({
            "grid": result_flat.reshape(out_rows, out_cols).tolist(),
            "az": round(tp['obs_az'], 4),
            "el": round(tp['obs_el'], 4),
            "rows": out_rows,
            "cols": out_cols,
            **bounds_info,
        })
        sys.stderr.write(json.dumps({"progress": i + 1, "total": len(times)}) + "\n")
        sys.stderr.flush()

    return results


def _compute_bounds(gt, srs, dem_rows, dem_cols):
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

        # Distance limits (meters)
        min_distance = float(input_data.get('minDistance', 0))
        max_distance = float(input_data.get('maxDistance', 0))

        # Parse optional viewport bounds (projected coords: xmin,ymin,xmax,ymax)
        vp_raw = input_data.get('viewportBounds', None)
        viewport_bounds = None
        if vp_raw:
            try:
                parts = [float(v) for v in str(vp_raw).split(',')]
                if len(parts) == 4:
                    viewport_bounds = parts
            except (ValueError, TypeError):
                pass

        # Batch mode: multiple timestamps in one call
        times = input_data.get('times', None)
        if times and isinstance(times, list) and len(times) > 0:
            result = compute_sightmap_batch(
                dem_path, obs_lat, obs_lng, obs_height,
                target, times, obs_ref_frame, obs_body,
                planet_radius, max_output_dim,
                is_custom, custom_az, custom_el,
                viewport_bounds=viewport_bounds,
                min_distance=min_distance,
                max_distance=max_distance,
            )
        else:
            time_str = input_data['time']
            result = compute_sightmap(
                dem_path, obs_lat, obs_lng, obs_height,
                target, time_str, obs_ref_frame, obs_body,
                planet_radius, max_output_dim,
                is_custom, custom_az, custom_el,
                viewport_bounds=viewport_bounds,
                min_distance=min_distance,
                max_distance=max_distance,
            )
        print(json.dumps(result))
    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "error": True,
            "message": str(sys.exc_info()[1]),
        }))
        sys.exit(1)
