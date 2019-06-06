import sys
import numpy as np
import transforms3d
import pds

def translation_matrix(vector):
    """Create a 4x4 translation matrix from a 3 element vector."""
    return np.matrix([
        [ 1, 0, 0, vector[0] ],
        [ 0, 1, 0, vector[1] ],
        [ 0, 0, 1, vector[2] ],
        [ 0, 0, 0, 1 ]])

class RoverNavFrame(object):

    def __init__(self, origin_quaterion, origin_offset):
        self.origin_rotation = origin_quaterion
        self.origin_offset = origin_offset

    @classmethod
    def from_header(self, pds_header):
        frame = RoverNavFrame(
            pds.origin_rotation_quaterion(pds_header),
            pds.origin_offset_vector(pds_header))
        return frame

    def to_local_level(self, vector):
        """Convert a point in Rover Navigation Frame to Local Level Frame."""
        return transforms3d.quaternions.rotate_vector(vector, self.origin_rotation)

    def to_site_frame(self, vector):
        """Convert a point in Rover Navigation Frame to Site Frame."""
        pos_local_level = self.to_local_level(vector)
        return pos_local_level + self.origin_offset

    def direction_to_local_level(self, vector):
        """Convert a direction in Rover Navigation Frame to Local Level."""
        return self.to_local_level(vector) # Rotation only, no translation

    def direction_to_site_frame(self, vector):
        """Convert a direction in Rover Navigation Frame to Site Frame."""
        # Directions in site frame are the same as in local level, so just convert to local level
        return self.direction_to_local_level(vector)
