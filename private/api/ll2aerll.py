# ll2aerl - Longitude, Latitude to Azimuth, Elevation, Range, Longitude, Latitude, Height
# Given a lnglat ground position, time and a target object:
# Returns the az/el/range in the sky as well as the lnglat position directory under the object 
# Works for any SPICE body (Mars, Earth, Moon, etc.) via obsRefFrame and obsBody params

# example: python ll2aerll.py [lng] [lat] [height] [target] [time] [obsRefFrame] [obsBody] [includeSunEarth] [isCustom] [customAz] [customEl] [customRange]
# python ll2aerll.py 77.36885547637941 18.481028548936987 -2410.2507 MRO "2023 NOV 10 00:21:31 UTC" IAU_MARS MARS false false

import sys
import json
import os

import math
import numpy as np
import spiceypy
import pymap3d as pm

from great_circle_calculator.great_circle_calculator import distance_between_points

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def ll2aerll(lng, lat, height, target, time, obsRefFrame, obsBody, includeSunEarth, isCustom, customAz, customEl, customRange):
    # Load kernels
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')

    PATH_TO_KERNELS = '../../spice/kernels/'

    kernels_to_load = []

    try: 
        # Crawl main dir for kernels
        path = PATH_TO_KERNELS
        for x in os.listdir(os.path.join(package_dir, path )):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass
    
    try: 
        # Crawl body dir for kernels
        path = PATH_TO_KERNELS + obsBody + '/'
        for x in os.listdir(os.path.join(package_dir, path )):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass

    try:
        # Crawl body/target dir for kernels
        if isCustom != 'true':
            path = PATH_TO_KERNELS + obsBody + '/' + target + '/'
            for x in os.listdir(os.path.join(package_dir, path)):
                if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                    kernels_to_load.append(path + x)
    except:
        pass

    for k in kernels_to_load:
        spiceypy.furnsh( os.path.join(package_dir, k) )


    # Setup params
    obstim = time
    et = spiceypy.str2et(obstim)

    method = "ELLIPSOID"
    target = target
    abcorr = "NONE"
    azccw = False
    elplsz = True
    # Units always in km
    obspos = [0,0,0]
    obsctr = obsBody # Such as "MARS"
    obsref = obsRefFrame # Such as "IAU_MARS"

    # A
    
    radii = spiceypy.bodvrd( obsBody, "RADII", 3)[1]
    rE = radii[0]
    rP = radii[2]
    flattening  = (rE - rP) / rE

    if isCustom == 'true':
        az_output = float(customAz)
        el_output = float(customEl)
        range_output = float(customRange)
        razel = [customRange, az_output * spiceypy.rpd(), el_output * spiceypy.rpd()]
    else:
        obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
        output = spiceypy.azlcpo( method, target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref)

        razel = output[0]
        
        az_output = razel[1] * spiceypy.dpr()
        el_output = razel[2] * spiceypy.dpr()
        range_output = razel[0]

    sun_az_output = None
    sun_el_output = None
    earth_az_output = None
    earth_el_output = None
    if includeSunEarth == 'true':
        targetSE = 'SUN'
        sun_obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
        sun_output = spiceypy.azlcpo( method, targetSE, et, abcorr, azccw, elplsz, sun_obspos, obsctr, obsref)
        sun_razel = sun_output[0]
        sun_az_output = sun_razel[1] * spiceypy.dpr()
        sun_el_output = sun_razel[2] * spiceypy.dpr()

        if obsBody.upper() != 'EARTH':
            targetSE = 'EARTH'
            earth_obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
            earth_output = spiceypy.azlcpo( method, targetSE, et, abcorr, azccw, elplsz, earth_obspos, obsctr, obsref)
            earth_razel = earth_output[0]
            earth_az_output = earth_razel[1] * spiceypy.dpr()
            earth_el_output = earth_razel[2] * spiceypy.dpr()

    if isCustom == 'true':
        target_lat, target_lng, target_alt = pm.aer2geodetic(az_output, el_output, range_output * 1000,
            lat,
            lng,
            height,
            ell=pm.Ellipsoid(radii[0] * 1000, radii[1] * 1000, radii[2] * 1000), deg=True)
        target_alt = target_alt / 1000
    else:
        state, light = spiceypy.spkezr(target, et, obsref, abcorr, obsctr)
        ll = spiceypy.recgeo( state[0:3], radii[0], flattening)
        target_lng = ll[0] * spiceypy.dpr()
        target_lat = ll[1] * spiceypy.dpr()
        target_alt = ll[2]

    # Unload kernels
    for k in kernels_to_load:
        spiceypy.unload( os.path.join(package_dir + '/kernels/', k) )

    flat_range = distance_between_points((lng, lat), (target_lng, target_lat), "meters", radii[0])
    # Altitude above the tangential plane of the surface observer latlng
    horizontal_altitude = (flat_range * 1000) * math.tan(razel[2])


    return {
        "azimuth": az_output,
        "elevation": el_output,
        "range": range_output,
        "longitude": target_lng,
        "latitude": target_lat,
        "altitude": target_alt,
        "horizontal_altitude": horizontal_altitude,
        "ancillary": {
            "sun_az": sun_az_output,
            "sun_el": sun_el_output,
            "earth_az": earth_az_output,
            "earth_el": earth_el_output
        }
    }


