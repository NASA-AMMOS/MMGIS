#! /bin/python

"""This is a dictionary for rover instrument information including type and pos"""

import os
import sys


#INST, TYPE, POS, ...



InstDic = {
   'DAN'          : ['fixed','-0.83,0,0'],
   'REMS'         : ['fixed','0.71402,0.55903,0.42556'],
   'FHAZ_LEFT_A'  : ['fixed','1.03304,-0.17145,-0.707908'],
   'FHAZ_LEFT_B'  : ['fixed','1.03304,-0.17145,-0.707908'],
   'FHAZ_RIGHT_A' : ['fixed','1.03314,-0.004912,-0.708098'],
   'FHAZ_RIGHT_B' : ['fixed','1.03314,-0.004912,-0.708098'],
   'RHAZ_LEFT_A'  : ['fixed','-0.975657,0.552157,-0.780044'],
   'RHAZ_LEFT_B'  : ['fixed','-0.975657,0.552157,-0.780044'],
   'RHAZ_RIGHT_A' : ['fixed','-0.975248,0.451863,-0.780144'],
   'RHAZ_RIGHT_B' : ['fixed','-0.975248,0.451863,-0.780144'],
   'CHEMIN'       : ['fixed','0.76,-0.12,-1.15'],
   'RAD'          : ['fixed','0.16,-0.3,-1.14'], 
   'SAM'          : ['fixed','0.6672,0.51500,0.11788'], 
   'MARDI'        : ['fixed','0.761636,-0.648275,-0.701654'], 
   
   'NAV_LEFT_A'  : ['mast',''],
   'NAV_LEFT_B'  : ['mast',''],
   'NCAM_LEFT_A'  : ['mast',''],
   'NCAM_LEFT_B'  : ['mast',''],
   'NCAM_RIGHT_A' : ['mast',''],
   'NCAM_RIGHT_B' : ['mast',''],
   'NAV_RIGHT_A' : ['mast',''],
   'NAV_RIGHT_B' : ['mast',''],
   'MAST_LEFT'    : ['mast',''],
   'MAST_RIGHT'   : ['mast',''],
   'CHEMCAM_RMI'  : ['mast',''],
   'CHEMCAM_LIBS' : ['mast',''],
   'CHEMCAM_SOH'  : ['mast',''],
   'CHEMCAM_PARMS'  : ['mast',''],
   
   'MAHLI'        : ['contact',''],
   'APXS'         : ['contact',''] 
   }
   
