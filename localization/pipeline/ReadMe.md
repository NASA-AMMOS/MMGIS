# Localization scripts

## Introduction

Command line tools to calculate the north, easting, and elevation (i.e. Localization) from PDS science products.

## Setup

select o

* on MIPL DEV Machines:

   % setenv MARS_CONFIG_PATH /home/hgengl/MSL/calibration/

* on MSL OPS machines:
   
   % setenv MARS_CONFIG_PATH /workspace/opgs/users/hgmslopgs/Instrument_Localization/msl/calibration


##Usage:

For rover/lander data:
    
    python InstLoc.py <PDS file or Label>
    
    or 
    
    python InstLocUber.py <inst> <sol>
    

For orbiter or sub-orbital data: 
    
    python OrbLoco.py <PDS file or Label>


For rover/lander data, the scripts output cartesian coordinates and other metadata. For orbiter data, the script outputs an image footprint and header file describing the data and for ingestion into GIS software.

Options:


##Installing:

This project has four dependencies:

1. NumPy - Python numerical processing
2. transforms3d - Python 3D transforms
3. arm_position - Python inverse-kinematics
4. VICAR base software package

The first two can be installed using pip:

    pip install numpy transforms3d

and the last copied in from the source code under the folder "localization/pipeline/arm_position" to your Python site-packages directory.

## Operating Environment
 This software expects a standard VICAR software setup on a linux machine. One additional VICAR program is needed, marspoint2xyz. marspoint2xyz is being added to the base code, so shouldn't require installing at this time.
 
## Unit Tests

Run the following command to test the localization scripts for a fixed, mast, and arm instrument test case.

python testInstloc.py

