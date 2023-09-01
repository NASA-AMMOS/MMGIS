# ll2aerl - Longitude, Latitude to Azimuth, Elevation, Range, Longitude, Latitude, Height
# Given a lnglat ground position, time and a target object:
# Returns the az/el/range in the sky as well as the lnglat position directory under the object 
# !!! Currently only designed for Mars

# example: ll2aerll.py [lng] [lat] [height] [target] [time] 
import sys
import json
import os
import subprocess
import shlex
import uuid
import numpy as np

import math
import spiceypy
import pymap3d as pm
import re


# chronos.exe -setup ./chronos/chronos-msl.setup -from utc -fromtype scet -to lst -totype lst -time "2023-07-27 23:16:05.644"
# chronos.exe -setup ./chronos/chronos-msl.setup -to utc -totype scet -from lst -fromtype lst -time "SOL 3901 03:46:54"

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def ll2aerll(lng, lat, height, target, time):
    # Load kernels
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')

    kernels_to_load = []
    # Crawl dir for kernels
    for x in os.listdir(os.path.join(package_dir + '/kernels')):
        if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls')) and not x.startswith('dynamic'):
            # Prints only text file present in My Folder
            kernels_to_load.append(x)

    # Fill out dynamic template
    with open (os.path.join(package_dir, 'pinpoint/dynamic-template.setup'), 'r' ) as f:
        content = f.read()
        content_new = re.sub('{{LNG}}', str(lng), content, flags = re.M)
        content_new = re.sub('{{LAT}}', str(lat), content_new, flags = re.M)
        content_new = re.sub('{{HEIGHT_KM}}', str(height / 1000), content_new, flags = re.M)

    fileTf = open(os.path.join(package_dir + '/kernels/', 'dynamic.setup'), "w") 
    fileTf.write(content_new)
    fileTf.close()

    # Create dynamic
    dynamicSpkFile = f'dynamic-{str(uuid.uuid4())}.bsp'
    dynamicFkFile = f'dynamic-{str(uuid.uuid4())}.tf'
    cmd = os.path.join(package_dir + '/', 'pinpoint.exe')
    setup = os.path.join(package_dir + '/kernels/', 'dynamic.setup')
    pck = os.path.join(package_dir + '/kernels/', 'mars_iau2000_v1.tpc')
    dynamicSpk = os.path.join(package_dir + '/kernels/', dynamicSpkFile)
    dynamicFk = os.path.join(package_dir + '/kernels/', dynamicFkFile)
    subprocess.call(shlex.split(f'{cmd} -def {setup} -pck {pck} -spk {dynamicSpk} -fk {dynamicFk}'))

    kernels_to_load.append(dynamicSpkFile)
    kernels_to_load.append(dynamicFkFile)

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
    
    
    # B
    """
    obs = "-654321"
    ref = "IAU_MARS"

    try:
        state = spiceypy.spkezr( target, et, ref, abcorr, obs )
        razel = spiceypy.recazl( [state[0][0], state[0][1], state[0][2]], azccw, elplsz )
    except Exception as e:
        # Unload kernels
        for k in kernels_to_load:
            spiceypy.unload( os.path.join(package_dir + '/kernels/', k) )

         # Remove temporary dyanmic files
        os.remove(dynamicSpk)
        os.remove(dynamicFk)
        raise e
        """
    az_output = razel[1] * spiceypy.dpr()
    el_output = razel[2] * spiceypy.dpr()
    range_output = razel[0] * 1000

    try:
        visibilities = [] #lltarg2vistimes(1,2,3,4,5)
    except:
        visibilities = []

    # Unload kernels
    for k in kernels_to_load:
        spiceypy.unload( os.path.join(package_dir + '/kernels/', k) )

    # Remove temporary dyanmic files
    os.remove(dynamicSpk)
    os.remove(dynamicFk)

    # Compute ll position on surface directly under target/orbiter
    target_ll = pm.aer2geodetic(az_output, el_output, range_output * 1000, lat, lng, height, None, True)

    # Altitude above the tangential plane of the surface observer latlng
    horizontal_altitude = range_output * math.sin(razel[2])


    return json.dumps({
        "visibilities": visibilities,
        "azimuth": az_output,
        "elevation": el_output,
        "range": range_output,
        "longitude": target_ll[1],
        "latitude": target_ll[0],
        "altitude": target_ll[2],
        "horizontal_altitude": horizontal_altitude
    })

"""
def lltarg2vistimes(lng, lat, height, target, startTime):

    package_dir = os.path.dirname(os.path.abspath(__file__))

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
    endtim = spiceypy.str2et( "2023 MAY 05" )

    spiceypy.wninsd( begtim, endtim, cnfine )

    
    #This search uses a step size of four hours since the
    #time for all declination zero-to-max-to-zero passes
    #within the search window exceeds eight hours.

    #The example uses an 83 degree elevation because of its
    #rare occurrence and short duration.
    
    step   = int((4.0/24.0) * spiceypy.spd())
    adjust = 0.0
    refval = 65.0 * spiceypy.rpd()

    
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

    visibilities = []
    for time in GS_times:
        t = spiceypy.timout(time, TIMFMT)
        s = time[0]
        st = time[-1]
        duration = (st -s)
        start = t[0]
        stop  = t[-1]
        closest_approach = spiceypy.timout((st+s)/2, TIMFMT)
        visibilities.append({"start": start, "stop": stop, "closest_approach": closest_approach})

    return visibilities
"""

lng = float(sys.argv[1])
lat = float(sys.argv[2])
height = float(sys.argv[3])
target = unquote(sys.argv[4])
time = unquote(sys.argv[5])

try:
    print(ll2aerll(lng, lat, height, target, time))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))