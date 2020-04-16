#! /usr/local/msl/bin/python
#******************************************************************************
#  InstLoc.py <image.IMG/VIC>
# 
#  Project:  Instrument Loco String for a given file
#  Purpose:  Localizations stored in python dictionary
#            
#  Author:   Hallie Gengl
#
#  Updated:  8/24/18 Corrine Rojas (crojas6@asu.edu) 
#  Updated:  6/26/19 Hallie Gengl
#
#******************************************************************************

import os
import sys
import parseVicarLabel
import FixedInstLoc
import MastInstLoc
import ArmInstLoc
import msl.instruments as instruments
import msl.PdsToVic as PdsToVic
import msl.placesTranslation as places


LocArray = {'Data_Product' : '', 'Instrument' : '', 'Spacecraft_Clock(sec)' : '',
   'Rover_Motion_Counter': '', 'Mission': '', 'Site_Frame_Origin_Offset_Vector': '',
   'Spacecraft_Quaternion': '', 'Sol_Number': '','Sequence_ID' : '',
   'Instrument_Azimuth(deg)': '','Instrument_Elevation(deg)': '',
   'Global_Northing(m)': '','Global_Easting(m)': '','Global_Elevation(m)': '',
   'Stereo': '','ObsType': '', 'LocType': '' ,'Frame': '','Method': '', 'APID' : '',
   'APID_Name' : '', 'Local_True_Solar_Time' : '', 'Local_Mean_Solar_Time' : '',
   'Planetary_Radius': '', 'Surface_Intersection_DEM': '', 'Rover_Global_Northing(m)': '',
   'Rover_Global_Easting(m)':'', 'Rover_Global_Elevation(m)': ''}


def runLoco(locType,filen,oLBL,oDAT):
   print "Entering runLoco.InstLoc.py"
   print "Here is str(locType) from " + __name__ + ".InstLoc.py: ", str(locType)
   print "Here is str(filen) from " + __name__ + ".InstLoc.py: ", str(filen)
   print "Here is str(oLBL) from " + __name__ + ".InstLoc.py: ",str(oLBL)
   print "Here is str(oDAT) from " + __name__ + ".InstLoc.py: ",str(oDAT)
   if locType == 'fixed':
      x,y,z,sid,p2xyz_status  = FixedInstLoc.allLoc(filen)
   elif locType == 'mast':
      x,y,z,sid,p2xyz_status = MastInstLoc.allLoc(filen)
   elif locType == 'contact':
      x,y,z,sid,p2xyz_status = ArmInstLoc.ArmInstLoc(filen,oLBL,oDAT)      
   print "Leaving " + __name__ + ".Instloc.py and returning: ", x, y, z
   print "Stereo Intersection DEM: " + sid
   print "p2xyz_status: " + str(p2xyz_status)
   return x,y,z,sid,p2xyz_status

  
