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
import pymap3d as pm

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def ll2aerll(lng, lat, height, target, time):
    # Load kernels
    package_dir = os.path.dirname(os.path.abspath(__file__))
    kernels_to_load = [
        'de440.bsp',
        'naif0012.tls',
        'mar097s.bsp',
        'mars_iau2000_v1.tpc',
        'mro_psp.bsp',
        'pck00011.tpc',
        'dynamic.bsp',
        'dynamic.tf'
    ]
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

    """
    # convert planetocentric coordinates of the observer
    # to rectangular coordinates.
    radii = spiceypy.bodvrd( "MARS", "RADII", 3)[1]
    re  =  radii[0]
    rp  =  radii[2]
    flattening   =  ( re - rp ) / re

    obspos = spiceypy.georec( lng * spiceypy.rpd(), lat * spiceypy.rpd(), height / 1000, radii[0], flattening)
    output = spiceypy.azlcpo( method, target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref)

    razel = output[0]
    # lighttime = output[1]
    """
    obs = "-654321"
    ref = "IAU_MARS"

    state = spiceypy.spkezr( target, et, ref, abcorr, obs )
    razel = spiceypy.recazl( [state[0][0], state[0][1], state[0][2]], azccw, elplsz )

    az_output = razel[1] * spiceypy.dpr()
    el_output = razel[2] * spiceypy.dpr()
    range_output = razel[0] * 1000



    # Unload kernels
    for k in kernels_to_load:
        spiceypy.unload( os.path.join(package_dir + '/kernels/', k) )

    # Compute ll position on surface directly under target/orbiter
    target_ll = pm.aer2geodetic(az_output, el_output, range_output * 1000, lat, lng, height, None, True)

    # Altitude above the tangential plane of the surface observer latlng
    horizontal_altitude = range_output * math.sin(razel[2])

    return json.dumps({
        "azimuth": az_output,
        "elevation": el_output,
        "range": range_output,
        "longitude": target_ll[1],
        "latitude": target_ll[0],
        "altitude": target_ll[2],
        "horizontal_altitude": horizontal_altitude
    })

lng = float(sys.argv[1])
lat = float(sys.argv[2])
height = float(sys.argv[3])
target = unquote(sys.argv[4])
time = unquote(sys.argv[5])

try:
    print(ll2aerll(lng, lat, height, target, time))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))