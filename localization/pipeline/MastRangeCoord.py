#!/usr/bin/python

# ******************************************************************************
#  MastRangeCoord.py <image.IMG>
#
#  Project:  Mast Instrument Localization
#  Purpose:  Localizations for Mast instrument observations on planetary surface
#            using either range of observation or flat plane
#
#  Author:   Hallie Gengl
#
# ******************************************************************************

import numpy as np
import math
import parseVicarLabel



def azel2vector(az, el):
    
   aex = np.cos(az) * np.cos(el)
   aey = np.sin(az) * np.cos(el)
   aez = np.sin(el)
   print  "azel2vector ", np.array([aex, aey, aez])
   return np.array([aex, aey, aez])



def sph2cart(filen):
   az,el,focusRange,cpoint=getAzElFocusRange(filen)
   rcos_theta = focusRange * np.cos(el)
   x = rcos_theta * np.cos(az)
   y = rcos_theta * np.sin(az) 
   z = focusRange * np.sin(el)

   cart = np.array([x,y,z])
   cpoint = np.asarray(cpoint)
   cpoint = np.asfarray(cpoint,float)
   pos = cart + cpoint
   print ("icart is", pos)
   return pos





def IntersectFlatPlane(filen):
   az,el,__,cpoint=getAzElFocusRange(filen)
   #Define ground plane under spacecraft
   planeNormal = np.array([0.0,0.0,-1.0])
   planePoint = np.array([0.0, 0.0, -0.0]) #Project onto flat plane
   #Define ray from mast
   rayDirection = np.array(azel2vector(az, el))
   rayPoint = np.array([cpoint])
   print rayPoint
   pos = SurfaceCoord(planeNormal, planePoint, rayDirection, rayPoint)
   print "surface intersection at", pos
   return pos
   


def SurfaceCoord(planeNormal, planePoint, rayDirection, rayPoint):
   raydot = planeNormal.dot(rayDirection)
   epsilon=1e-6
   if abs(raydot) < epsilon:
      print "no intersection or line is within plane"
      SurfaceCoordPoint = ''
   else:   
      SurfaceCoordPoint = (rayPoint - planePoint) + (-planeNormal.dot(rayPoint - planePoint)\
      /planeNormal.dot(rayDirection)) * rayDirection + planePoint
   return SurfaceCoordPoint



def getAzElFocusRange(filen):
   print "Parsing File Attributes: ", filen
   az = np.deg2rad(float(parseVicarLabel.getAz(filen))) #radians
   print "Pointing Azimuth: ", az
   el = np.deg2rad(-(float(parseVicarLabel.getEl(filen)))) #radians    
   print "Pointing Elevation: ", el
   
   focus = parseVicarLabel.getCcamFocus(filen)
   print "Camera Focus (mm): ",focus
   if focus != '':
      focusRange = float(focus)*0.001 #convert from mm to m 
      print "Camera Focus (m): ",focusRange
   else:
      focusRange = ''   
   cpoint = np.array(parseVicarLabel.getCameraCPoint(filen))
   print "Camera Center Point",cpoint
   return az,el,focusRange,cpoint



if __name__=="__main__":
   #Define ground plane under spacecraft
   planeNormal = np.array([0.0,0.0,-1.0])
   planePoint = np.array([0.0, 0.0, -0.0]) #Project onto flat plane
   filen = "InsertArgsHere"
   az,el,focusRange,cpoint=getAzElFocusRange(filen)
   
   
   #Define ray from mast
   rayDirection = np.array(azel2vector(az, el))
   rayPoint = np.array([cpoint])

   SurfaceCoordPoint = SurfaceCoord(planeNormal, planePoint, rayDirection, rayPoint)
   
   print "surface intersection at", SurfaceCoordPoint


   x,y,z = sph2cart(filen)
   print ("chemcam intersection ", x,y,z)

