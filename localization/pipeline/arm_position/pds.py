
"""
Parser for Planetary Data System header files.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import sys
import camera.cahvor

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
    for line in lines:
        key, val = line.split("=")
        key = key.strip()
        val = val.strip()

        if key == "GROUP" or key == "OBJECT":
            cur_group_key = val
            cur_group = {}
        elif key == "END_GROUP" or key == "END_OBJECT":
            labels[val] = cur_group
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
    """Get the camera model described by this image header."""
    possible_groups = [
        "GEOMETRIC_CAMERA_MODEL",
        "GEOMETRIC_CAMERA_MODEL_PARMS"
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return parse_camera_group(pds_header[group_key])
    return None

def origin_offset_vector(pds_header):
    possible_groups = [
        'ROVER_COORDINATE_SYSTEM',
        'ROVER_COORDINATE_SYSTEM_PARMS'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header[group_key]['ORIGIN_OFFSET_VECTOR']
    return None

def origin_rotation_quaterion(pds_header):
    possible_groups = [
        'ROVER_COORDINATE_SYSTEM',
        'ROVER_COORDINATE_SYSTEM_PARMS'
    ]

    for group_key in possible_groups:
        if group_key in pds_header:
            return pds_header[group_key]['ORIGIN_ROTATION_QUATERNION']
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
