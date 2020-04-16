#!/usr/local/msl/bin/python

import os
import sys
from subprocess import Popen, PIPE

try:
    os.environ['R2LIB']
except KeyError as e:
    print "%s is not set, run select" % (e)
    raise SystemExit



GETLAB  = os.path.join(os.environ['R2LIB'], 'getlab')
V2PARAM = os.path.join(os.environ['V2LIB'], 'v2param')
ITM_NAME = '' 

def getNumLines(fname):
   print "Entering getNumLines.parseVicarLabel.py"
   os.system('v2param -rm')
   
   p1 = Popen((GETLAB,fname,'lab_item=NL','-int','-system'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   nl = p2.stdout.readline().strip()
   p2.stdout.close()

   print "Leaving getNumLines.parseVicarLabel.py and returning nl: ",nl
   return nl

def getNumSamples(fname):
   print "Entering getNumSamples.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=NS','-int','-system'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ns = p2.stdout.readline().strip()
   p2.stdout.close()
   
   print "Leaving getNumSamples.parseVicarLabel.py and retyrning ns: ",ns
   return ns


def getInstrumentId(fname):
   print "Entering getInstrumentId.parseVicarLabel.py"
   os.system('v2param -rm')
   
   p1 = Popen((GETLAB,fname,'lab_item=INSTRUMENT_ID','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   inst = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getInstrumentId.parseVicarLAbel.py and returning inst: ",inst
   return inst

def getSeqId(fname):
   print "Entering getSeqID.parseVicarLabel.py"
   os.system('v2param -rm')
   
   p1 = Popen((GETLAB,fname,'lab_item=SEQUENCE_ID','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   seqid = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getSeqId.parseVicarLabel.py and returning seqId: ",seqid
   return seqid





def getSpacecraftId(fname):
   "Entering getSpaceCraftId.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=INSTRUMENT_HOST_ID','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   rover = p2.stdout.readline().strip()
   p2.stdout.close()
   "Leaving getSpacecraftId.parseVicarLabel.py and returning rover: ",rover
   return rover

def getPlanetDayNumber(fname):
   print "Entering getPlanetDayNumber.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=PLANET_DAY_NUMBER','-int','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   pdn = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getPlanetDayNumber.parseVicarLabel.py and returning pdn: ",pdn
   return pdn

def getSclk(fname):
   print "Entering getSclk.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=SPACECRAFT_CLOCK_START_COUNT','-real','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   sclk = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getSclk.parseVicarLabel.py and returning sclk: ",sclk
   return sclk


def getLMST(fname):
   print "Entering getLMST.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=LOCAL_MEAN_SOLAR_TIME','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   print p2.stdout.readline().strip()
   lmst = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getLMST.parseVicarLabel.py and returning lmst: ",lmst
   return lmst


def getLTST(fname):
   print "Entering getLTST.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=LOCAL_TRUE_SOLAR_TIME','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   print p1 
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   print p2.stdout.readline().strip()
   ltst = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getLTST.parseVicarLabel.py and returning ltst: ",ltst
   return ltst


def getApId(fname):
   print "Entering getApId.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=APPLICATION_PROCESS_ID','-int','-prop','itm_task=TELEMETRY'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   apid = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getApId.parseVicarLabel.py and returning apid: ", apid
   return apid


def getApIdName(fname):
   print "Entering getApIdName.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=APPLICATION_PROCESS_NAME','-string','-prop','itm_task=TELEMETRY'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   apid_name = p2.stdout.readline().strip()
   p2.stdout.close()
   print "LEaving getApIdName.parseVicarLAbel.py and returning apid_name: ",apid_name
   return apid_name


def frameType(fname):
   print "Entering frameType.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=FRAME_TYPE','-string','-prop','itm_task=IDENTIFICATION'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   frameType = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving frameType.parseVicarLabel.py and returning frameType: ",frameType
   return frameType




def getOriginOffsetVector(fname):
   print "Entering getOriginOffsetVector.parseVicarLabel.py"
   os.system('v2param -rm')

   # get the X coordinate
   p1 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=1'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   x = p2.stdout.readline().strip()
   p2.stdout.close()
   
   # get the Y coordinate
   p3 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=2'),stdout=PIPE)
   p3.wait()
   p3.stdout.close()
   
   p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p4.wait()
   y = p4.stdout.readline().strip()
   p4.stdout.close()
   
   # get the Z coordinate
   p5 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=3'),stdout=PIPE)
   p5.wait()
   p5.stdout.close()
   
   p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p6.wait()
   z = p6.stdout.readline().strip()
   p6.stdout.close()
   
   if not x:
      print("Using alternate itm name convention")
      
      # get the X coordinate
      p1 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=1'),stdout=PIPE)
      p1.wait()
      p1.stdout.close()
   
      p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p2.wait()
      x = p2.stdout.readline().strip()
      p2.stdout.close()
   
      # get the Y coordinate
      p3 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=2'),stdout=PIPE)
      p3.wait()
      p3.stdout.close()
   
      p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p4.wait()
      y = p4.stdout.readline().strip()
      p4.stdout.close()
   
      # get the Z coordinate
      p5 = Popen((GETLAB,fname,'lab_item=ORIGIN_OFFSET_VECTOR','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=3'),stdout=PIPE)
      p5.wait()
      p5.stdout.close()
   
      p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p6.wait()
      z = p6.stdout.readline().strip()
      p6.stdout.close()   
      

   print "Leaving getOriginOffsetVector.parseVicarLabel.py and returning x,y,z: ",x,y,z
   return (x,y,z)


def getCameraCPoint(fname):
   print "Entering getCameraCPoint.parseVicarLabel.py"
   os.system('v2param -rm')

   # get the X coordinate
   p1 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_1','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=1'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   cx = p2.stdout.readline().strip()
   p2.stdout.close()
   
   # get the Y coordinate
   p3 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_1','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=2'),stdout=PIPE)
   p3.wait()
   p3.stdout.close()
   
   p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p4.wait()
   cy = p4.stdout.readline().strip()
   p4.stdout.close()
   
   # get the Z coordinate
   p5 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_1','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=3'),stdout=PIPE)
   p5.wait()
   p5.stdout.close()
   
   p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p6.wait()
   cz = p6.stdout.readline().strip()
   p6.stdout.close()
   print "Leaving getCameraCPoint.parseVicarLabel.py and returning cx, cy, cz: ",cx,cy,cz
   return (cx,cy,cz)


def getCameraAxis(fname):
   print "Entering getCameraAxis.parseVicarLabel.py"
   os.system('v2param -rm')

   # get the X coordinate
   p1 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_2','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=1'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ax = p2.stdout.readline().strip()
   p2.stdout.close()

   # get the Y coordinate
   p3 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_2','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=2'),stdout=PIPE)
   p3.wait()
   p3.stdout.close()

   p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p4.wait()
   ay = p4.stdout.readline().strip()
   p4.stdout.close()

   # get the Z coordinate
   p5 = Popen((GETLAB,fname,'lab_item=MODEL_COMPONENT_2','-real','-prop','itm_task=GEOMETRIC_CAMERA_MODEL','element=3'),stdout=PIPE)
   p5.wait()
   p5.stdout.close()

   p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p6.wait()
   az = p6.stdout.readline().strip()
   p6.stdout.close()
   print "Leaving getCameraCPoint.parseVicarLabel.py and returning ax, ay, az: ",ax,ay,az



def getOriginRotationQuaternion(fname):
   print "Entering getOriginRotationQuarternion.parseVicarLabel.py"
   os.system('v2param -rm')

   # get the s value
   p1 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=1'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()

   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   s = p2.stdout.readline().strip()
   p2.stdout.close()

   # get the v1 value
   p3 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=2'),stdout=PIPE)
   p3.wait()
   p3.stdout.close()

   p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p4.wait()
   v1 = p4.stdout.readline().strip()
   p4.stdout.close()

   # get the v2 value
   p5 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=3'),stdout=PIPE)
   p5.wait()
   p5.stdout.close()

   p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p6.wait()
   v2 = p6.stdout.readline().strip()
   p6.stdout.close()

   # get the v3 value
   p7 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM','element=4'),stdout=PIPE)
   p7.wait()
   p7.stdout.close()

   p8 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p8.wait()
   v3 = p8.stdout.readline().strip()
   p8.stdout.close()

   
   if not s:
      print("Using alternate itm name convention")
      
      
      # get the s value
      p1 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=1'),stdout=PIPE)
      p1.wait()
      p1.stdout.close()

      p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p2.wait()
      s = p2.stdout.readline().strip()
      p2.stdout.close()

      # get the v1 value
      p3 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=2'),stdout=PIPE)
      p3.wait()
      p3.stdout.close()

      p4 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p4.wait()
      v1 = p4.stdout.readline().strip()
      p4.stdout.close()

      # get the v2 value
      p5 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=3'),stdout=PIPE)
      p5.wait()
      p5.stdout.close()

      p6 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p6.wait()
      v2 = p6.stdout.readline().strip()
      p6.stdout.close()

      # get the v3 value
      p7 = Popen((GETLAB,fname,'lab_item=ORIGIN_ROTATION_QUATERNION','-real','-prop','itm_task=ROVER_COORDINATE_SYSTEM_PARMS','element=4'),stdout=PIPE)
      p7.wait()
      p7.stdout.close()

      p8 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
      p8.wait()
      v3 = p8.stdout.readline().strip()
      p8.stdout.close()
   
   
   print "Leaving getOriginRotationQuarternion.parseVicarLabel.py and returning s, v1, v2, v3: ",s,v1,v2,v3
   return (s,v1,v2,v3)
 
 
   
 
 
 

def getSite(fname):
   print "Entering getSite.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=1'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   site = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getSite.parseVicarLabel.py and returning site: ",site
   return site

def getDrive(fname):
   print "Entering getDrive.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=2'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   drive = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getDrive.parseVicarLabel.py and returnin drive: ",drive
   return drive 

def getPose(fname):
   print "Entering getPose.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=3'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   pose = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getPose.parseVicarLabel.py and returning pose",pose
   return pose

def getArm(fname):
   print "Entering getArm.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=4'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   arm = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getArm.parseVicarLabel.py and returning arm: ",arm
   return arm

def getChimra(fname):
   print "Entering getChimra.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=5'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   chimra = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getChimra.parseVicarLabel.py and returning chimra: ",chimra
   return chimra

def getDrill(fname):
   print "Entering getDrill.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=6'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   drill = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getDrill.parseVicarLabel.py and returning drill: ",drill
   return drill

def getRsm(fname):
   print "Entering getRsm.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=7'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   rsm = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getRsm.parseVicarLabel.py and returning rsm: ",rsm
   return rsm

def getHga(fname):
   print "Entering getHga.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=8'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   hga = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getHga.parseVicarLabel.py and returning hga: ",hga
   return hga

def getDrt(fname):
   print "Entering getDrt.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=9'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   drt = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getDrt.parseVicarLabel.py and returning drt: ",drt
   return drt

def getIc(fname):
   print "Entering getIc.parseVicarLabel.py"
   p1 = Popen((GETLAB,fname,'lab_item=ROVER_MOTION_COUNTER','-int','-prop','itm_task=IDENTIFICATION','element=10'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ic = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getIc.parseVicarLabel.py and returning ic: ",ic
   return ic


def getAz(fname):
   print "Entering getAz.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=INSTRUMENT_AZIMUTH','-real','-prop','itm_task=SITE_DERIVED_GEOMETRY_PARMS'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   az = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getAz.parseVicarLabel.py and returning az: ",az
   return az

def getEl(fname):
   print "Enterting getEl.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=INSTRUMENT_ELEVATION','-real','-prop','itm_task=SITE_DERIVED_GEOMETRY_PARMS'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   el = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getEl.parseVicarLabel.py and returning el: ",el
   return el


def getCcamLibsSamp(fname):
   print "Entering getCcamLibsSamp.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=SPECIAL_SAMPLE','-int','-prop','itm_task=INSTRUMENT_STATE_PARMS'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ccamLibsSamp = p2.stdout.readline().strip()
   p2.stdout.close()
   print"Leaving getCcamLibsSamp.parseVicarLabel.py and returning ccamLibsSamp: ",ccamLibsSamp
   return ccamLibsSamp

def getCcamLibsLine(fname):
   print "Entering getCcamLibsLine.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=SPECIAL_LINE','-int','-prop','itm_task=INSTRUMENT_STATE_PARMS'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
    
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ccamLibsLine = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getCcamLibsLine.parseVicarLabel.py and returning ccamLibsLine: ",ccamLibsLine
   return ccamLibsLine

def getCcamFocus(fname):
   print "Entering getCcamLibsLine.parseVicarLabel.py"
   os.system('v2param -rm')

   p1 = Popen((GETLAB,fname,'lab_item=INSTRUMENT_FOCUS_DISTANCE','-int','-prop','itm_task=OBSERVATION_REQUEST_PARMS'),stdout=PIPE)
   p1.wait()
   p1.stdout.close()
   
   p2 = Popen((V2PARAM,'ITM_NAME'),stdout=PIPE)
   p2.wait()
   ccamFocus = p2.stdout.readline().strip()
   p2.stdout.close()
   print "Leaving getCcamFocus.parseVicarLabel.py and returning ccamFocus: ",ccamFocus
   return ccamFocus


def getRoverMotionCounter(fname):
   print "Entering getRoverMotionCounter.parseVicarLabel.py"
   site   = getSite(fname)
   drive  = getDrive(fname)
   pose   = getPose(fname)
   arm    = getArm(fname)
   chimra = getChimra(fname)
   drill  = getDrill(fname)
   rsm    = getRsm(fname)
   hga    = getHga(fname)
   drt    = getDrt(fname)
   ic     = getIc(fname)

   print "Leaving getRoverMotionCounter.parseVicarLabel.py and returning site,drive,pose,arm,chimra,drill,rsm,hga,drt,ic: ",site,drive,pose,arm,chimra,drill,rsm,hga,drt,ic
   return (site,drive,pose,arm,chimra,drill,rsm,hga,drt,ic)





def main(argv):
   print "Entering main(argv).parseVicarLabel.py"
   fname = argv[0]
   nl    = getNumLines(fname)
   ns    = getNumSamples(fname)
   inst  = getInstrumentId(fname)
   rover = getSpacecraftId(fname)
   seqid = getSeqId(fname)
   pdn   = getPlanetDayNumber(fname)
   sclk  = getSclk(fname)
   oov   = getOriginOffsetVector(fname)
   q     = getOriginRotationQuaternion(fname)
   rmc   = getRoverMotionCounter(fname)
   az    = getAz(fname)
   el    = getEl(fname)
   c     = getCameraCPoint(fname)
   lmst  = getLMST(fname)
   ltst  = getLTST(fname)  
   
   print
   print "NL x NS: ", nl, ns
   print "Rover ", rover
   print "Inst", inst
   print "Sol ", pdn
   print "Sclk ", sclk
   print "OOV (",oov[0],oov[1],oov[2],")"
   print "Quat (",q[0],q[1],q[2],q[3],")"
   print "RMC (",rmc[0],rmc[1],rmc[2],rmc[3],rmc[4],rmc[5],rmc[6],rmc[7],rmc[8],rmc[9],")"
   print "Az,El (",az, el,")"
   print "C Point (",c[0],c[1],c[2],")"
   print 
   print "fname ",fname
   print "nl ", nl
   print "ns ",ns
   print "lmst ", lmst
   print "ltst ", ltst
   print ""
   print "seqid ",seqid

   print "Leaving main(argv).parseVicarLabel.py and returning fname,nl,ns,inst,rover,pdn,sclk,oov,q,rmc,az,el,seqid: ",fname,nl,ns,inst,rover,pdn,sclk,oov,q,rmc,az,el,seqid
   return fname,nl,ns,inst,rover,pdn,sclk,oov,q,rmc,az,el,seqid
   
   
if (__name__ == '__main__'):
   main(sys.argv[1:]) 
