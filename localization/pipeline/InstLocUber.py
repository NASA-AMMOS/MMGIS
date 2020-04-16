#!/tps/bin/python

#******************************************************************************
#  InstLocUber.py <inst> <beginning of sol range> <end of sol range>
# 
#  Project:  Instrument Localization for instruments in a given sol
#  Purpose:  Localizations for instruments in planetary global frame
#           
#  Author:   Hallie Gengl
#  Date:     4/29/2016
#
#  Updated:  8/24/18 Corrine Rojas (crojas6@asu.edu) 
#  Updated:  6/26/19 Hallie Gengl
#******************************************************************************

import os
import argparse
import glob
import parseVicarLabel
import InstLoc
from InstLoc import LocArray as LocArray
import csv
import datetime




def BulkInstLoc(inst, sol):
    #inputs instrument as defined in ods filepath style and sol
    #returns a list of EDRs for a given sol and instrument
    print "Here is LocArray from InstLocUber.py: ",LocArray
    print "Here is dict.keys(LocArray) from InstLocUber.py: ",dict.keys(LocArray)
    doAllSol(inst,sol)


def doAllSol(inst,sol):
    """writes out a csv file for all attributes
    of a given instrument sol and insturment
    Returns: El,Stereo,SeqID,Sclk,Frame,Mission,
    Sol,RMC,OOV,Inst,LocType,DataProduct,QUAT,
    ObsType,Eas,Az,Elev,Method,Nor,Cpnt"""
	
    print "Entering doAllSol.BulkInstLoc.InstLocUber.py "
    flist = findFiles(inst,sol)
    if  len(flist) == 0:
        print "No data products for Sol: " + str(sol) + ", Skipping to Next Sol"
    else:
        filename = sol + '_' + inst +'.csv'
        print "- - - - - START OF DOALLSOL.LOOP: Here is filename from doAllSol.InsLocUber.py: ",filename
        header = dict.keys(LocArray)
        i = 0
        print "- - - - - START OF DOALLSOL.LOOP: HERE IS THE HEADER AND I: ", header," AND: ",i
        with open(filename,'a') as f:
            for files in flist:
                apid = parseVicarLabel.getApIdName(files) #make this more efficient
                print "File: " + files + ", has APID: " + apid 
                if apid == "McamLRecoveredProduct":
                    print "APID_NAME McamLRecoveredProduct is invalid."
                elif apid == "McamRRecoveredProduct":
                    print "APID_NAME McamRRecoveredProduct is invalid."
                elif apid == "McamLRecoveredThumbnail":
                    print "APID_NAME McamLRecoveredThumbnail is invalid."
                elif apid == "McamRRecoveredThumbnail":
                    print "APID_NAME McamRRecoveredThumbnail is invalid."
                elif apid == "RADSendData":
                    print "APID_NAME RADSendData is invalid."
                elif apid == "MrdiRecoveredProduct":
                    print "APID_NAME MrdiRecoveredProduct is invalid."
                else:
                    #	continue
                    print "filess: ",files
				
                loc = InstLoc.InstLocDB(files)
                #print "Here is files from doAllSol.InstLocUber.py: ",files
                print "- - - - - DOALLSOL.LOOP: Here is files from doAllSol.InstLocUber.py: ",files," AND HERE IS LOC: ",loc
                w = csv.DictWriter(f, loc.keys())
                print "- - - - - DOALLSOL.LOOP: HERE IS W: ",w,"  WHICH IS CSV.DICTWRITER USING F: ",f," AND LOC.KEYS"
                while i < 1:
                    w.writeheader()
                    i += 1
                print "- - - - - DOALLSOL.LOOP: HERE IS I: ",i

                w = csv.DictWriter(f, loc.keys())
                w.writerow(loc)
                print "Leaving doAllSol.InstLocUber.py with this w variable: ",w


def findFiles(inst,sol):
    print "Entering findFiles.BulkInstLoc.InstLocUber.py "
    #path = '/proj/msl/redops/ods/surface/sol/%s/opgs/edr/%s/'  %(sol,inst)
    #searchStr = os.environ['ODS_SOL'] + '/' + sol.zfill(5) + '/opgs/edr/' + inst + '/' + '*[ID][MA][GT]'
    searchStr = '/proj/msl/redops/ods/surface/sol/' + sol.zfill(5) + '/opgs/edr/' + inst + '/' + '*[ID][MA][GT]'
    print "Here is searchStr from findFiles.BulkInstLoc.InstLocUber.py: ", searchStr
    flist =  glob.glob(str(searchStr))
	
    print "Leaving findFiles.BulkInstLoc.InstlocUber.py and returning: ",flist 	
    return flist	
	
 

def main():
    
    try:
        os.environ['R2LIB']
    except KeyError as e:
        print "%s is not set, run select" % (e)
        raise SystemExit

    print "Entering Main loop [ArmInstLoc]"


    parser = argparse.ArgumentParser(description='Localize an instrument type over a sol range.')
    parser.add_argument("inst",metavar='Instrument', type=str, choices=['apxs', 'ccam', 'dan', 'fcam', 'ncam', 'mhli', 'mrdi', 'mcam', 'rcam', 'rems', 'sam'],
    help='list a rover instrument: ccam, ncam, mcam, apxs, dan, mahli, etc')
    parser.add_argument("ssol", metavar='Start_Sol', type=int,
    help='list a starting sol range')
    parser.add_argument("esol", metavar='Ending_Sol', type=int,
    help='list a ending sol range')
    args = parser.parse_args()
    #usage = "%(prog)s <inst> <beginning of sol range> <end of sol range>"
   	#parser = argparse.ArgumentParser(usage=usage,formatter_class=argparse.ArgumentDefaultsHelpFormatter)
   	#parser.add_argument("filen",metavar="filen",help="OBSERVATION FILENAME")
   	#args = parser.parse_args()

    inst = args.inst
    ssol = args.ssol
    esol = int(args.esol)
    print inst, ssol, esol
    #esol += 1 
        
    for sol_num in range(ssol, esol):
        input_sol = sol_num
        print "This is plain input_sol from the sol_num: ",input_sol

        sol = str(input_sol)
        print "Processing sol number: ",sol_num
        print "instrument: ", inst
        BulkInstLoc(inst, sol)
        print "- - - - - Ending main forloop for InstLocUber with round: ",inst,sol," at datetime: ",datetime.datetime.now(),"   - - - - - "




if (__name__ == "__main__"):
    print
    main()
    print 


