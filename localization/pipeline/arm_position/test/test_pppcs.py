"""
Unit test for arm kinimatic pointing code. Angles and expected joint positions
were determined using the OnSight Terrain Pipeline rover mask generator.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import sys
import unittest
import numpy as np

from msl.pppcs import *

EPSILON = 1e-3 # Consider positions equal if under this tolerance

class ArmKinematicsTestCase(unittest.TestCase):

    def setUp(self):
        self.arm1 = 1.56834
        self.arm2 = -0.27772
        self.arm3 = -2.82549
        self.arm4 = 3.11658
        self.arm5 = 0.593527

        self.unit_w = np.matrix([0, 0, 0, 1]).transpose()

    def test_arm_joint_2(self):
        expected = np.array([ 1.20328281066717, -0.295500535746813, -0.854500005960465, 1])
        expected.shape = (4, 1)

        actual = RVRdARM2(self.arm1) * self.unit_w

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Arm joint 2 position incorrect")

    def test_arm_joint_3(self):
        expected = np.array([1.20538746331293, 0.499808545815788, -1.08123340716393, 1])
        expected.shape = (4, 1)

        actual = RVRdARM3(self.arm1, self.arm2) * self.unit_w

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Arm joint 3 position incorrect")

    def test_arm_joint_4(self):
        expected = np.array([1.20331162923131, -0.284610536473734, -1.11135639262238, 1])
        expected.shape = (4, 1)

        actual = RVRdARM4(self.arm1, self.arm2, self.arm3) * self.unit_w

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Arm joint 3 position incorrect")

    def test_arm_joint_5(self):
        expected = np.array([1.03653117497397, -0.428156948142379, -1.11327153615959, 1])
        expected.shape = (4, 1)

        actual = RVRdARM5(self.arm1, self.arm2, self.arm3, self.arm4) * self.unit_w

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Arm joint 4 position incorrect")

    def test_arm_joint_6(self):
        expected = np.array([1.03653714757695, -0.425900012584941, -1.28295652726433, 1])
        expected.shape = (4, 1)

        actual = RVRdARM6(self.arm1, self.arm2, self.arm3, self.arm4, self.arm5) * self.unit_w

        error = np.sum(np.fabs(expected - actual))
        self.assertLessEqual(error, EPSILON, "Arm joint 5 position incorrect")

if __name__ == '__main__':
    unittest.main()
