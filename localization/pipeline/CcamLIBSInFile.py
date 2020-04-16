#! /tps/bin/python
#******************************************************************************
#  CcamLIBSInFile.py <image.DAT>
# 
#  Project:  MMGIS Pipeline p2xyz input files for CCAM LIBS
#  Purpose:  Creates the p2xyz in_file for CCAM LIBS data products
#            
#  Author:   Hallie Gengl
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
import subprocess
import argparse
import re
import glob
import parseVicarLabel
import msl.PdsToVic as PdsToVic



# grab ccam hot spot pixel coordinates from vicar label
def CcamHotPixel(ivic):
   line =  parseVicarLabel.getCcamLibsLine(ivic) # Grab Ccam LIBS Hot Spot Line Coordinate described by camera model
   samp = parseVicarLabel.getCcamLibsSamp(ivic) # Grab Ccam LIBS Hot Spot Sample Coordinate described by camera model
   
   return line,samp
   
   

# make in file with info example: "ccamLib IMG_LS CL9_505885434EDR_F0520936CCAM01221M1.VIC 497 532"
def CcamLIBWriteInFile(ivic,line,samp):
   ivic = os.path.basename(ivic) 
   base = os.path.splitext(ivic)[0]  #print vicar basename
   filename = 'p2xyz' + '_' + base +'.in' #create filename for p2xyz in_file parameter that tracks filename
   entry = "IMG_LS ccamlib %s %s %s\n" %(ivic,line,samp) #create text for in_file
   print entry
   f = open(filename, 'w') # then write out the file
   f.write(entry)
   f.close() 
   return filename 



def CcamLIBSInFile(ipds):
   #ipds #input is .DAT File
   base = os.path.basename(ipds)
   ivic = os.path.splitext(base)[0] + '.VIC' #create VICAR filename
   #PdsToVic.PdsToVic(base)  # Generate VICAR FILE
   line,samp = CcamHotPixel(ivic) # Grab Line and Sample of CCAM LIBS Hot Spot in RMI Camera Model
   filename = CcamLIBWriteInFile(ivic,line,samp) # Generate In_File for p2xyz
   return filename   



def main():

   
   ipds = sys.argv[1] #input is a Chemcam LIBS .DAT File
   base = os.path.basename(ipds)
   ivic = os.path.splitext(base)[0] + '.VIC' #create VICAR filename
   #PdsToVic.PdsToVic(base)  # Generate VICAR FILE
   line,samp = CcamHotPixel(ivic) # Grab Line and Sample of CCAM LIBS Hot Spot in RMI Camera Model
   CcamLIBWriteInFile(ivic,line,samp) # Generate In_File for p2xyz
      


if (__name__ == "__main__"):
   print
   main()
   print
