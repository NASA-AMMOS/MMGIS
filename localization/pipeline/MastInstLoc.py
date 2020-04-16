#! /usr/local/msl/bin/python
# ******************************************************************************
#  MastInstLoc.py <image.IMG>
#
#  Project:  Mast Instrument Localization
#  Purpose:  Localizations for Mast instrument observations on planetary surface
#
#  Author:   Hallie Gengl
#
# ******************************************************************************

import parseVicarLabel
import msl.instruments as instruments
import numpy as np
import MastRangeCoord
import msl.placesTranslation as places



def allLoc(filen):
    print "Entering " + __name__ + ".MastInstLoc.py"
    print "Running allLoc"
    print "filen: ", filen
    loco = 'rover2orbital'
    print "loco: ", loco
    site = parseVicarLabel.getSite(filen)
    print "Site Index: ", site
    drive = parseVicarLabel.getDrive(filen)
    print "Drive Index: ", drive
    venue = "ops"
    print "PLACES Venue: ", venue
    inst = parseVicarLabel.getInstrumentId(filen)
    print "Instrument: ", inst
    pos = InstPos(filen)
    if pos == '':
        sid = 'Cpoint'
        pos = str(parseVicarLabel.getCameraCPoint(filen))
    else:
        sid = instruments.InstDic[inst][4]
        pos = pos.tolist()
        pos = pos.replace("]",")")
    pos = pos.replace(" ", "")
      
    x, y, z = places.getLocoSiteTranslation(venue, pos, site, drive, loco)
    
    p2xyz_status = 0
    print "Leaving " + __name__ + ".MastInstLoc.py and returing  x,y,z: ", x, y, z
    return x, y, z, sid, p2xyz_status



def InstPos(filen):
    '''Given a file, provides the xyz coordinate of the center of the observation'''
    inst = parseVicarLabel.getInstrumentId(filen)
    print "Instrument: ", inst
    if instruments.InstDic[inst][4] == 'range':
        pos = MastRangeCoord.sph2cart(filen)
    elif instruments.InstDic[inst][4] == 'flat':
        pos = MastRangeCoord.IntersectFlatPlane(filen)
    return pos            

