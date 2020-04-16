#! /tps/bin/python

import os
import sys
import netrc
import requests
import urlparse
import urllib2
import subprocess
import argparse
from HTMLParser import HTMLParser
import re
import glob
import logging, os, shlex, smtplib, uuid
from lxml import etree
import subprocess as sp

""" Set up for places translation calls"""


def getPlacesNetloc(venue):
   if venue == 'dev':
      netloc = 'mslopgsdev1-t.jpl.nasa.gov:9443'
   elif venue == 'ops':
      netloc = 'mslplaces.jpl.nasa.gov:9443'
   else:
      raise SystemExit("Invalid PLACES venue specified")

   return netloc


def getLocoSiteTranslation(venue,pos,site,drive,loco):
   ###venue = 'dev' # temporary override for places fix in dev
   venue = 'ops'  # temporary override 
   scheme = "https://"
   netloc = getPlacesNetloc(venue)
   if venue == 'ops':
      path = 'msl-ops/places/query/translation/point/%s/localized_interp' %(pos)
   
   elif venue == 'dev':
      path = 'places/msl/dev/query/translation/point/%s/localized_interp' %(pos)

   ### temporary override for 
   if loco == 'rover2orbital':
      query = 'from=ROVER(%s,%s)&to=ORBITAL(0)&toView=localized_interp' %(site,drive)
   elif loco == 'rover2site':
      query = 'from=ROVER(%s,%s)&to=SITE(%s)&toView=localized_interp' %(site,drive,site)
   elif loco == 'site2orbital':
      query = 'from=SITE(%s)&to=ORBITAL(0)&toView=localized_interp' %(site)
   elif loco == 'local2orbital':
      query = 'from=LOCAL_LEVEL(%s,%s)&to=ORBITAL(0)&toView=localized_interp' %(site,drive)
   print query
   print path

   '''
   params = ''
   fragment = ''
   urlparts = (scheme,netloc,path,params,query,fragment)
   url = urlparse.urlunparse(urlparts)
   print url
   host = urlparse.urlparse(url).hostname
   info = netrc.netrc().authenticators(host)
   user = info[0]
   passwd = info[2]

   response = requests.get(url,auth=requests.auth.HTTPBasicAuth(user,passwd))
   text = response.text
   response.close()
   '''

   ### temporary workaround due to outdated msl python version
   curl_command = "curl -k -n '" + scheme +  netloc + '/' + path + '?' + query  + "'"
   print curl_command

   places_process = sp.Popen(shlex.split(curl_command),stdout=sp.PIPE)
   places_txt, _ = places_process.communicate()

   
   print places_txt
   places_xml = etree.fromstring(places_txt)
   ###places_xml = ET.fromstring(places_txt)

   offset = places_xml.find('{http://places.msl.mipl.jpl/xml/msl/schema}offset')
   x = float(offset.get('x'))
   y = float(offset.get('y'))
   z = -(float(offset.get('z')))

   return x,y,z

def getLocoRover(venue,site,drive,loco):
   #venue = 'dev' # temporary override for places fix in dev
   venue = 'ops'  # temporary override 

   scheme = "https://"
   netloc = getPlacesNetloc(venue)
   if venue == 'ops':
      #path = 'msl-ops/places/query/translation/point/%s/localized_interp' %(pos)
      path = 'msl-ops/places/query/primary/localized_interp'
   elif venue == 'dev':
      #path = 'places/msl/dev/query/translation/point/%s/localized_interp' %(pos)
      path = 'places/msl/dev/query/primary/localized_interp'
   ### temporary override for 
   if loco == 'rover2orbital':
      query = 'from=ROVER(%s,%s)&to=ORBITAL(0)' %(site,drive)
   elif loco == 'rover2site':
      query = 'from=ROVER(%s,%s)&to=SITE(%s)&toView=localized_interp' %(site,drive,site)
   elif loco == 'site2orbital':
      query = 'from=SITE(%s)&to=ORBITAL(0)&toView=localized_interp' %(site)
   elif loco == 'local2orbital':
      query = 'from=LOCAL_LEVEL(%s,%s)&to=ORBITAL(0)&toView=localized_interp' %(site,drive)
   print query
   print path



   ### temporary workaround due to outdated msl python version
   curl_command = "curl -k -n '" + scheme +  netloc + '/' + path + '?' + query  + "'"  
   print curl_command

   places_process = sp.Popen(shlex.split(curl_command),stdout=sp.PIPE)
   places_txt, _ = places_process.communicate()

   
   print places_txt
   places_xml = etree.fromstring(places_txt)


   offset = places_xml.find('{http://places.msl.mipl.jpl/xml/msl/schema}offset')
   x = float(offset.get('x'))
   y = float(offset.get('y'))
   z = -(float(offset.get('z')))

   return x,y,z
