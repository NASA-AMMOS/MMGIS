
"""
Parser for Planetary Data System header files.

Original Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
Addendum: Fred Calef III <fred.calef@jpl.nasa.gov> - 24 Sept 2017
"""

import sys
import arm_position.camera.cahvor

def parse(filename):
    """Parse a PDS data file and return the labels contained in the file header.

    Returns:
        Data labels in a dictionary. Groups are represented as nested dictionaries.
    """

    pds_file = open(filename)

    i = 0
    lines = []
    for line in pds_file.readlines():
        line = line.strip()

        if len(line) == 0 or line.find("/*") != -1:
		    continue  # Comment, skip line

        if line == "END":
            break

        if line.count("=") == 1:
            lines.append(line)
            i += 1
        else:
            # Continuation of previous line
            if (i > 0):
                lines[i - 1] = lines[i - 1] + " " + line
            else:
                print "Warning: continuation line found at start of file"

    cur_group_key = None
    cur_group = None

    labels = {}
    keystep = 0
    for line in lines:
        key, val = line.split("=")
        key = key.strip()
        val = val.strip()

        if (key == "GROUP" or key == "OBJECT") and keystep == 0:
            cur_group_key = val
            cur_group = {}
            keystep = 1
        elif (key == "GROUP" or key == "OBJECT") and keystep == 1:
            keystep = 2
        elif (key == "END_GROUP" or key == "END_OBJECT") and keystep == 1:
            labels[val] = cur_group
            keystep = 0
        elif (key == "END_GROUP" or key == "END_OBJECT") and keystep == 2:
            keystep = 1
        else:
            parsed_val = parse_value(val)
            if cur_group is None:
                labels[key] = parsed_val
            else:
                cur_group[key] = parsed_val

    return labels

def parse_value(val):
    if len(val) == 0:
        return val

    if val[0] == '"' and val[-1] == '"':
        return val[1:-1]  # Strip quotation marks from string
    elif val[0] == '(' and val[-1] == ')':
        return parse_list(val[1:-1]) # Parse into list of float or string

    # Try to interpret value as integer
    try:
        int_val = int(val)
        return int_val
    except:
        pass # Not an integer

    # Try to interpret value as floating point
    try:
        float_val = float(val)
        return float_val
    except:
        pass # Not a float

    return val # Treat as string

def num(s):
    try:
        return int(s)
    except ValueError:
        return float(s)

def is_float(val):
    try:
        float(val)
        return True
    except:
        return False  

def parse_list(val):
    items = val.split(",")
    if len(items) == 1:
        return [val]

    first_item = items[0].strip()
    if is_float(first_item):
        return [try_parse_float(x) for x in items]
    elif first_item[0] == '"' and first_item[-1] == '"': # If first item is quoted assume all with be quoted
        return [x.strip()[1:-1] for x in items] # Strip quotation marks
    return items

def try_parse_float(str):
    try:
        return float(str)
    except:
        return None

