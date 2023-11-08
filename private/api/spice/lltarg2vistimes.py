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
import re
import numpy as np

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def lltarg2vistimes(lng, lat, height, target, startTime):

    package_dir = os.path.dirname(os.path.abspath(__file__))

    # Load kernels
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

    # Set vars
    MAXWIN = 750
    TIMFMT = "YYYY-MON-DD HR:MN:SC.###### (TDB) ::TDB ::RND"
    TIMLEN = 41
    GS_RESULT = spiceypy.stypes.SPICEDOUBLE_CELL(2 * MAXWIN)
    cnfine = spiceypy.stypes.SPICEDOUBLE_CELL(2)

    relate = ">"
    crdsys = "LATITUDINAL"
    coord  = "LATITUDE"
    targ   = "MRO"
    obsrvr = "-654321"
    frame  = "IAU_MARS"
    abcorr = "NONE"
    
    #Store the time bounds of our search interval in
    #the cnfine confinement window.
    begtim = spiceypy.str2et( "2023 MAY 01" )
    endtim = spiceypy.str2et( "2023 AUG 01" )

    spiceypy.wninsd( begtim, endtim, cnfine )

    
    #This search uses a step size of four hours since the
    #time for all declination zero-to-max-to-zero passes
    #within the search window exceeds eight hours.

    #The example uses an 83 degree elevation because of its
    #rare occurrence and short duration.
    
    step   = int((4.0/24.0) * spiceypy.spd())
    adjust = 0.0
    refval = 75.0 * spiceypy.rpd()

    
    #List the beginning and ending points in each interval
    #if result contains data.
    spiceypy.gfposc( targ, frame, abcorr, obsrvr, crdsys, coord, relate, refval, adjust, step, MAXWIN, cnfine, GS_RESULT )
    spiceypy.wnfetd(GS_RESULT, 0)


    #Creates an array of times in which it passes over target
    GS_times = []
    The_times = [GS_times]
    The_results = [GS_RESULT]

    for i in range(len(The_times)):
        for ii in range(spiceypy.wncard(The_results[i])):
            The_times[i].append(np.linspace(*spiceypy.wnfetd(The_results[i], ii), step, endpoint=False))

    for time in GS_times:
        t = spiceypy.timout(time, TIMFMT)
        s = time[0]
        st = time[-1]
        duration = (st -s)
        start = t[0]
        stop  = t[-1]
        closest_approach = spiceypy.timout((st+s)/2, TIMFMT)
        print("Start: {}   Stop: {}   Closest Approach: {}".format(start, stop, closest_approach))

lng = float(sys.argv[1])
lat = float(sys.argv[2])
height = float(sys.argv[3])
target = unquote(sys.argv[4])
startTime = unquote(sys.argv[5])

print(lltarg2vistimes(lng, lat, height, target, startTime))