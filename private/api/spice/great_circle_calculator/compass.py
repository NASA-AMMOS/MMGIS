# -*- coding: utf-8 -*-
# This collection of classes just let me call something like compass.east to get 90 degrees.

from collections import namedtuple


class CompassSimple:
    """ A class to use one of the 32 compass points inplace of degrees.  This was made so I could just call
    compass.east to get 90 degrees.
    """
    north = N = 0
    north_by_east = NbE = 11.25
    north_northeast = NNE = 22.5
    northeast_by_north = NEbN = 33.75
    northeast = NE = 45
    northeast_by_east = NEbE = 56.25
    east_northeast = ENE = 67.5
    east_by_north = EbN = 78.75
    east = E = 90
    east_by_south = EbS = 101.25
    east_southeast = ESE = 112.5
    southeast_by_east = SEbE = 123.75
    southeast = SE = 135
    southeast_by_south = SEbS = 146.25
    south_southeast = SSE = 157.5
    south_by_east = SbE = 168.75
    south = S = 180
    south_by_west = SbW = 191.25
    south_southwest = SSW = 202.5
    southwest_by_south = SWbS = 213.75
    southwest = SW = 225
    southwest_by_west = SWbW = 236.25
    west_southwest = WSW = 247.5
    west_by_south = WbS = 258.75
    west = W = 270
    west_by_north = WbN = 281.25
    west_northwest = WNW = 292.5
    northwest_by_west = NWbW = 303.75
    northwest = NW = 315
    northwest_by_north = NWbN = 326.25
    north_northwest = NNW = 337.5
    north_by_west = NbW = 348.75


