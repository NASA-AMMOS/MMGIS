'''
Tariq Soliman 7/3/2018
Tariq.K.Soliman@jpl.nasa.gov

Clones an MMGIS mission (everything except data and database files)

Usage:
    cloneMission.py {-paths} [mission_to_clone] [as_new_mission_name] [with_this_new_password]
'''

import os
import sys
import json
import subprocess
import shutil
from collections import OrderedDict

from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter


def parse_args():
    # Parse input arguments
    parser = ArgumentParser(
        description='Clones an MMGIS mission (everything except data and database files).',
        formatter_class=ArgumentDefaultsHelpFormatter
    )
    parser.add_argument( 'existing', help='Name of an existing mission to clone (Case-Sensitive)' )
    parser.add_argument( 'clone', help='Name for the outputted clone' )
    parser.add_argument( 'password', help='Password for the outputted clone' )
    parser.add_argument( '-paths', action='store_true', help='Make new mission paths point back: ../[existing]/+url' )

    args = parser.parse_args()
    return args

def setAllKeys( data, prepend ):
    if isinstance(data, OrderedDict):
        for k, v in data.iteritems():
            if isinstance(v, OrderedDict):
                setAllKeys( v, prepend )
            elif isinstance(v, list):
                setAllKeys( v, prepend )
            else:
                if k == 'url' or k == 'demtileurl' or k == 'legend':
                    data[k] = prepend + '' + data[k]
    elif isinstance(data, list):
        for v in data:
            if isinstance(v, OrderedDict):
                setAllKeys( v, prepend )
            elif isinstance(v, list):
                setAllKeys( v, prepend )

def configureCloneConfig( existing, clone, paths ):
    with open('../../Missions/' + clone + '/config.json', 'r+') as f:
        data = json.load(f, object_pairs_hook=OrderedDict)
        data['msv']['mission'] = clone

        if paths:
            setAllKeys( data, '../' + existing + '/' )

        f.seek(0)
        json.dump(data, f, indent=4)
        f.truncate()

def cloneMission( existing, clone, password, paths ):
    # Make a normal new mission
    print 'Making mission ' + clone + '.'

    proc = subprocess.Popen(["php", "../php/make_mission.php", clone, password], stdout=subprocess.PIPE)
    script_response = json.loads(proc.stdout.read())

    if( script_response['status'] == 'success' ):
        print 'Successfully made mission.'
        # Copy exising's config.json to clone's
        print "Cloning " + existing + "'s configuration into " + clone + "'s."
        try:
            shutil.copy( '../../Missions/' + existing + '/config.json', '../../Missions/' + clone + '/' )
            print( 'Successfully cloned configuration!' )
            print( 'Tweaking config.json' )
            # Rename config.json msv.mission to clone
            configureCloneConfig( existing, clone, paths )

            print( 'Successfully cloned mission!' )
        except IOError, e:
            print 'Unable to clone configuration.'
            print '\t' + str(e)
    else:
        print 'Failed to make mission.'
        print '\t' + script_response['message']


if __name__ == '__main__':
    pargs = parse_args()
    cloneMission( pargs.existing, pargs.clone, pargs.password, pargs.paths )