def ll2aerll_bulk(lng, lat, height, target, times, obsRefFrame, obsBody, includeSunEarth, isCustom, customAz, customEl, customRange):
    """Compute ll2aerll for multiple times with kernels loaded once."""
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
        path = PATH_TO_KERNELS + obsBody + '/'
        for x in os.listdir(os.path.join(package_dir, path)):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                kernels_to_load.append(path + x)
    except:
        pass
    try:
        if isCustom != 'true':
            path = PATH_TO_KERNELS + obsBody + '/' + target + '/'
            for x in os.listdir(os.path.join(package_dir, path)):
                if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls', '.bpc')):
                    kernels_to_load.append(path + x)
    except:
        pass

    for k in kernels_to_load:
        spiceypy.furnsh(os.path.join(package_dir, k))

    method = "ELLIPSOID"
    abcorr = "NONE"
    azccw = False
    elplsz = True
    obsctr = obsBody
    obsref = obsRefFrame

    radii = spiceypy.bodvrd(obsBody, "RADII", 3)[1]
    rE = radii[0]
    rP = radii[2]
    flattening = (rE - rP) / rE

    results = []
    for t in times:
        try:
            et = spiceypy.str2et(t)
            if isCustom == 'true':
                az_output = float(customAz)
                el_output = float(customEl)
                range_output = float(customRange)
                razel = [customRange, az_output * spiceypy.rpd(), el_output * spiceypy.rpd()]
            else:
                obspos = spiceypy.georec(lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
                output = spiceypy.azlcpo(method, target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref)
                razel = output[0]
                az_output = razel[1] * spiceypy.dpr()
                el_output = razel[2] * spiceypy.dpr()
                range_output = razel[0]

            sun_az_output = None
            sun_el_output = None
            earth_az_output = None
            earth_el_output = None
            if includeSunEarth == 'true':
                sun_obspos = spiceypy.georec(lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
                sun_output = spiceypy.azlcpo(method, 'SUN', et, abcorr, azccw, elplsz, sun_obspos, obsctr, obsref)
                sun_razel = sun_output[0]
                sun_az_output = sun_razel[1] * spiceypy.dpr()
                sun_el_output = sun_razel[2] * spiceypy.dpr()
                if obsBody.upper() != 'EARTH':
                    earth_obspos = spiceypy.georec(lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
                    earth_output = spiceypy.azlcpo(method, 'EARTH', et, abcorr, azccw, elplsz, earth_obspos, obsctr, obsref)
                    earth_razel = earth_output[0]
                    earth_az_output = earth_razel[1] * spiceypy.dpr()
                    earth_el_output = earth_razel[2] * spiceypy.dpr()

            if isCustom == 'true':
                target_lat, target_lng, target_alt = pm.aer2geodetic(az_output, el_output, range_output * 1000,
                    lat, lng, height,
                    ell=pm.Ellipsoid(radii[0] * 1000, radii[1] * 1000, radii[2] * 1000), deg=True)
                target_alt = target_alt / 1000
            else:
                state, light = spiceypy.spkezr(target, et, obsref, abcorr, obsctr)
                ll = spiceypy.recgeo(state[0:3], radii[0], flattening)
                target_lng = ll[0] * spiceypy.dpr()
                target_lat = ll[1] * spiceypy.dpr()
                target_alt = ll[2]

            flat_range = distance_between_points((lng, lat), (target_lng, target_lat), "meters", radii[0])
            horizontal_altitude = (flat_range * 1000) * math.tan(razel[2])

            results.append({
                "time": t,
                "azimuth": az_output,
                "elevation": el_output,
                "range": range_output,
                "longitude": target_lng,
                "latitude": target_lat,
                "altitude": target_alt,
                "horizontal_altitude": horizontal_altitude,
                "ancillary": {
                    "sun_az": sun_az_output,
                    "sun_el": sun_el_output,
                    "earth_az": earth_az_output,
                    "earth_el": earth_el_output
                }
            })
        except:
            results.append({"time": t, "error": True, "message": 'Error: ' + str(sys.exc_info()[1])})

    for k in kernels_to_load:
        spiceypy.unload(os.path.join(package_dir, k))

    return results


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--bulk':
        # Bulk mode: read JSON from stdin
        try:
            input_data = json.loads(sys.stdin.read())
            lng = float(input_data['lng'])
            lat = float(input_data['lat'])
            height = float(input_data['height'])
            target = input_data['target']
            times = input_data['times']
            obsRefFrame = input_data.get('obsRefFrame', 'IAU_MARS')
            obsBody = input_data.get('obsBody', 'MARS')
            includeSunEarth = input_data.get('includeSunEarth', 'false')
            isCustom = input_data.get('isCustom', 'false')
            customAz = input_data.get('customAz', 0)
            customEl = input_data.get('customEl', 0)
            customRange = input_data.get('customRange', 0)
            results = ll2aerll_bulk(lng, lat, height, target, times, obsRefFrame, obsBody, includeSunEarth, isCustom, customAz, customEl, customRange)
            print(json.dumps(results))
        except:
            print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[1])}))
    else:
        # Single mode: CLI args
        lng = float(sys.argv[1])
        lat = float(sys.argv[2])
        height = float(sys.argv[3])
        target = unquote(sys.argv[4])
        time = unquote(sys.argv[5])
        obsRefFrame = unquote(sys.argv[6])
        obsBody = unquote(sys.argv[7])
        includeSunEarth = sys.argv[8]
        isCustom = False
        customAz = 0
        customEl = 0
        customRange = 0
        if len(sys.argv) > 9:
            isCustom = sys.argv[9]
        if isCustom == 'true':
            customAz = float(sys.argv[10])
            customEl = float(sys.argv[11])
            customRange = float(sys.argv[12])

        try:
            print(json.dumps(ll2aerll(lng, lat, height, target, time, obsRefFrame, obsBody, includeSunEarth, isCustom, customAz, customEl, customRange)))
        except:
            print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))
