# -*- coding: utf-8 -*-
from .__conversion import _point_to_radians, _point_to_degrees, _radians_to_degrees, \
    _degrees_to_radians
from .__error_checking import _error_check_point
from ._constants import *
from math import atan
from math import atan2
from math import cos
from math import radians
from math import sin
from math import sqrt
from math import tan

def distance_between_points(p1, p2, unit='meters', haversine=True, vincenty=False):
    """ This function computes the distance between two points in the unit given in the unit parameter.  It will
    calculate the distance using the haversine unless the user specifies haversine to be False.  Then law of cosines
    will be used
    :param p1: tuple point of (lon, lat)
    :param p2: tuple point of (lon, lat)
    :param unit: unit of measurement. List can be found in constants.eligible_units
    :param haversine: True (default) uses haversine distance, False uses law of cosines
    :param vincenty: False (default) uses vincenty distance, False haversine
    :return: Distance between p1 and p2 in the units specified.
    """
    lon1, lat1 = _point_to_radians(_error_check_point(p1))
    lon2, lat2 = _point_to_radians(_error_check_point(p2))
    r_earth = getattr(radius_earth, unit, 'meters')
    
    
    if vincenty:  # from https://nathanrooy.github.io/posts/2016-12-18/vincenty-formula-with-python/
        
        maxIter=200
        tol=10**-12
        a=6378137.0                             # radius at equator in meters (WGS-84)
        f=1/298.257223563                       # flattening of the ellipsoid (WGS-84)
        b=(1-f)*a

        phi_1,L_1,=[lon1, lat1]                       # (lat=L_?,lon=phi_?)
        phi_2,L_2,=[lon2, lat2]                  

        u_1=atan((1-f)*tan(radians(phi_1)))
        u_2=atan((1-f)*tan(radians(phi_2)))

        L=radians(L_2-L_1)

        Lambda=L                                # set initial value of lambda to L

        sin_u1=sin(u_1)
        cos_u1=cos(u_1)
        sin_u2=sin(u_2)
        cos_u2=cos(u_2)

        #--- BEGIN ITERATIONS -----------------------------+
        iters=0
        for i in range(0,maxIter):
            iters+=1
            
            cos_lambda=cos(Lambda)
            sin_lambda=sin(Lambda)
            sin_sigma=sqrt((cos_u2*sin(Lambda))**2+(cos_u1*sin_u2-sin_u1*cos_u2*cos_lambda)**2)
            cos_sigma=sin_u1*sin_u2+cos_u1*cos_u2*cos_lambda
            sigma=atan2(sin_sigma,cos_sigma)
            sin_alpha=(cos_u1*cos_u2*sin_lambda)/sin_sigma
            cos_sq_alpha=1-sin_alpha**2
            cos2_sigma_m=cos_sigma-((2*sin_u1*sin_u2)/cos_sq_alpha)
            C=(f/16)*cos_sq_alpha*(4+f*(4-3*cos_sq_alpha))
            Lambda_prev=Lambda
            Lambda=L+(1-C)*f*sin_alpha*(sigma+C*sin_sigma*(cos2_sigma_m+C*cos_sigma*(-1+2*cos2_sigma_m**2)))

            # successful convergence
            diff=abs(Lambda_prev-Lambda)
            if diff<=tol:
                break
            
        u_sq=cos_sq_alpha*((a**2-b**2)/b**2)
        A=1+(u_sq/16384)*(4096+u_sq*(-768+u_sq*(320-175*u_sq)))
        B=(u_sq/1024)*(256+u_sq*(-128+u_sq*(74-47*u_sq)))
        delta_sig=B*sin_sigma*(cos2_sigma_m+0.25*B*(cos_sigma*(-1+2*cos2_sigma_m**2)-(1/6)*B*cos2_sigma_m*(-3+4*sin_sigma**2)*(-3+4*cos2_sigma_m**2)))

        return b*A*(sigma-delta_sig) # output distance in meters 
        
    if haversine:
        # Haversine
        d_lat, d_lon = lat2 - lat1, lon2 - lon1
        a = sin(d_lat / 2) * sin(d_lat / 2) + cos(lat1) * \
            cos(lat2) * sin(d_lon / 2) * sin(d_lon / 2)
        c = 2 * atan2(sqrt(a), sqrt((1 - a)))
        dist = r_earth * c
        return dist
    # Spherical Law Of Cosines
    dist = acos(sin(lat1) * sin(lat2) + cos(lat1) *
                cos(lat2) * cos(lon2 - lon1)) * r_earth
    return dist


