#! /tps/bin/python

"""This is a dictionary for rover instrument information including type and pos"""


#   INST           :  [ TYPE ],[ POS ],[p2xyz intersection type],[stereo],[intersection method]
InstDic = {
   'DAN'           : ['fixed','-0.83,0,0'],
   'REMS'          : ['fixed','0.71402,0.55903,0.42556','','',''],
   'FHAZ_LEFT_A'   : ['fixed','1.03304,-0.17145,-0.707908','','',''],#needs to be updated
   'FHAZ_LEFT_B'   : ['fixed','1.03304,-0.17145,-0.707908','','',''],#needs to be updated
   'FHAZ_RIGHT_A'  : ['fixed','1.03314,-0.004912,-0.708098','','',''],#needs to be updated
   'FHAZ_RIGHT_B'  : ['fixed','1.03314,-0.004912,-0.708098','','',''],#needs to be updated
   'RHAZ_LEFT_A'   : ['fixed','-0.975657,0.552157,-0.780044','','',''],#needs to be updated
   'RHAZ_LEFT_B'   : ['fixed','-0.975657,0.552157,-0.780044','','',''],#needs to be updated
   'RHAZ_RIGHT_A'  : ['fixed','-0.975248,0.451863,-0.780144','','',''],#needs to be updated
   'RHAZ_RIGHT_B'  : ['fixed','-0.975248,0.451863,-0.780144','','',''],#needs to be updated
   'CHEMIN'        : ['fixed','0.76,-0.12,-1.15','','',''],
   'RAD'           : ['fixed','0.16,-0.3,-1.14','','',''], 
   'SAM'           : ['fixed','0.6672,0.51500,0.11788','','',''], 
   'MARDI'         : ['fixed','0.761636,-0.648275,-0.701654','','',''], 
   
   'NAV_LEFT_A'   : ['mast','','IMG_CTR','stereo','flat'],
   'NAV_RIGHT_A'  : ['mast','','IMG_CTR','stereo','flat'],
   'NAV_LEFT_B'   : ['mast','','IMG_CTR','stereo','flat'],
   'NAV_RIGHT_B'  : ['mast','','IMG_CTR','stereo','flat'],
   'MAST_LEFT'     : ['mast','','IMG_CTR','stereo','flat'],
   'MAST_RIGHT'    : ['mast','','IMG_CTR','stereo','flat'],
   'CHEMCAM_RMI'   : ['mast','','IMG_CTR','mono','range'],
   'CHEMCAM_LIBS'  : ['mast','','IMG_LS','offset','range'],
   #'CHEMCAM_SOH'   : ['mast','','IMG_CTR','',''],
   #'CHEMCAM_PARMS' : ['mast','','','','',''],
   
   'MAHLI'         : ['contact','','UNIT','',''],
   'APXS'          : ['contact','','UNIT','',''] 
   }
   
