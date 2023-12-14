# -*- coding: utf-8 -*-
import math
from collections import namedtuple

pi = math.pi
# FAI Sphere
radius_earth_meters = 6371000
# Google Earth Sphere Radius
# radius_earth_meters = 6378137
eligible_units = ['meters', 'kilometers',
                  'miles', 'feet', 'yards', 'nautical_miles']
Units = namedtuple('Units', field_names=eligible_units)
radius_earth = Units(
    meters=radius_earth_meters,
    kilometers=radius_earth_meters / 1000,
    miles=radius_earth_meters / 1609.344,
    feet=radius_earth_meters * 3.28084,
    nautical_miles=radius_earth_meters / 1852,
    yards=radius_earth_meters * 1.09361
)


#
# The following functions are redefined and passed to the math.* function because it is sometimes cumbersome to go
# math.* for all these functions.  Basically they are redefined here to make my life easier.
#

def sin(x):
    return math.sin(x)


def cos(x):
    return math.cos(x)


def asin(x):
    x = _test_domain(x)
    return math.asin(x)


def acos(x):
    x = _test_domain(x)
    return math.acos(x)


def atan2(y, x):
    return math.atan2(y, x)


def sqrt(x):
    return math.sqrt(x)


def _test_domain(x):
    if x > 1:
        return 1
    if x < -1:
        return -1
    return x
