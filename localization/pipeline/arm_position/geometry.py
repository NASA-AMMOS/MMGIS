"""
Common geometry classes.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

import math
import numpy as np

class Ray(object):
    """Ray defined by an origin point and a direction."""

    def __init__(self, origin, direction):
        """Create a ray from on origion and direction.

        Parameters:
            origin:    vector3 giving the ray origin.
            direction: vector3 giving ray direction.
        """
        self.origin = np.array(origin)
        self.direction = np.array(direction)

    def intersect(self, plane, epsilon=0.00001):
        """
        Compute the intersection of a ray and a plane.

        Parameters:
            plane: Plane to intersect with.
            epsilon: tolerance of floating point comparisons.

        Return:
            vector3 giving position of the ray/plane intersection, or None
            if the ray does not intersect the plane.
        """
        den = np.dot(self.direction, plane.normal)
        if math.fabs(den) < epsilon:
            return None

        result = (-plane.distance - np.dot(plane.normal, self.origin)) / den

        if result < 0.0:
            if result < -epsilon:
                return None
            result = 0.0
        return result

    def point_along_ray(self, distance):
        return self.origin + self.direction * distance

class Plane(object):
    """Plane defined by a normal vector and a distance from the
    coordinate system origin."""

    def __init__(self, normal, distance):
        """Create a new plane.

        Parameters:
            normal:   vector3 normal to the plane.
            distance: distance from the plane to the origin.
        """
        self.normal = normal
        self.distance = distance
