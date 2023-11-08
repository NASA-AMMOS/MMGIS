# ll2aerl - Longitude, Latitude to Azimuth, Elevation, Range, Longitude, Latitude, Height
# Given a lnglat ground position, time and a target object:
# Returns the az/el/range in the sky as well as the lnglat position directory under the object 
# !!! Currently only designed for Mars

# example: ll2aerll.py [lng] [lat] [height] [target] [time] 
import sys
import json
import os

import math
import spiceypy

# chronos.exe -setup ./chronos/chronos-msl.setup -from utc -fromtype scet -to lst -totype lst -time "2023-07-27 23:16:05.644"
# chronos.exe -setup ./chronos/chronos-msl.setup -to utc -totype scet -from lst -fromtype lst -time "SOL 3901 03:46:54"

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def ll2aerll(lng, lat, height, target, time, includeSunEarth):
    # Load kernels
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')

    kernels_to_load = []
    # Crawl dir for kernels
    for x in os.listdir(os.path.join(package_dir + '/kernels')):
        if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls')) and not x.startswith('dynamic'):
            # Prints only text file present in My Folder
            kernels_to_load.append(x)

    for k in kernels_to_load:
        spiceypy.furnsh( os.path.join(package_dir + '/kernels/', k) )

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
    obsctr = "MARS"
    obsref = "IAU_MARS"

    # A
    
    radii = spiceypy.bodvrd( "MARS", "RADII", 3)[1]
    rE = radii[0]
    rP = radii[2]
    flattening  = (rE - rP) / rE

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
        target = 'SUN'
        sun_obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
        sun_output = spiceypy.azlcpo( method, target, et, abcorr, azccw, elplsz, sun_obspos, obsctr, obsref)
        sun_razel = sun_output[0]
        sun_az_output = sun_razel[1] * spiceypy.dpr()
        sun_el_output = sun_razel[2] * spiceypy.dpr()

        target = 'EARTH'
        earth_obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
        earth_output = spiceypy.azlcpo( method, target, et, abcorr, azccw, elplsz, earth_obspos, obsctr, obsref)
        earth_razel = earth_output[0]
        earth_az_output = earth_razel[1] * spiceypy.dpr()
        earth_el_output = earth_razel[2] * spiceypy.dpr()


    state, light = spiceypy.spkezr(target, et, "IAU_MARS", abcorr, "MARS")
    ll = spiceypy.recgeo( state[0:3], radii[0], flattening)
    target_lng = ll[0] * spiceypy.dpr()
    target_lat = ll[1] * spiceypy.dpr()
    target_alt = ll[2]

    # Unload kernels
    for k in kernels_to_load:
        spiceypy.unload( os.path.join(package_dir + '/kernels/', k) )

    # Altitude above the tangential plane of the surface observer latlng
    horizontal_altitude = (range_output * 1000) * math.sin(razel[2])


    return json.dumps({
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

lng = float(sys.argv[1])
lat = float(sys.argv[2])
height = float(sys.argv[3])
target = unquote(sys.argv[4])
time = unquote(sys.argv[5])
includeSunEarth = sys.argv[6]

try:
    print(ll2aerll(lng, lat, height, target, time, includeSunEarth))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))
