#! /tps/bin/python
#******************************************************************************
#  point2xyz.py <inp,dem,in_file,out_file,z_offset,dem_scale,minx,miny,maxx,maxy>
# 
#  Project:  MMGIS Pipeline p2xyz input files for CCAM RMI
#  Purpose:  Creates the p2xyz in_file for CCAM RMI data products
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


#   ../marsp2xyz inp=NLB_505898796ILT_F0521162NCAM00353M1.IMG dem=MSL_sol1221_DEM_1m_lab.VIC in_file=p2xyz.in out_file=p2xyz.out_site z_offset=4423.76 dem_scale=1 minx=13.268 miny=-107.694 maxx=113.268 maxy=-7.694



def marsp2xyzNOLABEL(dem_type,inp,dem,in_file,out_file,z_offset,dem_scale,minx,miny,maxx,maxy):
   cmd = '/home/hgengl/bin/marsp2xyz inp=%s dem=%s in_file=%s out_file=%s z_offset=%s dem_scale=%s minx=%s miny=%s maxx=%s maxy=%s out_coord=rover' %(inp,dem,in_file,out_file,z_offset,dem_scale,minx,miny,maxx,maxy)
   print cmd  
   os.system(cmd)
   
   
#filen,dem,InFile,OutFile,z_offset
def marsp2xyz(inp,dem,in_file,out_file,z_offset,type):

   if type == 'arm':
      cmd = '/home/hgengl/bin/marsp2xyz inp=%s dem=%s in_file=%s out_file=%s z_offset=%s coord=rover out_coord=rover' %(inp,dem,in_file,out_file,z_offset)
   else:
      cmd = '/home/hgengl/bin/marsp2xyz inp=%s dem=%s in_file=%s out_file=%s z_offset=%s out_coord=rover' %(inp,dem,in_file,out_file,z_offset)
   print cmd
   os.system(cmd)



def main():

   try:
      R2LIB = os.environ['R2LIB']
   except KeyError, e:
      print "$R2LIB is not set, run select"
      raise SystemExit
      
  

   inp=sys.argv[1]
   dem=sys.argv[2]
   in_file=sys.argv[3]
   out_file=sys.argv[4]
   z_offset=sys.argv[5]
   dem_scale=sys.argv[6]
   minx=sys.argv[7]
   miny=sys.argv[8]
   maxx=sys.argv[9]
   maxy=sys.argv[10]  
   marsp2xyz(inp,dem,in_file,out_file,z_offset) # Generate OutFile of intersection to ground
      
   
   
if (__name__ == "__main__"):
   print
   main()
   print