class CompassComplex:
    """ This class contains more information then the CompassSimple class.
    Recommended to use import CompassComplex as compass.
    """
    CompassPoint = namedtuple('CompassPoint', [
                              'Point', 'Abbr', 'WindPoint', 'Minimum', 'Direction', 'Maximum'])
    compass = dict()
    compass['north'] = compass['N'] = north = N = CompassPoint(
        'north', 'N', 'Tramontana', 354.375, 0.000, 5.625)
    compass['north by east'] = compass['NbE'] = north_by_east = NbE = CompassPoint('north by east', 'NbE',
                                                                                   'Quarto di Tramontana verso Greco',
                                                                                   5.625, 11.250, 16.875)
    compass['north-northeast'] = compass['NNE'] = north_northeast = NNE = CompassPoint('north-northeast', 'NNE',
                                                                                       'Greco-Tramontana', 16.875,
                                                                                       22.500, 28.125)
    compass['northeast by north'] = compass['NEbN'] = northeast_by_north = NEbN = CompassPoint('northeast by north',
                                                                                               'NEbN',
                                                                                               'Quarto di Greco verso Tramontana',
                                                                                               28.125, 33.750, 39.375)
    compass['northeast'] = compass['NE'] = northeast = NE = CompassPoint('northeast', 'NE', 'Greco', 39.375, 45.000,
                                                                         50.625)
    compass['northeast by east'] = compass['NEbE'] = northeast_by_east = NEbE = CompassPoint('northeast by east',
                                                                                             'NEbE',
                                                                                             'Quarto di Greco verso Levante',
                                                                                             50.625, 56.250, 61.875)
    compass['east-northeast'] = compass['ENE'] = east_northeast = ENE = CompassPoint('east-northeast', 'ENE',
                                                                                     'Greco-Levante', 61.875, 67.500,
                                                                                     73.125)
    compass['east by north'] = compass['EbN'] = east_by_north = EbN = CompassPoint('east by north', 'EbN',
                                                                                   'Quarto di Levante verso Greco',
                                                                                   73.125, 78.750, 84.375)
    compass['east'] = compass['E'] = east = E = CompassPoint(
        'east', 'E', 'Levante', 84.375, 90.000, 95.625)
    compass['east by south'] = compass['EbS'] = east_by_south = EbS = CompassPoint('east by south', 'EbS',
                                                                                   'Quarto di Levante verso Scirocco',
                                                                                   95.625, 101.250, 106.875)
    compass['east-southeast'] = compass['ESE'] = east_southeast = ESE = CompassPoint('east-southeast', 'ESE',
                                                                                     'Levante-Scirocco', 106.875,
                                                                                     112.500, 118.125)
    compass['southeast by east'] = compass['SEbE'] = southeast_by_east = SEbE = CompassPoint('southeast by east',
                                                                                             'SEbE',
                                                                                             'Quarto di Scirocco verso Levante',
                                                                                             118.125, 123.750, 129.375)
    compass['southeast'] = compass['SE'] = southeast = SE = CompassPoint('southeast', 'SE', 'Scirocco', 129.375,
                                                                         135.000, 140.625)
    compass['southeast by south'] = compass['SEbS'] = southeast_by_south = SEbS = CompassPoint('southeast by south',
                                                                                               'SEbS',
                                                                                               'Quarto di Scirocco verso Ostro',
                                                                                               140.625, 146.250,
                                                                                               151.875)
    compass['south-southeast'] = compass['SSE'] = south_southeast = SSE = CompassPoint('south-southeast', 'SSE',
                                                                                       'Ostro-Scirocco', 151.875,
                                                                                       157.500, 163.125)
    compass['south by east'] = compass['SbE'] = south_by_east = SbE = CompassPoint('south by east', 'SbE',
                                                                                   'Quarto di Ostro verso Scirocco',
                                                                                   163.125, 168.750, 174.375)
    compass['south'] = compass['S'] = south = S = CompassPoint(
        'south', 'S', 'Ostro', 174.375, 180.000, 185.625)
    compass['south by west'] = compass['SbW'] = south_by_west = SbW = CompassPoint('south by west', 'SbW',
                                                                                   'Quarto di Ostro verso Libeccio',
                                                                                   185.625, 191.250, 196.875)
    compass['south-southwest'] = compass['SSW'] = south_southwest = SSW = CompassPoint('south-southwest', 'SSW',
                                                                                       'Ostro-Libeccio', 196.875,
                                                                                       202.500, 208.125)
    compass['southwest by south'] = compass['SWbS'] = southwest_by_south = SWbS = CompassPoint('southwest by south',
                                                                                               'SWbS',
                                                                                               'Quarto di Libeccio verso Ostro',
                                                                                               208.125, 213.750,
                                                                                               219.375)
    compass['southwest'] = compass['SW'] = southwest = SW = CompassPoint('southwest', 'SW', 'Libeccio', 219.375,
                                                                         225.000, 230.625)
    compass['southwest by west'] = compass['SWbW'] = southwest_by_west = SWbW = CompassPoint('southwest by west',
                                                                                             'SWbW',
                                                                                             'Quarto di Libeccio verso Ponente',
                                                                                             230.625, 236.250, 241.875)
    compass['west-southwest'] = compass['WSW'] = west_southwest = WSW = CompassPoint('west-southwest', 'WSW',
                                                                                     'Ponente-Libeccio', 241.875,
                                                                                     247.500, 253.125)
    compass['west by south'] = compass['WbS'] = west_by_south = WbS = CompassPoint('west by south', 'WbS',
                                                                                   'Quarto di Ponente verso Libeccio',
                                                                                   253.125, 258.750, 264.375)
    compass['west'] = compass['W'] = west = W = CompassPoint(
        'west', 'W', 'Ponente', 264.375, 270.000, 275.625)
    compass['west by north'] = compass['WbN'] = west_by_north = WbN = CompassPoint('west by north', 'WbN',
                                                                                   'Quarto di Ponente verso Maestro',
                                                                                   275.625, 281.250, 286.875)
    compass['west-northwest'] = compass['WNW'] = west_northwest = WNW = CompassPoint('west-northwest', 'WNW',
                                                                                     'Maestro-Ponente', 286.875,
                                                                                     292.500, 298.125)
    compass['northwest by west'] = compass['NWbW'] = northwest_by_west = NWbW = CompassPoint('northwest by west',
                                                                                             'NWbW',
                                                                                             'Quarto di Maestro verso Ponente',
                                                                                             298.125, 303.750, 309.375)
    compass['northwest'] = compass['NW'] = northwest = NW = CompassPoint('northwest', 'NW', 'Maestro', 309.375, 315.000,
                                                                         320.625)
    compass['northwest by north'] = compass['NWbN'] = northwest_by_north = NWbN = CompassPoint('northwest by north',
                                                                                               'NWbN',
                                                                                               'Quarto di Maestro verso Tramontana',
                                                                                               320.625, 326.250,
                                                                                               331.875)
    compass['north-northwest'] = compass['NNW'] = north_northwest = NNW = CompassPoint('north-northwest', 'NNW',
                                                                                       'Maestro-Tramontana', 331.875,
                                                                                       337.500, 343.125)
    compass['north by west'] = compass['NbW'] = north_by_west = NbW = CompassPoint('north by west', 'NbW',
                                                                                   'Quarto di Tramontana verso Maestro',
                                                                                   343.125, 348.750, 354.375)

    full_name = ['north', 'north by east', 'north-northeast', 'northeast by north', 'northeast', 'northeast by east',
                 'east-northeast', 'east by north', 'east', 'east by south', 'east-southeast', 'southeast by east',
                 'southeast', 'southeast by south', 'south-southeast', 'south by east', 'south', 'south by west',
                 'south-southwest', 'southwest by south', 'southwest', 'southwest by west', 'west-southwest',
                 'west by south', 'west', 'west by north', 'west-northwest', 'northwest by west', 'northwest',
                 'northwest by north', 'north-northwest', 'north by west']
    abbr = ['N', 'NbE', 'NNE', 'NEbN', 'NE', 'NEbE', 'ENE', 'EbN', 'E', 'EbS', 'ESE', 'SEbE', 'SE', 'SEbS', 'SSE',
            'SbE', 'S', 'SbW', 'SSW', 'SWbS', 'SW', 'SWbW', 'WSW', 'WbS', 'W', 'WbN', 'WNW', 'NWbW', 'NW', 'NWbN',
            'NNW', 'NbW']

    def __init__(self):
        """
        Initializer for the Compass Class
        """
        pass

    def get_point(self, heading):
        return self._get_dir_name(heading, self.full_name)

    def get_abbr(self, heading):
        return self._get_dir_name(heading, self.abbr)

    def _get_dir_name(self, heading, type):
        """
        General case for finding the direction
        :param heading:
        :param type:
        :return:
        """
        heading = heading % 360
        for point in type:
            if self.compass[point].Direction == 0:
                if self.compass[point].Minimum <= heading <= 360.0 or 0.0 <= heading < self.compass[point].Maximum:
                    return point
            elif self.compass[point].Minimum <= heading < self.compass[point].Maximum:
                return point


if __name__ == '__main__':
    import math
    print(CompassComplex.get_point(CompassComplex(), 200))
    print(CompassComplex.get_point(0))
    print(CompassComplex.get_point(360))
    print(CompassComplex.get_point(100))
    print(CompassComplex.get_point(2 * math.pi))
    print(CompassComplex.get_point(-15))
    print(CompassComplex.get_point(-360))
    print(CompassComplex.get_point(400))
    print(CompassComplex.get_point(-600))
    print(CompassComplex.N)
    print(CompassComplex.E.Direction)
