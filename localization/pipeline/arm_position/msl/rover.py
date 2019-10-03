"""
Routines for handling articulation of the MSL rover.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import math
import numpy as np
import pds
import transforms3d
from msl import pppcs

INVALID_ARM_ANGLE = 1e30

instruments = [ 'mahli', 'apxs', 'drill', 'drt', 'portioner', 'scoopbase' ]

tool_transforms = {
    'mahli'     : pppcs.RVRdMAHLI,
    'apxs'      : pppcs.RVRdAPXS,
    'drill'     : pppcs.RVRdDrill,
    'drt'       : pppcs.RVRdDRT,
    'portioner' : pppcs.RVRdPortioner,
    'scoopbase' : pppcs.RVRdScoopBase
}

def mast_position():
    """Indicates mast position in rover navigation frame."""
    return np.array([ 0.80436, 0.55942, -1.90608 ])

class ArmPose(object):

    def __init__(self, pds_header):
        # Some PDS files use non-standard names for the arm group. Try a couple variations.
        possible_groups = [
            "ARM_ARTICULATION_STATE",
            "ARM_ARTICULATION_STATE_PARMS"
        ]

        for group_key in possible_groups:
            if group_key in pds_header:
                arm_group = pds_header[group_key]
                self.init_arm_angles(arm_group)
                break

    def get_instrument_position(self, instrument):
        """Compute the position (in rover nav frame) of an instrument on the arm turret."""
        try:
            func = tool_transforms[instrument]
        except KeyError:
            raise ValueError("Unsupported instrument: " + instrument)

        mat = func(
                self.arm_angle_1,
                self.arm_angle_2,
                self.arm_angle_3,
                self.arm_angle_4,
                self.arm_angle_5)

        vec4 = mat * np.matrix([0, 0, 0, 1]).transpose()
        return np.squeeze(np.asarray(vec4[0:3])) # Discard w coord

    def get_instrument_pointing(self, instrument):
        """Compute the pointing direction (in rover nav frame) of an instrument on the arm turret."""
        try:
            func = tool_transforms[instrument]
        except KeyError:
            raise ValueError("Unsupported instrument: " + instrument)

        mat = func(
                self.arm_angle_1,
                self.arm_angle_2,
                self.arm_angle_3,
                self.arm_angle_4,
                self.arm_angle_5)

        # Z-axis is pointing axis. Transform the Z direction in the
        # instrument coordinate system to rover nav frame. See
        # Figure 3 on Page 14 of the PPCS document.

        # (Note the PPPCS doc includes a note on page 10 that states that the
        # pointing axis changed to X in Dec 2008, and that updated transform
        # matrices would be included in a later revision of the document. However,
        # I have not been able to find this updated document. The use of Z as the
        # pointing axis is consistent with the 2009-01-09 version of the PPPCS doc.)
        vec4 = mat * np.matrix([0, 0, 1, 0]).transpose()
        direction = np.squeeze(np.asarray(vec4[0:3])) # Discard w coord
        return transforms3d.utils.normalized_vector(direction) # Normalize

    def get_turret_position(self):
        mat = pppcs.RVRdARM6(
            self.arm_angle_1,
            self.arm_angle_2,
            self.arm_angle_3,
            self.arm_angle_4,
            self.arm_angle_5)

        return mat * np.matrix([0, 0, 0, 1]).transpose()

    ##############################
    ## PDS image parsing
    ##############################

    def init_arm_angles(self, arm_group):
        arm_angles = self.parse_angles(arm_group)

        self.arm_angle_1 = self.get_arm_angle(arm_angles, ["JOINT 1 AZIMUTH", "JOINT 1 SHOULDER AZIMUTH"])
        self.arm_angle_2 = self.get_arm_angle(arm_angles, ["JOINT 2 ELEVATION", "JOINT 2 SHOULDER ELEVATION"])
        self.arm_angle_3 = self.get_arm_angle(arm_angles, ["JOINT 3 ELBOW"])
        self.arm_angle_4 = self.get_arm_angle(arm_angles, ["JOINT 4 WRIST"])
        self.arm_angle_5 = self.get_arm_angle(arm_angles, ["JOINT 5 TURRET"])

    def parse_angles(self, arm_group):

        angle_strings = arm_group["ARTICULATION_DEVICE_ANGLE"]
        angles = [self.parse_angle(ss) for ss in angle_strings]
        angle_names = arm_group["ARTICULATION_DEVICE_ANGLE_NAME"]

        if len(angles) != len(angle_names):
            raise ValueError("Malformed image header. Length of articulation angle list should match length of angle name list")

        angle_dict = {}
        for i, name in enumerate(angle_names):
            name = name.strip()
            angle_dict[name] = angles[i]
        return angle_dict

    def get_arm_angle(self, arm_group, possible_joint_names):
        """Read an arm angle from a parsed dictionary of angles.

        This method first attempts to read the resolver angle for the given joint.
        If the resolver angle is missing or invalid (1e30), then the method reads
        the corresponding encoder angle.

        In some cases, images contain an incorrect resolver angle that is very different 
        than the encoder angle. This method detects cases in which the resolver angle is
        more than 10 degrees different than the encoder angle. In these cases, the encoder
        angle is returned.

        Parameters:
          angleDict: Dictionary of named angles
          possible_joint_names: List of names of the joint for which to retrieve angle. Some
               APXS files have been known to use non-standard names for some angles
               (e.g. "JOINT 1 AZIMUTH", "JOINT 1 SHOULDER AZIMUTH"). The first name that matches an
               angle in the file header will be returned.

        Returns:
           Joint angle in radians.
        """

        for joint in possible_joint_names:
            resolver_key = joint + "-RESOLVER"
            encoder_key = joint + "-ENCODER"

            # Parse out resolver and encoder angles, and then decide which to use
            resolver_angle = arm_group[resolver_key] if resolver_key in arm_group else None
            encoder_angle = arm_group[encoder_key] if encoder_key in arm_group else None
            raw_angle = arm_group[joint] if joint in arm_group else None

            # In the normal case we have both resolver and encoder angles
            if resolver_angle is not None and encoder_angle is not None:
                return self.choose_resolver_or_encoder_angle(resolver_angle, encoder_angle)
            elif resolver_angle is not None:
                # Only have the resolver angle. Return it as long as it is valid.
                return resolver_angle if self.is_valid_arm_angle(resolver_angle) else None
            elif encoder_angle is not None:
                return encoder_angle if self.is_valid_arm_angle(encoder_angle) else None
            elif raw_angle is not None:
                return raw_angle if self.is_valid_arm_angle(raw_angle) else None

        # Unable to find any of the possible angle names.
        raise KeyError("Unable to find angle for joint " + joint)

    def choose_resolver_or_encoder_angle(self, resolver_angle, encoder_angle, resolver_tolerance_degrees=10):
        """Return either the resolver or encoder angle for a joint, preferring the resolver angle.

        In normal cases the encoder and resolver angles are similar. In some abnormal cases resolver
        angles that are very wrong. Detect cases in which the two angles are very different, and
        return the encoder angle in those cases (if it is valid).

        Parameters:
           resolverToleranceDegrees: Use resolver angle is resolver and encoder are within
                this tolerance. If angles are not within this tolerance, assume that resolver
                is incorrect and return encoder
        """

        if self.is_valid_arm_angle(resolver_angle):
            angles_very_different = math.fabs(resolver_angle - encoder_angle) > math.degrees(resolver_tolerance_degrees)
            if angles_very_different and is_valid_arm_angle(encoder_angle):
                print("Resolver and encoder angles more than " + resolver_tolerance_degrees +
                 " degrees different. Using encoder angle. (" + filename + ")")
                return encoder_angle
            return resolver_angle

        return encoder_angle

    def is_valid_arm_angle(self, angle, epsilon=1e-10):
        """Determine if an arm joint angle represents a valid measurement.

        This function compares an angle to the Invalid Angle value specified in PPPS Vol 6.

        Parameters:
          angle: Angle to test
          epsilon: Epsilon value for floating point comparison. Consider angle invalid if within this number
                   of radians of the invalid angle value.
        """
        return math.fabs(angle - INVALID_ARM_ANGLE) > epsilon

    def parse_angle(self, angle_str):
        """Parse an angle from a string in the form "##.#### <rad>".
        
        Parameters:
           angle_str: String to parse

        Return:
           Angle in radians.
        """

        parts = angle_str.strip().split(' ')

        # Invalid angles don't always have <rad> on them.  If this angle is invalid
        # don't assert that we need <rad> to be specified
        if len(parts) == 1:
            d = float(parts[0])
            if not is_valid_arm_angle(d):
                return d

        if len(parts) != 2:
            raise ValueError("Unexpected angle format: " + angle_str + ". Expecting '##.### <rad>'")
        if parts[1] != "<rad>":
            raise NotImplementedError("Parsing non-radian angles is not supported")

        return float(parts[0])
