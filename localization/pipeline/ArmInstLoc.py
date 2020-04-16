#! /usr/local/msl/bin/python
#******************************************************************************
#  ArmInstLoc.py <image.IMG>
# 
#  Project:  Fixed Instrument Localization
#  Purpose:  Localizations for fixed rover instruments on planetary surface
#  Note:     This script processes only MAHLI and APXS at this time.
#            
#  Author:   Hallie Gengl
#
#  Updated:  8/24/18 Corrine Rojas (crojas6@asu.edu) 
#  Updated:  6/26/19 Hallie Gengl
#
#******************************************************************************

import os
import sys
import netrc
import requests
import math
import subprocess
import argparse
import re
import glob
import ArmInFile
import point2xyz
import parseVicarLabel
import msl.placesTranslation as places

  
  
def InstPos(filen,site,drive,oLBL,oDAT):   
   print "Entering InstPos.ArmInstLoc with: ", filen, site,drive,oLBL,oDAT
   #filen = os.path.basename(filen)
   print filen,oLBL,oDAT
   InFile = ArmInFile.ArmWriteInFile(filen,oDAT,oLBL)
   print '[InstPos.ArmInstLoc] INFILE: ', InFile
   OutFile = InFile.split('.')[0] + '.out'
   print '[InstPos.ArmInstLoc]OutFile: ' +  OutFile
   
   #pos,dem_type,InFile,OutFile,sid,dem_status = Intersect(filen,site,drive)
   sid = "NA"
   dem_status = "NA"
   dem_type = "NA"   

   #temporary override for interestion override
   InText = open(InFile,"r")
   for line in InText:
      x = (line.split())[2]
      y = (line.split())[3]
      z = (line.split())[4]
   
   pos = x,y,z

   return pos,dem_type,InFile,OutFile,sid,dem_status

 
def Intersect(filen,site,drive):

   hirise_dem = 'HiRISE_%s_%s_150m.VIC' %(site,drive)
   print hirise_dem
   working_dir = 'test_data/'
   searchStr = 'N_L000_' + '*' + 'ZZZ' + '*' + site +  '*' + drive + '*' + '5RNGM' + '*' + '.VIC'
   searchStr = working_dir + searchStr
   print searchStr
   
   navcam_dem = str(glob.glob(searchStr)[-1])
   

   print navcam_dem
   if os.path.exists(navcam_dem) == True: 
      dem_type= 'site'
      dem = navcam_dem
      z_offset = 0   # z offset needs to be corrected
   elif os.path.exists(hirise_dem) == True: 
      dem_type= 'global'
      dem = hirise_dem

      z_offset = places.getLocoSiteTranslation('ops','0,0,0',site,drive,'rover2orbital')[3]
      print "InstPos.ArmInstLoc z_offset: ",z_offset
   else: 
      raise SystemExit('no DEM available')  


   point2xyz.marsp2xyz(filen,dem,InFile,OutFile,z_offset,'arm')
    
   sid = dem

   x,y,z,dem_status = parseXyz(OutFile)
   pos = x,y,z
   print "Leaving InstPos.ArmInstLoc and returning pos, dem_type, inFile, Outfile, sid, dem_status: ",pos,dem_type,InFile,OutFile,sid,dem_status
   return pos,dem_type,InFile,OutFile,sid,dem_status


def parseXyz(OutFile):
   print "Entering parseXyz.ArmInstLoc"
   line = open(OutFile).read()
   dem_status = line.split()[1]
   x=line.split()[3]
   y=line.split()[4]
   z=line.split()[5] 
   #theta=line.split()[7]
   #range=line.split()[9]
   print "[parseXyz.ArmInstLoc] Leaving after parsing XYZ coordinate and returning: ",x,y,z
   return x,y,z,dem_status  #,theta,range

   

def allLoc(filen,loco):
   print "Entering allLoc.ArmInstLoc.py"
   site = parseVicarLabel.getSite(filen)
   drive = parseVicarLabel.getDrive(filen)
   pos,sid,dem_status  = str(InstPos(filen,site,drive))
   x,y,z = places.getLocoSiteTranslation("ops",pos,site,drive,loco)
   print "Leaving allLoc.ArmInstLoc.py and returning x,y,z,sid,dem_status: ",x,y,z,sid,dem_status
   return x,y,z,sid,dem_status
   




def ArmInstLoc(pds,oLBL,oDAT):
   print "Entering ArmInstLoc.ArmInstLoc.py"
   
   venue = 'ops'
   #print "PDS: ", pds
   base = os.path.basename(pds)
   #print "Base: ", base
   core = os.path.splitext(base)[0]
   #print "Core: ",core
   filen = core + '.VIC'
   #print "filename:", filen
   print "inputs", pds, oLBL, oDAT
  
   ext = os.path.splitext(base)[1]
   if ext == '.VIC':
      filen = core + '.VIC'
   if ext == '.IMG':
      filen =  pds
   print "[ArmInstLoc.ArmInstLoc] filen before the rest: ", filen

   site = parseVicarLabel.getSite(filen)
   print "[ArmInstLoc.ArmInstLoc] Site from filen: ",site
   drive = parseVicarLabel.getDrive(filen)
   print "[ArmInstLoc.ArmInstLoc] Drive from filen: ",drive

   pos,dem_type,InFile,OutFile,sid,dem_status = InstPos(filen,site,drive,oLBL,oDAT)

   

   #print pos
   pos = str(pos)
   pos = pos.replace("'","")
   pos = pos.replace(" ","")
   #print venue,pos,site,drive,'rover2orbital'
   x,y,z = places.getLocoSiteTranslation(venue,pos,site,drive,'rover2orbital')

   print "[ArmInstLoc.ArmInstLoc] Leaving function and returning x,y,z,sid,dem_status : ",x,y,z,sid,dem_status
   return x,y,z,sid,dem_status



def main():
   print "Entering Main loop [ArmInstLoc]"

   try:
      os.environ['R2LIB']
   except KeyError as e:
      print "%s is not set, run select" % (e)
      raise SystemExit

   usage = "%(prog)s <FILENAME>"
   parser = argparse.ArgumentParser(usage=usage,formatter_class=argparse.ArgumentDefaultsHelpFormatter)
   parser.add_argument("filen",metavar="filen",help="OBSERVATION FILENAME")
   args = parser.parse_args()



   venue = 'ops' #temporary override
   
   filen = args.filen

   site = parseVicarLabel.getSite(filen)
   drive = parseVicarLabel.getDrive(filen)	

   pos = InstPos(filen,site,drive,oLBL,oDAT)
   parseXyz(out_file)
   if dem_type == 'site':
      x,y,z = places.getLocoSiteTranslation(venue,pos,site,drive)
   elif dem_type== 'global':
      x,y,z = pos[0],pos[1],pos[2] 
   print "Leaving Main loop [ArmInstLoc] and returing x,y,z: ",x,y,z
   return x,y,z



if (__name__ == "__main__"):
   print
   main()
   print
