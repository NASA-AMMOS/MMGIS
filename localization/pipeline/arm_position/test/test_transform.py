"""
Unit test for coordinate transformation code.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import sys
import unittest
import numpy as np
import transforms3d
import transform

import msl.rover

EPSILON = 1e-3 # Consider positions equal if under this tolerance

class TransformTestCase(unittest.TestCase):

    def setUp(self):
        # Rotation and offset for RMC 31/1330, from NLB_451559018RASLF0311330NCAM00352M1
        origin_rotation_quaternion = np.array([ 0.883773, 0.0252917, 0.0771217, -0.460822 ])
        origin_offset = np.array([ -85.4875, -59.027, 1.74495 ])

        self.frame = transform.RoverNavFrame(origin_rotation_quaternion, origin_offset)

    def test_rover_to_local_level(self):
        expected = np.array([ 0.695613436478283, -0.110230168764992, -2.02411894970523 ])

        mast_rover = msl.rover.mast_position()
        actual = self.frame.to_local_level(mast_rover)

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Conversion of mast position from Rover Nav to Local Level is incorrect")

    def test_rover_direction_to_local_level(self):
        expected = np.array([ 0.563390681662978, -0.810623007353404, -0.159626094922277 ])

        actual = self.frame.direction_to_local_level(np.matrix([1, 0, 0]))

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Conversion of direction from Rover Nav to Local Level is incorrect")

    def test_rover_direction_to_site_frame(self):
        expected = np.array([ 0.563390681662978, -0.810623007353404, -0.159626094922277 ])

        actual = self.frame.direction_to_site_frame(np.matrix([1, 0, 0]))

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Conversion of direction from Rover Nav to Local Level is incorrect")
