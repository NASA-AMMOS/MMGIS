#!/usr/bin/env python

"""Script to determine position of arm tools from PDS data files.

Usage: arm-position [--rover-nav | --local-level | --site-frame] [--verbose] \\
                    <instrument1> [<instrument2>...] <PDS Image File>

The script outputs one line per instrument in the following format, where pos is the
position of the instrument and dir is the pointing direction:

product_id, instrument, pos_x, pos_y, pos_z, dir_x, dir_y, dir_z

Options:
   <instrument>     Compute position of instrument named "name", where "name" is
                    one of "mahli", "apxs", "drill", "drt", "portioner", or "scoopbase".
                    If no instrument is specified all instruments are reported.
   --rover-nav      Output positions in Rover Navigation Frame
   --local-level    Output positions in Local Level frame.
   --site-frame     Output positions in Site Frame.
   --verbose        Enable verbose output.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import sys
import string
import numpy as np
import transforms3d

import pds
import transform
import geometry
import msl.rover

verbose_mode = False
output_frame = "RoverNavFrame"

def print_terse_output(filename, instruments):
    """Compute the arm turret position for a PDS image product
    and print output in terse format."""

    pds_header = pds.parse(filename)
    print_instrument_positions(pds_header, instruments)

def print_verbose_output(filename, instruments):
    """Compute the arm turret position for a PDS image product."""

    print "Computing arm position for " + filename

    pds_header = pds.parse(filename)
    print_instrument_positions(pds_header, instruments, True)

    instrument = pds_header["INSTRUMENT_ID"]
    if instrument == "MAHLI":
        print get_mahli_position(pds_header)

def print_instrument_positions(pds_header, instruments, verbose=False):
    """Print the position of the arm instruments.

    Parameters:
       pds_header:  PDS image header.
       instruments: List of instruments to output.
    """

    arm = msl.rover.ArmPose(pds_header)
    frame = transform.RoverNavFrame.from_header(pds_header)
    product_id = pds_header["PRODUCT_ID"]

    if verbose:
        print "\n==== Arm state ===="
        print "\nInstrument positions (", output_frame, "):\n"
        print string.join([ "Product_ID", "Instrument", "Pos_X", "Pos_Y", "Pos_Z", "Dir_X", "Dir_Y", "Dir_Z" ], ', ')

    for instrument in instruments:
        # Find the position of the instrument
        tool_position = arm.get_instrument_position(instrument)
        output_pos = to_output_frame(tool_position, frame)

        # Find the pointing direction
        tool_pointing = arm.get_instrument_pointing(instrument)
        output_pointing = direction_to_output_frame(tool_pointing, frame)

        print string.join([ product_id, instrument,
            str(output_pos[0]), str(output_pos[1]), str(output_pos[2]),
            str(output_pointing[0]), str(output_pointing[1]), str(output_pointing[2]) ], ', ')

    if verbose:
        instrument = pds_header["INSTRUMENT_ID"]
        if instrument == "MAHLI":
            print print_mahli_position(pds_header)

def print_mahli_position(pds_header):
    """Compute the position of the MAHLI camera, the pointing vector,
    and the look-at position."""

    print "\n==== MAHLI state ===="

    arm = msl.rover.ArmPose(pds_header)
    mahli_pos = arm.get_instrument_position("MAHLI")

    frame = transform.RoverNavFrame.from_header(pds_header)
    local_level_position = frame.to_local_level(mahli_pos)
    print "\nMAHLI position (", output_frame, "): ", to_output_frame(local_level_position, frame)

    cahvor = pds.camera_model(pds_header)

    print "\nCamera axis (rover nav frame): ", cahvor.A

    ground_plane = geometry.Plane(np.array([0, 0, -1]), 0)
    camera_ray = geometry.Ray(cahvor.C, cahvor.A)
    t = camera_ray.intersect(ground_plane)
    if t is None:
        print "No intersection"
    else:
        lookat = camera_ray.point_along_ray(t)
        print "\nMAHLI look at position (flat plane):"
        print "\tDistance to ground: ", t
        print "\tLook-at position: ", to_output_frame(lookat, frame), " (", output_frame, ")"

def to_output_frame(position, rover_nav_frame):
    """Convert a position in Rover Navigation Frame to the desired output frame."""
    if output_frame == "LocalLevel":
        return rover_nav_frame.to_local_level(position)
    elif output_frame == "SiteFrame":
        return rover_nav_frame.to_site_frame(position)
    return position # No conversion necessary

def direction_to_output_frame(direction, rover_nav_frame):
    """Convert a direction in Rover Navigation Frame to the desired output frame."""
    if output_frame == "LocalLevel":
        return rover_nav_frame.direction_to_local_level(direction)
    elif output_frame == "SiteFrame":
        return rover_nav_frame.direction_to_site_frame(direction)
    return direction # No conversion necessary

def parse_cmd_line_args(argv):
    global verbose_mode
    global output_frame
    
    instruments = []

    # Last argument is the filename, so parse elements up to the last.
    for arg in argv[1:-1]:
        if arg == "--rover-nav":
            output_frame = "RoverNavFrame"
        elif arg == "--local-level":
            output_frame = "LocalLevel"
        elif arg == "--site-frame":
            output_frame = "SiteFrame"
        elif arg == "--verbose":
            verbose_mode = True
        elif arg.lower() in msl.rover.instruments:
            instruments.append(arg.lower())
        else:
            print "Warning: unknown argument ", arg

    return instruments

if __name__ == "__main__":

    if len(sys.argv) == 1 or sys.argv[1] == "--help":
        print(__doc__)
        exit(1)

    output_instruments = parse_cmd_line_args(sys.argv)
    filename = sys.argv[-1]

    # If no instruments are specified on the command line then 
    # print position of all instruments.
    if len(output_instruments) == 0:
        output_instruments = msl.rover.instruments

    if verbose_mode:
        print_verbose_output(filename, output_instruments)
    else:
        print_terse_output(filename, output_instruments)
