#! /usr/local/msl/bin/python
#******************************************************************************
#  MastInFile.py <image.DAT>
# 
#  Project:  MMGIS Pipeline p2xyz input files for Pointed Instruments
#  Purpose:  Creates the p2xyz in_file for Mast Cameras data products
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
import msl.instruments as instruments
   
#"""Commenting out file creation for p2xyz
# make in file with info example: "Navmast IMG_CTR CL9_505885434EDR_F0520936CCAM01221M1.VIC"
def WriteInFile(ivic):
   inst = str(parseVicarLabel.getInstrumentId(ivic))
   print "Entering WriteInFile.MastInfile and printing instrument: ", inst
   print instruments.InstDic[inst]
   interType =  instruments.InstDic[inst][2]
   fn = os.path.basename(ivic) 
   base = os.path.splitext(fn)[0]  #print vicar basename
   filename = 'p2xyz' + '_' + base +'.in' #create filename for p2xyz in_file parameter that tracks filename
   entry = "%s %s %s\n" %(interType,inst,ivic) #create text for in_file
   #print entry
   f = open(filename, 'w') # then write out the file
   f.write(entry)
   f.close() 
   print "Leaving WriteInFile.MastInfile and returning filename: ",filename
   return filename 



def MastWriteInFile(ivic):
   #ivic = sys.argv[1] #input is a Navcam and Navcam .IMG Files
   filename = WriteInFile(ivic) # Generate In_File for p2xyz
   print "Entering MastWriteInFile.MastInfile and returning filename: ",filename
   return filename     
#""" 


def main():

   
   ivic = sys.argv[1] #input is a Navcam and Navcam .IMG Files
   filename = WriteInFile(ivic) # Generate In_File for p2xyz
   return filename     
   

if (__name__ == "__main__"):
   print
   main()
   print
