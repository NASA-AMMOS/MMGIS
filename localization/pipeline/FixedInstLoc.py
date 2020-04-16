#! /usr/local/msl/bin/python
#******************************************************************************
#  FixedInstLoc.py <image.IMG>
# 
#  Project:  Fixed Location Instrument Localization
#  Purpose:  Localizations for fixed rover instruments on planetary surface
#            
#  Author:   Hallie Gengl
#
#  Updated:  8/24/18 Corrine Rojas (crojas6@asu.edu) 
#  Updated:  6/26/19 Hallie Gengl
#
#******************************************************************************

import os
import sys
import argparse
import parseVicarLabel
import msl.instruments as instruments
import msl.placesTranslation as places



def allLoc(filen):
   print "Running allLoc"
   print "filen: ",filen
   loco = 'rover2orbital'
   print "loco: ",loco
   site = parseVicarLabel.getSite(filen)
   print "Site: ",site
   drive = parseVicarLabel.getDrive(filen)
   print "Drive: ",drive
   
   venue = "ops"
   inst = parseVicarLabel.getInstrumentId(filen)
   pos = instruments.InstDic[inst][1] 
   print "Pos: ",pos
   sid = "NA"
   p2xyz_status = "0"
   x,y,z = places.getLocoSiteTranslation(venue,pos,site,drive,loco)
   #print str(len(xyz))
   #print xyz
   return x,y,z,sid,p2xyz_status
   





def main():
    
   try:
      os.environ['R2LIB']
   except KeyError as e:
      print "%s is not set, run select" % (e)
      raise SystemExit

   usage = "%(prog)s <FILENAME>"
   parser = argparse.ArgumentParser(usage=usage,formatter_class=argparse.ArgumentDefaultsHelpFormatter)
   parser.add_argument("filen",metavar="filen",help="OBSERVATION FILENAME")
   args = parser.parse_args()


   venue = 'ops'
   filen = os.path.basename(args.filen) 
   inst = parseVicarLabel.getInstrumentId(filen)
   site = parseVicarLabel.getSite(args.filen)
   drive = parseVicarLabel.getDrive(args.filen)
   loco = 'rover2orbital'
   pos = instruments.InstDic[inst][1]  #position of instrument in rover frame
   x,y,z = places.getLocoSiteTranslation(venue,pos,site,drive,loco) #xyz translated to global frame
   print x,y,z
   return x,y,z




if (__name__ == "__main__"):
   print
   main()
   print

