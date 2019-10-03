"""
CAHVOR camera model.

Author: Parker Abercrombie <parker.abercrombie@jpl.nasa.gov>
"""

class CAHVOR(object):

    def __init__(self, c, a, h, v, o, r):
        self.C = c
        self.A = a
        self.H = h
        self.V = v
        self.O = o
        self.R = r