def camera_model(pds_header):
    """Get the camera model described by this UNCOMPRESSED_FILE header."""
    possible_groups = [
        "GEOMETRIC_CAMERA_MODEL",
        "GEOMETRIC_CAMERA_MODEL_PARMS"
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return parse_camera_group(pds_header[group_key])
    return None

def parse_camera_group(camera_group):
    model_type = camera_group["MODEL_TYPE"]

    if model_type == "CAHVOR":
        return cameras.cahvor.CAHVOR(
            camera_group["MODEL_COMPONENT_1"],
            camera_group["MODEL_COMPONENT_2"],
            camera_group["MODEL_COMPONENT_3"],
            camera_group["MODEL_COMPONENT_4"],
            camera_group["MODEL_COMPONENT_5"],
            camera_group["MODEL_COMPONENT_6"])

    raise NotImplementedError("Camera model not implemented: " + model_type)
	
def origin_offset_vector(pds_header):
    possible_groups = [
        'ROVER_COORDINATE_SYSTEM',
        'ROVER_COORDINATE_SYSTEM_PARMS'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('ORIGIN_OFFSET_VECTOR')
    return None

def origin_rotation_quaterion(pds_header):
    possible_groups = [
        'ROVER_COORDINATE_SYSTEM',
        'ROVER_COORDINATE_SYSTEM_PARMS'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('ORIGIN_ROTATION_QUATERNION')
    return None

def srcprdID(pds_header):
    if 'SOURCE_PRODUCT_ID' in pds_header:
        return pds_header.get('SOURCE_PRODUCT_ID')
    return None
    
def instID(pds_header):
    if 'INSTRUMENT_ID' in pds_header:
        return pds_header.get('INSTRUMENT_ID')
    return None

def prdType(pds_header):
    if 'PRODUCT_TYPE' in pds_header:
        return pds_header.get('PRODUCT_TYPE')
    return None

def prdID(pds_header):
    if 'PRODUCT_ID' in pds_header:
        return pds_header.get('PRODUCT_ID')
    return None

def prdcrtTime(pds_header):
    if 'PRODUCT_CREATION_TIME' in pds_header:
        return pds_header.get('PRODUCT_CREATION_TIME')
    return None

def targetName(pds_header):
    if 'TARGET_NAME' in pds_header:
        return pds_header.get('TARGET_NAME')
    return None

def verPDS(pds_header):
    if 'PDS_VERSION_ID' in pds_header:
        return pds_header.get('PDS_VERSION_ID')
    return None

def nameSP(pds_header):
    if 'SPACECRAFT_NAME' in pds_header:
        return pds_header.get('SPACECRAFT_NAME')
    return None

def nameINST(pds_header):
    if 'INSTRUMENT_NAME' in pds_header:
        return pds_header.get('INSTRUMENT_NAME')
    return None

def sclkST(pds_header):
    if 'SPACECRAFT_CLOCK_START_COUNT' in pds_header:
        return pds_header.get('SPACECRAFT_CLOCK_START_COUNT')
    return None

def sclkSP(pds_header):
    if 'SPACECRAFT_CLOCK_STOP_COUNT' in pds_header:
        return pds_header.get('SPACECRAFT_CLOCK_STOP_COUNT')
    return None

def orbitNum(pds_header):
    if 'ORBIT_NUMBER' in pds_header:
        return pds_header.get('ORBIT_NUMBER')
    return None

def lineEXP(pds_header):
    if 'LINE_EXPOSURE_DURATION' in pds_header:
        return pds_header.get('LINE_EXPOSURE_DURATION')
    return None

def note(pds_header):
    if 'RATIONALE_DESC' in pds_header:
        return pds_header.get('RATIONALE_DESC')
    elif 'NOTE' in pds_header:
        return pds_header.get('NOTE')
    return None

def rows(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('LINES')
    return None

def columns(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(pds_header.get(group_key).get('LINE_SAMPLES'))
    return None

def bands(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            bz = pds_header.get(group_key).get('BANDS')
            if bz != None:
                return num(bz)
            else:
                return 1
    return None

def pixeltype(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('SAMPLE_TYPE')
    return None

def bitdepth(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('SAMPLE_BITS')
    return None

def layout(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            lt = pds_header.get(group_key).get('BAND_STORAGE_TYPE')
            if lt == None:
                return 'BAND_SEQUENTIAL'
            else:
                return lt
    return None

def skipbytes(pds_header):
    possible_groups = [
        'UNCOMPRESSED_FILE',
        'IMAGE'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('RECORD_BYTES')).split(" ")[0])
        else:
            return num(str(pds_header.get('RECORD_BYTES')).split(" ")[0])
    return None

def ulxmap(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('WESTERNMOST_LONGITUDE')).split(" ")[0])
    return None

def ulymap(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('MAXIMUM_LATITUDE')).split(" ")[0])
    return None

def lrxmap(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('EASTERNMOST_LONGITUDE')).split(" ")[0])
    return None

def lrymap(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('MINIMUM_LATITUDE')).split(" ")[0])
    return None

def cellsize(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(pds_header.get(group_key).get('MAP_SCALE').split(" ")[0])
    return None

def xydim(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return float(1)/float(str(pds_header.get(group_key).get('MAP_RESOLUTION')).split(" ")[0])
    return None

def projection(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('MAP_PROJECTION_TYPE')
    return None

def crsname(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('COORDINATE_SYSTEM_NAME')
    return None

def crstype(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('COORDINATE_SYSTEM_TYPE')
    return None

def firstsp(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('FIRST_STANDARD_PARALLEL'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('FIRST_STANDARD_PARALLEL')).split(" ")[0])
    return None

def secondsp(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('SECOND_STANDARD_PARALLEL'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('SECOND_STANDARD_PARALLEL')).split(" ")[0])
    return None

def londir(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header.get(group_key).get('POSITIVE_LONGITUDE_DIRECTION')
    return None

def reflat(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('REFERENCE_LATITUDE'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('REFERENCE_LATITUDE')).split(" ")[0])
    return None

def reflon(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('REFERENCE_LONGITUDE'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('REFERENCE_LONGITUDE')).split(" ")[0])
    return None
def clat(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('CENTER_LATITUDE'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('CENTER_LATITUDE')).split(" ")[0])
    return None

def clon(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('CENTER_LONGITUDE'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('CENTER_LONGITUDE')).split(" ")[0])
    return None

def samprjoff(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('SAMPLE_PROJECTION_OFFSET'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('SAMPLE_PROJECTION_OFFSET')).split(" ")[0])
    return None
	
def linprjoff(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            if isinstance(pds_header.get(group_key).get('LINE_PROJECTION_OFFSET'), basestring):
                return 0
            else:
                return num(str(pds_header.get(group_key).get('LINE_PROJECTION_OFFSET')).split(" ")[0])
    return None

def aradius(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('A_AXIS_RADIUS')).split(" ")[0])
    return None

def bradius(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('B_AXIS_RADIUS')).split(" ")[0])
    return None

def cradius(pds_header):
    possible_groups = [
        'IMAGE_MAP_PROJECTION'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return num(str(pds_header.get(group_key).get('C_AXIS_RADIUS')).split(" ")[0])
    return None