def bearing_at_p1(p1, p2):
    """ This function computes the bearing (i.e. course) at p1 given a destination of p2.  Use in conjunction with
    midpoint(*) and intermediate_point(*) to find the course along the route.  Use bearing_at_p2(*) to find the bearing
    at the endpoint
    :param p1: tuple point of (lon, lat)
    :param p2: tuple point of (lon, lat)
    :return: Course, in degrees
    """
    lon1, lat1 = _point_to_radians(_error_check_point(p1))
    lon2, lat2 = _point_to_radians(_error_check_point(p2))
    x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(lon2 - lon1)
    y = sin(lon2 - lon1) * cos(lat2)
    course = atan2(y, x)
    return _radians_to_degrees(course)


def bearing_at_p2(p1, p2):
    """ This function computes the bearing (i.e. course) at p2 given a starting point of p1.  Use in conjunction with
    midpoint(*) and intermediate_point(*) to find the course along the route.  Use bearing_at_p1(*) to find the bearing
    at the endpoint
    :param p1: tuple point of (lon, lat)
    :param p2: tuple point of (lon, lat)
    :return: Course, in degrees
    """
    return (bearing_at_p1(p2, p1) + 180) % 360


def midpoint(p1, p2):
    """ This is the half-way point along a great circle path between the two points.
    :param p1: tuple point of (lon, lat)
    :param p2: tuple point of (lon, lat)
    :return: point (lon, lat)
    """
    lon1, lat1 = _point_to_radians(_error_check_point(p1))
    lon2, lat2 = _point_to_radians(_error_check_point(p2))
    b_x = cos(lat2) * cos(lon2 - lon1)
    b_y = cos(lat2) * sin(lon2 - lon1)
    lat3 = atan2(sin(lat1) + sin(lat2), sqrt((cos(lat1) + b_x)
                                             * (cos(lat1) + b_x) + b_y * b_y))
    lon3 = lon1 + atan2(b_y, cos(lat1) + b_x)
    lat3 = _radians_to_degrees(lat3)
    lon3 = (_radians_to_degrees(lon3) + 540) % 360 - 180
    p3 = (lon3, lat3)
    return p3


def intermediate_point(p1, p2, fraction=0.5):
    """ This function calculates the intermediate point along the course laid out by p1 to p2.  fraction is the fraction
    of the distance between p1 and p2, where 0 is p1, 0.5 is equivalent to midpoint(*), and 1 is p2.
    :param p1: tuple point of (lon, lat)
    :param p2: tuple point of (lon, lat)
    :param fraction: the fraction of the distance along the path.
    :return: point (lon, lat)
    """
    lon1, lat1 = _point_to_radians(_error_check_point(p1))
    lon2, lat2 = _point_to_radians(_error_check_point(p2))
    delta = distance_between_points(p1, p2, vincenty=False) / radius_earth.meters
    a = sin((1 - fraction) * delta) / sin(delta)
    b = sin(fraction * delta) / sin(delta)
    x = a * cos(lat1) * cos(lon1) + b * cos(lat2) * cos(lon2)
    y = a * cos(lat1) * sin(lon1) + b * cos(lat2) * sin(lon2)
    z = a * sin(lat1) + b * sin(lat2)
    lat3 = atan2(z, sqrt(x * x + y * y))
    lon3 = atan2(y, x)
    return _point_to_degrees((lon3, lat3))


def point_given_start_and_bearing(p1, course, distance, unit='meters'):
    """ Given a start point, initial bearing, and distance, this will calculate the destina­tion point and final
    bearing travelling along a (shortest distance) great circle arc.
    :param p1: tuple point of (lon, lat)
    :param course: Course, in degrees
    :param distance: a length in unit
    :param unit: unit of measurement. List can be found in constants.eligible_units
    :return: point (lon, lat)
    """
    lon1, lat1 = _point_to_radians(_error_check_point(p1))
    brng = _degrees_to_radians(course)
    r_earth = getattr(radius_earth, unit, 'meters')
    delta = distance / r_earth
    lat2 = asin(sin(lat1) * cos(delta) + cos(lat1) * sin(delta) * cos(brng))
    lon2 = lon1 + atan2(sin(brng) * sin(delta) * cos(lat1),
                        cos(delta) - sin(lat1) * sin(lat2))
    lon2 = (_radians_to_degrees(lon2) + 540) % 360 - 180
    p2 = (lon2, _radians_to_degrees(lat2))
    return p2
