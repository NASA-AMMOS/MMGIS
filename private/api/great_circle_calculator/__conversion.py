# -*- coding: utf-8 -*-
from ._constants import *
from .__error_checking import _error_check_point


def _degrees_to_radians(degrees):
    """ Converts the degrees into radians
    :param degrees: decimal degrees
    :return: radians
    """
    return pi * degrees / 180


def _radians_to_degrees(radians):
    """ Converts the radians into degrees
    :param radians: decimal degrees
    :return: radians
    """
    return 180 * radians / pi


def _point_to_radians(point):
    point = _error_check_point(point)
    return (_degrees_to_radians(point[0]), _degrees_to_radians(point[1]))


def _point_to_degrees(point):
    return (_radians_to_degrees(point[0]), _radians_to_degrees(point[1]))
