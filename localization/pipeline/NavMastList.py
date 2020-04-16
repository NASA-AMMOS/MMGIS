#! /usr/local/msl/bin/python
#******************************************************************************
#  NavMastList.py <image.DAT>
# 
#  Project:  MMGIS Pipeline XYZ images intersection
#  Purpose:  Read XYZ intersection from stereo data products
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
#import numpy



""" Run List to grab coordinates of image pointing
     ** Needs to be updated for subframed images"""

 
LIST =  '/msop/opgs/software/vic/p2/lib/x86-linux/list'
   
#MNRRGB_1080XEDR049CYL_S_1018_FINDSM1.IMG nl=1 ns=1 sl=256 ss=256 ndigits=8
# make in file with info example: "Navmast IMG_CTR CL9_505885434EDR_F0520936CCAM01221M1.VIC"

def NavMastListCenter(ivic):
   print "Entering NavMastListCenter.NavMastList"
   nl = parseVicarLabel.getNumLines(ivic)
   sl = int(nl) / 2
 
   ns = parseVicarLabel.getNumSamples(ivic)
   ss = int(ns) / 2 
   for band in xrange(1,4):
      p1 = Popen((LIST,ivic,'nl=1','ns=1','sl=%s' %sl,'ss=%s' %ss ,'ndigits=8','sb=%s' %band, 'nb=1'),stdout=PIPE) 
      p1.wait()
      #print band
      if band == 1:
         #print "band 1"
	 n1 = p1.stdout.read()
	 #print n1
         p1.stdout.close()
         x = n1.split()[-1]
	 
	 if x == 'zero.':
	    x,y,z=0,0,0
	    return x,y,z
	 x = float(x) 
	 #print x

      elif band == 2:
         #print "band 2"
         n1 = p1.stdout.read()
	 #print n1
         p1.stdout.close()
         #print n1.split()[-1]
	 y = float(n1.split()[-1])
	 #print y
     
      elif band == 3:
         #print "band 3"
         n1 = p1.stdout.read()
	 #print n1
         p1.stdout.close()
         z = float(n1.split()[-1]) 
	 #print z
      #return x,y,z	    
       
   print "Leaving NavMastListCenter.NavMastList and returning x,y,z: ",x,y,z  
   return x,y,z  


""" Alternately if there is no center pixel, we check the center 
   5x5 of the image and average for a center estimate"""

def NavMastListAvgCenter(ivic):
   print "Entering NavMastListAvgCenter.NavMastList"
   for band in xrange(1,4):
      
      sl = (int(parseVicarLabel.getNumLines(ivic)) / 2) - 2
      ss = (int(parseVicarLabel.getNumSamples(ivic)) / 2) -2 
      
      #print sl
      #print ss
      
      #cmd = " %s nl=1 ns=1 sl=512 ss=512 ndigits=8 sb=%s nb=1" %(ivic,band,band)
      p1 = Popen((LIST,ivic,'nl=5','ns=5','sl=%s' %sl,'ss=%s' %ss,'ndigits=8','sb=%s' %band, 'nb=1'),stdout=PIPE) 
      p1.wait()
      #print band
      if band == 1:
	 xlist = []
	 n1 = p1.stdout.read()
	 p1.stdout.close()
	 if n1.split()[-1] == 'zero.':
	    x,y,z=0,0,0
	    break
	 for lines in xrange(2,nl):
	    line = n1.split('\n')[-lines]
	    for samples in xrange(1,ns):
	       point = float(line.split()[-samples])
	       xlist.append(point)
               #Fred added code
               print str(xlist)
               #x = numpy.mean(xlist)    
               x = sum(xlist) / float(len(xlist))    
	    
      elif band == 2:
         ylist = []
	 n1 = p1.stdout.read()
	 p1.stdout.close()
	 for lines in xrange(2,nl):
	    line = n1.split('\n')[-lines]
	    for samples in xrange(1,ns):
	       #print line.split()[-samples]
	       point = float(line.split()[-samples])
	       ylist.append(point)
               #y = numpy.mean(ylist)    
               y = sum(ylist) / float(len(xlist))

      elif band == 3:
         zlist = []
	 n1 = p1.stdout.read()
	 p1.stdout.close()
	 for lines in xrange(2,nl):
	    line = n1.split('\n')[-lines]
	    for samples in xrange(1,ns):
	       point = float(line.split()[-samples])
	       zlist.append(point)
               z = sum(zlist) / float(len(zlist))
               #z = numpy.mean(zlist) 	    
   
   print "Leaving NavMastListAvgCenter.NavMastList and returning x,y,z: ",x,y,z  
   return x,y,z  



def NavMastList(ivic):
   print "Entering NavMastList.NavMastList"
   listtype = 'center'
   x,y,z = NavMastListCenter(ivic) # Generate In_File for p2xyz
   #print x,y,z
   if x == 0:
      x,y,z = NavMastListAvgCenter(ivic)
      listtype = 'average'
   if x == 0:
      print 'No Values Found for Center 1x1 or Center 5x5'
      raise SystemExit
      
   print "Entering NavMastList.NavMastList and returning x,y,z,listtype: ",x,y,z,listtype
   return x,y,z,listtype


def main():

   listtype = 'center'
   ivic = sys.argv[1] #input is a Navcam and Navcam .IMG Files
   x,y,z = NavMastListCenter(ivic) # Generate In_File for p2xyz
   if x == 0:
      x,y,z = NavMastListAvgCenter(ivic)
      listtype = 'average'
   if x == 0:
      print 'No Values Found for Center 1x1 or Center 5x5'
      raise SystemExit
   #print x,y,z,listtype   
   return x,y,z,listtype   
      
   #lsNavMastListAvgCenter(ivic)
      


if (__name__ == "__main__"):
   print
   main()
   print