def InstLocDB(filen):  
   print "Entering InstLocDB.InstLoc.py"
   
   try:
      os.environ['R2LIB']
   except KeyError as e:
      print "%s is not set, run select" % (e)
      raise SystemExit


   print "Here is the filen from " + __name__ + ".InstLoc.py: ", filen
   original = filen
   #print "Split: ", os.path.splitext(filen)[0]
   #print os.path.splitext(filen)[1]

   
   filen,oDAT,oLBL = getNewProduct(filen)
   inst  =  parseVicarLabel.getInstrumentId(filen)
   if inst == 'CHEMCAM_SOH' or inst == 'CHEMCAM_PARMS':
      SystemExit
   print "filename: ", filen

   print " creating array [" + __name__ + ".InstLoc.py]"
   print "instrument parsing of dictionary [" + __name__ + ".InstLoc.py]"
   #print "file: ",filen
   inst  =  parseVicarLabel.getInstrumentId(filen)
   #print "instrument: ", inst
   rover = parseVicarLabel.getSpacecraftId(filen)
   sol   = parseVicarLabel.getPlanetDayNumber(filen)
   sclk  = parseVicarLabel.getSclk(filen)
   oov   = parseVicarLabel.getOriginOffsetVector(filen)
   q     = parseVicarLabel.getOriginRotationQuaternion(filen)
   rmc   = parseVicarLabel.getRoverMotionCounter(filen)
   az    = parseVicarLabel.getAz(filen)
   el    = parseVicarLabel.getEl(filen)
   #c     = parseVicarLabel.getCameraCPoint(filen) 
   #pId   = parseVicarLabel.getProcessID(filen)
   ltst  = parseVicarLabel.getLTST(filen)
   print "ltst :" + ltst
   lmst  = parseVicarLabel.getLMST(filen)
   print "lmst :" + lmst
   # to do: add APP ID, Planetary Radius, Pointing Vector, ...
   # currently empty dictionaries
   seqID = parseVicarLabel.getSeqId(filen)   
   apid  = parseVicarLabel.getApId(filen)
   if parseVicarLabel.getApIdName(filen) == "McamLRecoveredProduct":
      return
   elif parseVicarLabel.getApIdName(filen) == "McamRRecoveredProduct":
      return
   elif parseVicarLabel.getApIdName(filen) == "RADSendData":
      return
   else:
      apidName  = parseVicarLabel.getApIdName(filen)
   print rmc
   loc_x,loc_y,loc_z = places.getLocoRover('ops',rmc[0],rmc[1],'rover2orbital')
   
   inst = parseVicarLabel.getInstrumentId(filen)
 
   locType =  instruments.InstDic[inst][1] 
   print "Here is locType from " + __name__ + ".InstLoc.py: ",locType
   print "Here is filen from " + __name__ + ".InstLoc.py: ",filen
   print "Here is oLBL from " + __name__ + ".InstLoc.py: ",oLBL
   print "Here is oDAT from " + __name__ + ".InstLoc.py: ",oDAT
   x,y,z,sid,p2xyz_status = runLoco(locType,filen,oLBL,oDAT)
   stereo = parseVicarLabel.frameType(filen)


   LocArray['Stereo'] = stereo
   LocArray['Data_Product'] = original
   LocArray['Instrument'] = inst
   LocArray['Spacecraft_Clock(sec)'] = sclk
   

   LocArray['Rover_Global_Northing(m)'] = loc_x
   LocArray['Rover_Global_Easting(m)'] = loc_y
   LocArray['Rover_Global_Elevation(m)'] = loc_z


   LocArray['Global_Northing(m)'] = x
   LocArray['Global_Easting(m)'] = y
   LocArray['Global_Elevation(m)'] = z
   LocArray['LocType'] = locType
   LocArray['Rover_Motion_Counter'] = rmc
   LocArray['Site_Origin_Offset_Vector'] = oov
   LocArray['Quaternion'] = q
   LocArray['Instrument_Elevation(deg)'] = el
   LocArray['Instrument_Azimuth(deg)'] = az
   LocArray['Mission'] = rover
   LocArray['Sol_Number'] = sol
   #LocArray['Cpnt'] = c
   LocArray['Sequence_ID'] = seqID
   LocArray['Frame'] = 'orbital'
   LocArray['Local_Mean_Solar_Time'] = str(lmst)
   LocArray['Local_True_Solar_Time'] = str(ltst)
   LocArray['APID'] = apid
   LocArray['APID_Name'] = apidName  
   LocArray['Surface_Intersection_DEM'] = sid
   LocArray['p2xyz_status_code'] = p2xyz_status

   #Print out the dictionary entry
   print "Here is dict.items(LocArray) from " + __name__ + ".InstLoc.py: ",dict.items(LocArray)
   print "Leaving " + __name__ + ".InstLoc.py returning: ", LocArray
   return LocArray
   
    
#InstLocDB(filename) #filename   

def getNewProduct(filen):
  
   
   if os.path.splitext(filen)[1] == '.VIC' or os.path.splitext(filen)[1] == '.IMG': 
      oDAT = filen
      oLBL = filen
   if os.path.splitext(filen)[1] == '.DAT' or os.path.splitext(filen)[1] == '.LBL':
      if 'ODL' not in open(filen).readline():
         oDAT = os.path.splitext(filen)[0] + '.DAT'
         oLBL = os.path.splitext(filen)[0] + '.LBL'
         filen = os.path.splitext(filen)[0] + '.LBL'
      else:
         oDAT = os.path.splitext(filen)[0] + '.DAT'
         oLBL = os.path.splitext(filen)[0] + '.DAT'
         filen = os.path.splitext(filen)[0] + '.DAT'
      print "Creating associated VICAR text file [" + __name__ + ".InstLoc.py]"
      PdsToVic.PdsToVic(filen) 
      base = os.path.basename(filen)
      print "Base: ", base
      core = os.path.splitext(base)[0] 
      print "Core: ",core
      filen = core + '.VIC'

   print "oDAT :", oDAT
   print "oLBL :", oLBL
   print "filename:", filen
   return filen,oDAT,oLBL


def main():
   InstLocDB(sys.argv[1]) #filename 
 

if (__name__ == "__main__"):
   print
   main()
   print 

#print type(LocArray)
#print json.dumps(LocArray, indent=2)
#print dict.header(LocArray)
#print dict.values(LocArray)
#print dict.header(LocArray),dict.values(LocArray)
#print ""
