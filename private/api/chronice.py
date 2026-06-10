# chronice: chronos + spice (but without chronos since spice-alone offered more controll)
# chronice.py <body> <target> <from_format> <time> [lng]
#     <from_format>: 'utc' or 'lmst' and will convert into the other
#     [lng]: observer east longitude in degrees (required for lunar LSMT)
#
# Mars examples:
#        python chronice.py MARS MSL utc "2024-01-17T20:56:20.280"
#           => {"result": "SOL-04070M09:30:00"}
#        python chronice.py MARS MSL lmst "SOL-4070M09:30:00"
#           => {"result": "2024-01-17T20:56:20.279"}
#
# Lunar examples:
#        python chronice.py MOON MOON utc "2025-06-08T12:00:00" 0.0
#           => {"result": "LDAY-00314L09:56:45"}
#        python chronice.py MOON MOON lmst "LDAY-00314L09:56:45" 0.0
#           => {"result": "2025-06-08T12:00:00.000"}

import sys
import json
import os
import math

import spiceypy

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

# Moon synodic period (solar day) in seconds
_LUNAR_SYNODIC_DAYS = 29.530589
_LUNAR_SYNODIC_SEC = _LUNAR_SYNODIC_DAYS * 86400.0
_LUNAR_HOUR_SEC = _LUNAR_SYNODIC_SEC / 24.0
_LUNAR_MIN_SEC = _LUNAR_HOUR_SEC / 60.0
_LUNAR_SEC_SEC = _LUNAR_MIN_SEC / 60.0

def _load_kernels(body, target):
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')
    PATH_TO_KERNELS = '../../spice/kernels/'

    kernels_to_load = []
    try:
        path = PATH_TO_KERNELS
        for x in os.listdir(os.path.join(package_dir, path)):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass

    try:
        path = PATH_TO_KERNELS + body + '/'
        for x in os.listdir(os.path.join(package_dir, path)):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass

    try:
        path = PATH_TO_KERNELS + body + '/' + target + '/'
        for x in os.listdir(os.path.join(package_dir, path)):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass

    for k in kernels_to_load:
        spiceypy.furnsh(os.path.join(package_dir, k))


def _lunar_utc_to_lsmt(utc_time, lon_deg):
    """Convert UTC to Lunar Local Solar Mean Time using SPICE et2lst."""
    et = spiceypy.utc2et(utc_time)
    lon_rad = lon_deg * math.pi / 180.0
    hr, mn, sc, _, _ = spiceypy.et2lst(et, 301, lon_rad, 'PLANETOCENTRIC')

    # Compute lunar day number from J2000
    elapsed_since_midnight = hr * _LUNAR_HOUR_SEC + mn * _LUNAR_MIN_SEC + sc * _LUNAR_SEC_SEC
    midnight_et = et - elapsed_since_midnight
    day_num = int(midnight_et / _LUNAR_SYNODIC_SEC)

    return f'LDAY-{day_num:05d}L{hr:02d}:{mn:02d}:{sc:02d}'


