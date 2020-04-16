#! /usr/local/msl/bin/python
#******************************************************************************
#  ArmInFile.py <image.DAT>
# 
#  Project:  MMGIS Pipeline p2xyz input files for Arm Tools
#  Purpose:  Creates the p2xyz in_file with Unit Vector for all Arm Tools data 
#            products
#            
#  Author:   Hallie Gengl
#  Updated by: Corrine Rojas (crojas6@asu.edu) 
#  8/24/18:  Added detailed commenting
#
#******************************************************************************

import os
import sys
import netrc
import requests
import math
import urlparse
import urllib2
import xml.etree.ElementTree as ET
import xml.dom.minidom as XMD
from subprocess import Popen, PIPE
import argparse
import re
import glob
import parseVicarLabel   

""" This tool is yet to be installed on the MSL OPS machines for testing!!!!"""

ARM = 'arm_position/arm-position.py'


""" input file format for marsp2xyz using a unit vector
     id UNIT cx cy cz u v w
	Uses the given point and unit vector (aka direction cosines)

    example:  "ArmTool UNIT 1 2 3 0 0 1" 
"""

def ArmWriteInFile(filen,oDAT,oLBL):
   #lbl = os.path.splitext(filen)[0] + '.LBL'
   lbl = os.path.splitext(filen)[0] + '.LBL'
   print "Entering ArmWriteInFile.ArmInFile and running with lbl: ", lbl
   print "[ArmWriteInFile.ArmInFile] running with lbl: ", oLBL
   inst  =  str(parseVicarLabel.getInstrumentId(filen))
   print "[ArmWriteInFile.ArmInFile] which inst: ", inst
   print "[ArmWriteInFile.ArmInFile] which dp (filen): ", filen
   #ARM = '/pipeline/arm_position/arm-position.py'
   print "[ArmWriteInFile.ArmInFile] what is ARM???: ", ARM
   #p1 = Popen((ARM,'--local-level',inst,oLBL),stdout=PIPE) 
   #ARM = '/pipeline/arm_position/arm-position.py'
   p1 = Popen((ARM,inst,oLBL),stdout=PIPE) 
   print "[ArmWriteInFile.ArmInFile] Running arm position p1: ",p1
   p1.wait()
   n1 = p1.stdout.read()
   p1.stdout.close()
   
   
   """parse output of script to give C point and unit vector of the 
   tool pointing as input for terrain intersection"""
   n1 = n1.replace(',', '')
   print "[ArmWriteInFile.ArmWriteInFile] here is n1: ",n1
   pid=n1.split()[1]  
   inst=n1.split()[1]
   pos_x=n1.split()[2]
   pos_y=n1.split()[3]
   pos_z=n1.split()[4]
   dir_x=n1.split()[5]
   dir_y=n1.split()[6]
   dir_z=n1.split()[7]
   
   
   """ Generate File and return the filename to be called"""
   fn = os.path.basename(filen)
   base = os.path.splitext(fn)[0]  #print vicar basename
   print "[ArmWriteInFile.ArmInFile] printing base :",base
   filename = 'p2xyz' + '_' + base +'.in' #create filename for p2xyz in_file parameter that tracks filename
   print "[ArmWriteInFile.ArmInFile] created filename: ",filename
   entry = "UNIT  ArmTool %s %s %s %s %s %s\n" %(pos_x,pos_y,pos_z,dir_x,dir_y,dir_z) #create text for in_file


   f = open(filename, 'w') # then write out the file
   f.write(entry)
   f.close() 
   print "[ArmWriteInFile.ArmInFile] Leaving function with base, entry, ",base,entry," and returning filename: ",filename
   return filename 





def main():

   print "Entering ArmInFile Main loop"
   ivic = sys.argv[1] #input is a Arm File Product .IMG Files
   lbl = os.path.splitext(filen)[0] + '.LBL'
   #print "running with lbl", lbl
   filename = ArmWriteInFile(lbl) # Generate In_File for p2xyz
   print 'Leaving ArmInFile main loop and returning filename:' + filename
   return filename  


if (__name__ == "__main__"):
   print
   main()
   print
