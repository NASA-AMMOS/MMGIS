"""
Rover arm transforms for the Mars Science Laboratory.

Transformations in this file come from document MSL-476-1303,
"Mars Science Laboratory Pointing, Positioning, Phasing & Coordinate
Systems (PPPCS) Document, Volume 6"

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import numpy as np
from math import sin, cos, radians

#############################################################
## Transforms from arm joints and tools to rover nav frame.
#############################################################

def RVRdARM1():
    """Transform matrix from Arm Azimuth Joint (joint 1) to rover nav frame."""
    return MechFrameToNavFrame() * RVRdARM0() * ARM0dARM1()

def RVRdARM2(a1):
    """Transform matrix from Arm Elevation Joint (joint 2) to Rover Navigation frame.

    Parameters:
       a1: Arm azimuth joint angle (radians).

    Returns:
        4x4 transformation matrix to convert point in coordinate
        space of Arm Azimuth Joint to Rover Navigation Frame.
    """
    return RVRdARM1() * ARM1dARM2(a1)

def RVRdARM3(a1, a2):
    """Transform matrix from Arm Elbow Joint (joint 3) to Rover Navigation frame.

    Parameters:
       a1: Arm azimuth joint angle (radians).
       a2: Arm elevation joint angle (radians).

    Returns:
        4x4 transformation matrix to convert point in coordinate
        space of Arm Elevation Joint to Rover Navigation Frame.
    """
    return RVRdARM2(a1) * ARM2dARM3(a2)

def RVRdARM4(a1, a2, a3):
    """Transform matrix from Arm Wrist Joint (joint 4) to Rover Navigation frame.

    Parameters:
       a1: Arm azimuth joint angle (radians).
       a2: Arm elevation joint angle (radians).
       a3: Arm elbow joint angle (radians).

    Returns:
        4x4 transformation matrix to convert point in coordinate
        space of Arm Wrist Joint to Rover Navigation Frame.
    """
    return RVRdARM3(a1, a2) * ARM3dARM4(a3)

def RVRdARM5(a1, a2, a3, a4):
    """Transform matrix from Arm Turret Joint (joint 5) to Rover Navigation frame.

    Parameters:
       a1: Arm azimuth joint angle (radians).
       a2: Arm elevation joint angle (radians).
       a3: Arm elbow joint angle (radians).
       a3: Arm wrist joint angle (radians).

    Returns:
        4x4 transformation matrix to convert point in coordinate
        space of Arm Turret Joint to Rover Navigation Frame.
    """
    return RVRdARM4(a1, a2, a3) * ARM4dARM5(a4)

def RVRdARM6(a1, a2, a3, a4, a5):
    """Transform matrix from Arm Turret Interface Joint (joint 6) to Rover Navigation frame.

    Parameters:
       a1: Arm azimuth joint angle (radians).
       a2: Arm elevation joint angle (radians).
       a3: Arm elbow joint angle (radians).
       a3: Arm wrist joint angle (radians).
       a4: Arm turret joint angle (radians).

    Returns:
        4x4 transformation matrix to convert point in coordinate
        space of Arm Turret Interface Joint to Rover Navigation Frame.
    """
    return RVRdARM5(a1, a2, a3, a4) * ARM5dARM6(a5)

def RVRdTurret(a1, a2, a3, a4, a5):
    return RVRdARM6(a1, a2, a3, a4, a5) * ARM6dTurret()

def RVRdMAHLI(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDMAHLI()

def RVRdDrill(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDDrill()

def RVRdDRT(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDDRT()

def RVRdAPXS(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDAPXS()

def RVRdPortioner(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDPortioner()

def RVRdScoopBase(a1, a2, a3, a4, a5):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDScoopBase()

def RVRdScoopJoint(theta):
    return RVRdTurret(a1, a2, a3, a4, a5) * TurretDScoopBase(theta)

###########################
## Transform matrices
###########################

def RVRdARM0():
    return np.matrix([
        [ 1, 0, 0, 0.82785 ],
        [ 0, 1, 0,  -0.561 ],
        [ 0, 0, 1,   0.225 ],
        [ 0, 0, 0,       1 ]])

def ARM0dARM1():
    return np.matrix([
        [ 1, 0, 0,  0.285 ],
        [ 0, 1, 0, 0.1095 ],
        [ 0, 0, 1,  0.041 ],
        [ 0, 0, 0,      1 ]])

def ARM1dARM2(a1):
    return np.matrix([
        [ cos(a1), 0,  sin(a1), 0.156 * cos(a1) ],
        [ sin(a1), 0, -cos(a1), 0.156 * sin(a1) ],
        [       0, 1,        0,               0 ],
        [       0, 0,        0,               1 ]])

def ARM2dARM3(a2):
    return np.matrix([
        [ cos(a2), -sin(a2), 0, 0.827 * cos(a2) ],
        [ sin(a2),  cos(a2), 0, 0.827 * sin(a2) ],
        [       0,        0, 1,               0 ],
        [       0,        0, 0,               1 ]])

def ARM3dARM4(a3):
    return np.matrix([
        [ cos(a3), -sin(a3), 0, 0.785 * cos(a3) ],
        [ sin(a3),  cos(a3), 0, 0.785 * sin(a3) ],
        [       0,        0, 1,               0 ],
        [       0,        0, 0,               1 ]])

def ARM4dARM5(a4):
    return np.matrix([
        [ cos(a4),  0, -sin(a4), -0.144 * cos(a4) ],
        [ sin(a4),  0,  cos(a4), -0.144 * sin(a4) ],
        [       0, -1,        0,          -0.1664 ],
        [       0,  0,        0,                1 ]])

def ARM5dARM6(a5):
    return np.matrix([
        [ cos(a5), -sin(a5), 0,       0 ],
        [ sin(a5),  cos(a5), 0,       0 ],
        [       0,        0, 1, -0.1697 ],
        [       0,        0, 0,       1 ]])

def ARM6dTurret():
    return np.matrix([
        [ 0, 0, 1,      0 ],
        [ 1, 0, 0,      0 ],
        [ 0, 1, 0, -0.07176 ],
        [ 0, 0, 0,      1 ]])

def TurretDDrill():
    return np.matrix([
        [ 1, 0, 0,      0 ],
        [ 0, 1, 0,      0 ],
        [ 0, 0, 1, 0.2865 ],
        [ 0, 0, 0,      1 ]])

def TurretDDRT():
    return np.matrix([
        [  0.347427, 0, 0.937707, 0.280374 ],
        [         0, 1,        0,   -0.015 ],
        [ -0.937707, 0, 0.347427, 0.103881 ],
        [         0, 0,        0,         1]])

def TurretDMAHLI():
    return np.matrix([
        [ -0.573576, 0,  0.819152,  0.243501 ],
        [         0, 1,         0,    -0.008 ],
        [ -0.819152, 0, -0.573576, -0.170501 ],
        [         0, 0,         0,         1 ]])

def TurretDAPXS():
    return np.matrix([
        [ -0.681998, 0, -0.731354, -0.218134 ],
        [         0, 1,         0,  -0.00536 ],
        [  0.731354, 0, -0.681998, -0.203413 ],
        [         0, 0,         0,         1 ]])

def TurretDPortioner():
    return np.matrix([
        [ 0.00366518, 0,  -0.999993,  -0.276088],
        [          0, 1,          0,   -0.03873],
        [   0.999993, 0, 0.00366518, 0.00101192],
        [          0, 0,          0,         1 ]])

def TurretDScoopBase():
    return np.matrix([
        [ 1,  0, 0, -0.22422 ],
        [ 0,  0, 1 , -0.7409 ],
        [ 0, -1, 0,  0.12141 ],
        [ 0,  0, 0,        1 ]])

def TurretDScoopJoint(theta):
    phi = math.radians(205 + theta)
    return np.matrix([
        [ cos(phi), 0,  sin(phi),  0.10089 * sin(phi) ],
        [ sin(phi), 0, -cos(phi), -0.10089 * cos(phi) ],
        [        0, 1,         0,                   0 ],
        [        0, 0,         0,                   1 ]])

def MechFrameToNavFrame():
    return np.matrix([
        [ 1, 0, 0, 0.09002 ],
        [ 0, 1, 0,        0],
        [ 0, 0, 1, -1.1205 ],
        [ 0, 0, 0,       1 ]])