def _lunar_lsmt_to_utc(lsmt_str, lon_deg):
    """Convert Lunar LSMT string back to UTC via coarse iteration + binary search.

    et2lst returns integer (hr, mn, sc), so one lunar second spans ~29.18 ET
    seconds.  The coarse loop lands inside the correct h:m:s window, then a
    binary search narrows to the exact ET boundary where the second ticks
    over, giving sub-second UTC precision.
    """
    stripped = lsmt_str.strip()
    if stripped.upper().startswith('LDAY-'):
        stripped = stripped[5:]
    parts = stripped.split('L')
    day_num = int(parts[0])
    time_parts = parts[1].split(':')
    target_hr = int(time_parts[0])
    target_mn = int(time_parts[1])
    target_sc = int(time_parts[2])
    target_secs = target_hr * 3600 + target_mn * 60 + target_sc

    lon_rad = lon_deg * math.pi / 180.0

    # Initial estimate: day_num * synodic_period + time offset
    et = day_num * _LUNAR_SYNODIC_SEC + target_hr * _LUNAR_HOUR_SEC + target_mn * _LUNAR_MIN_SEC + target_sc * _LUNAR_SEC_SEC

    # Coarse iterative refinement to land in the correct h:m:s window
    for _ in range(50):
        h, m, sc, _, _ = spiceypy.et2lst(et, 301, lon_rad, 'PLANETOCENTRIC')
        current_secs = h * 3600 + m * 60 + sc
        diff = target_secs - current_secs
        if diff > 43200:
            diff -= 86400
        elif diff < -43200:
            diff += 86400
        if abs(diff) <= 1:
            break
        et += diff * _LUNAR_SEC_SEC

    # Binary search for the start of this lunar second (±0.5 ET second)
    lo = et - _LUNAR_SEC_SEC
    hi = et + _LUNAR_SEC_SEC
    for _ in range(40):
        mid = (lo + hi) / 2.0
        h2, m2, s2, _, _ = spiceypy.et2lst(mid, 301, lon_rad, 'PLANETOCENTRIC')
        mid_secs = h2 * 3600 + m2 * 60 + s2
        d = mid_secs - target_secs
        if d > 43200:
            d -= 86400
        elif d < -43200:
            d += 86400
        if d < 0:
            lo = mid
        else:
            hi = mid
        if hi - lo < 0.5:
            break

    # hi is the start of this lunar second; add half a lunar second
    et = hi + _LUNAR_SEC_SEC / 2.0

    return spiceypy.et2utc(et, "ISOC", 3)


def chronice(body, target, fromFormat, time, lon_deg=None):
    _load_kernels(body, target)

    bodyLow = body.lower()
    targetLow = target.lower()

    # --- Lunar LSMT (uses et2lst) ---
    if bodyLow == 'moon':
        if lon_deg is None:
            return json.dumps({"error": True, "message": "Lunar LSMT requires observer longitude"})
        if fromFormat == 'utc':
            result = _lunar_utc_to_lsmt(time, lon_deg)
        else:
            result = _lunar_lsmt_to_utc(time, lon_deg)
        return json.dumps({"result": result})

    # --- Mars LMST (uses spacecraft clock) ---
    targetId = 0
    if targetLow == 'msl':
        targetId = -76900
    elif targetLow == 'mars2020':
        targetId = -168900

    if fromFormat == 'utc':
        et = spiceypy.utc2et(time)
        result = spiceypy.sce2s(targetId, et)
        result = sclk2lmst(result, targetLow)
    else:
        time = lmst2sclk(time, targetLow)
        et = spiceypy.scs2e(targetId, time)
        result = spiceypy.et2utc(et, "ISOC", 3)

    return json.dumps({
        "result": result
    })

def sclk2lmst(sclk, target):
    if target == 'msl' or target == 'mars2020':
        s = sclk.split('/')[1].split(':')
        sol = int(s[0])
        hour = int(s[1])
        minute = int(s[2])
        seconds = round(float(s[3] + '.' + s[4]))
        if seconds == 60:
            minute = minute + 1
            seconds = 0
        if minute == 60:
            hour = hour + 1
            minute = 0
        if hour == 24:
            sol = sol + 1
            hour = 0

        sol = str(sol).zfill(5)
        hour = str(hour).zfill(2)
        minute = str(minute).zfill(2)
        seconds = str(seconds).zfill(2)
        return f'SOL-{sol}M{hour}:{minute}:{seconds}'
def lmst2sclk(lmst, target, partition = 1):
    if target == 'msl' or target == 'mars2020':
        s = lmst.replace(' ', ':').replace('-', ':').replace('M', ':').split(':')
        return f'{partition}/{s[1].zfill(5)}:{s[2].zfill(2)}:{s[3].zfill(2)}:{s[4].zfill(2)}:00000'

# Start
body = unquote(sys.argv[1])
target = unquote(sys.argv[2])
fromFormat = unquote(sys.argv[3])
time = unquote(sys.argv[4])
lon_deg = float(unquote(sys.argv[5])) if len(sys.argv) > 5 else None

try:
    print(chronice(body, target, fromFormat, time, lon_deg))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))
