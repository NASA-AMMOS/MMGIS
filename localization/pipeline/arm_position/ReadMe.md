# Rover Arm Position script

## Introduction

Command line tool to extract rover arm position from PDS images.

##Usage:

    python arm-position.py [--rover-nav | --local-level | --site-frame] <PDS image file>

The script outputs the position and pointing direction of each instrument in the following format (where pos is the position of the instrument and dir is the pointing direction):
	product_id, instrument, pos_x, pos_y, pos_z, dir_x, dir_y, dir_z

Options:

    --rover-nav      Output positions and directions in Rover Navigation Frame
    --local-level    Output positions and directions in Local Level frame
    --site-frame     Output positions and directions in Site Frame

##Installing:

This project has two dependencies:

1. NumPy
2. transforms3d

These can be installed using pip:

    pip install numpy transforms3d
