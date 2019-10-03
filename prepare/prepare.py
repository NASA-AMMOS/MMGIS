'''
Tariq Soliman 10/2/2017
Tariq.K.Soliman@jpl.nasa.gov

Switches the MMGIS environment to release or development
    Switching to release sets up the default test mission
    and can limit access to tools

Usage Examples:
    prepare.py d                        # switch to Dev env
    prepare.py r                        # switch to Release env with all tools
    prepare.py r -t i all               # Rel env and Include ALL tools
    prepare.py r -t e all               # Rel env and Exclude ALL tools
    prepare.py r -t i all -t e draw     # Rel Include ALL Exclude DRAW
    prepare.py r -t i layers -t i draw  # Rel wih only LAYERS and DRAW Included
'''

import os
import sys
import json
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter

fullToolNames = []
fullToolNamesL = [] # lowercase
configconfig = None


def parse_args():
    # Parse input arguments
    parser = ArgumentParser(
        description='Turns MMGIS into a development environment or into a release with the exclusion of specified tools.',
        formatter_class=ArgumentDefaultsHelpFormatter
    )
    parser.add_argument( 'environment', choices=['r','d'], help='release or development' )
    parser.add_argument( '-t', '--tools', nargs=2, metavar=('i/e','tool'), action='append', help='A tool to include (tool name or all)' )

    args = parser.parse_args()
    return args


def getFullToolNames():
    # Get full tools
    global configconfig
    with open( 'baseConfigconfig.json' ) as json_data:
        configconfig = json.load(json_data)

        for t in configconfig['tools']:
            fullToolNames.append( t['name'].encode( 'ascii', 'ignore' ) )
            fullToolNamesL.append( t['name'].encode( 'ascii', 'ignore' ).lower() )


# MAIN ENVIRONMENT SETTERS
def set_rel_environment( toolList ):
    if toolList is None:
        toolList = [['i', 'all']]

    cwd = os.path.dirname( os.getcwd() )
    
    # Check whether Missions folders are not in release state 
    homeDirs = os.listdir( cwd )
    if( 'Missions_rel' in homeDirs and 'Missions' in homeDirs ):
        # Switch Missions to Missions_dev folder
        os.rename( cwd + '/Missions', cwd + '/Missions_dev' )
        # Switch Missions_rel to Missions folder
        os.rename( cwd + '/Missions_rel', cwd + '/Missions' )

    # Check whether configconfig.json is not in release state
    midPath = '/config'
    configDirs = os.listdir( cwd + midPath )
    if( 'configconfig_rel.json' in configDirs and 'configconfig.json' in configDirs ):
        # Switch configconfig.json to configconfig_dev.json
        os.rename( cwd + midPath + '/configconfig.json', cwd + midPath + '/configconfig_dev.json' )
        # Switch configconfig_rel.json to configconfig.json
        os.rename( cwd + midPath + '/configconfig_rel.json', cwd + midPath + '/configconfig.json' )
        # Change configconfig.json to reflect only the included tools

    # Check whether config.sqlite3 is not in release state
    midPath = '/config/db'
    configDbDirs = os.listdir( cwd + midPath )
    if( 'config_rel.sqlite3' in configDbDirs and 'config.sqlite3' in configDbDirs ):
        # Switch config.sqlite3 to config_dev.sqlite3
        os.rename( cwd + midPath + '/config.sqlite3', cwd + midPath + '/config_dev.sqlite3' )
        # Switch config_rel.sqlite3 to config.sqlite3
        os.rename( cwd + midPath + '/config_rel.sqlite3', cwd + midPath + '/config.sqlite3' )

    # Tell .gitignore to ignore include/exclude appropriate tool scripts
    includedTools = getIncludedTools( toolList )
    excludedTools = notTheseTools( includedTools )
    gitIgnoreTheseTools( excludedTools )
    configconfigIgnoreTheseTools( excludedTools )

def set_dev_environment():
    cwd = os.path.dirname( os.getcwd() )
    homeDirs = os.listdir( cwd )
    
    # Check whether Missions folders are not in development state 
    if( 'Missions_dev' in homeDirs and 'Missions' in homeDirs ):
        # Switch Missions to Missions_rel folder
        os.rename( cwd + '/Missions', cwd + '/Missions_rel' )
        # Switch Missions_dev to Missions folder
        os.rename( cwd + '/Missions_dev', cwd + '/Missions' )
     
    # Check whether configconfig.json is not in development state 
    midPath = '/config'
    configDirs = os.listdir( cwd + midPath )
    if( 'configconfig_dev.json' in configDirs and 'configconfig.json' in configDirs ):
        # Switch configconfig.json to configconfig_rel.json
        os.rename( cwd + midPath + '/configconfig.json', cwd + midPath + '/configconfig_rel.json' )
        # Switch configconfig_dev.json to configconfig.json
        os.rename( cwd + midPath + '/configconfig_dev.json', cwd + midPath + '/configconfig.json' )

    # Check whether config.sqlite3 is not in devlopment state
    midPath = '/config/db'
    configDbDirs = os.listdir( cwd + midPath )
    if( 'config_dev.sqlite3' in configDbDirs and 'config.sqlite3' in configDbDirs ):
        # Switch config.sqlite3 to config_rel.sqlite3
        os.rename( cwd + midPath + '/config.sqlite3', cwd + midPath + '/config_rel.sqlite3' )
        # Switch config_dev.sqlite3 to config.sqlite3
        os.rename( cwd + midPath + '/config_dev.sqlite3', cwd + midPath + '/config.sqlite3' )


# HELPER FUNCTIONS

# Parse command line -t arguments to return complete tool list requested
def getIncludedTools( toolList ):

    includedTools = []

    for a in toolList:
        if a[0] == 'i':
            if a[1] == 'all':
                includedTools = fullToolNamesL[:]
            elif a[1].lower() in ( tn.lower() for tn in fullToolNamesL ):
                if a[1].lower() not in ( it.lower() for it in includedTools ):
                    includedTools.append( a[1].lower() )
        elif a[0] == 'e':
            if a[1] == 'all':
                includedTools = []
            elif a[1].lower() in ( tn.lower() for tn in fullToolNamesL ):
                if a[1].lower() in ( it.lower() for it in includedTools ):
                    includedTools.remove( a[1] )

    return includedTools

# Returns !( includedTools ) of the tools set
def notTheseTools( includedTools ):
    excludedTools = []
    for t in fullToolNamesL:
        if t not in includedTools:
            excludedTools.append( t )
    return excludedTools

# Writes the .gitignore to ignore tool scripts
def gitIgnoreTheseTools( toolsToIgnore ):
    baseIgnore = open( 'base.gitignore', 'r' )
    trueIgnore = open( '../.gitignore', 'w' )
    #print toolsToIgnore
    # Place the base ignore in the file
    trueIgnore.write( baseIgnore.read() )
    for tti in toolsToIgnore:
        trueIgnore.write( '\nscripts/essence/Tools/' + fullToolNames[ fullToolNamesL.index( tti ) ] )

# Writes the config/configconfig.json to ignore tools
def configconfigIgnoreTheseTools( toolsToIgnore ):
    baseConfigconfig = open( 'baseConfigconfig.json', 'r' )
    baseConfigconfigJ = json.load( baseConfigconfig )

    for tti in toolsToIgnore:
        name = fullToolNames[ fullToolNamesL.index( tti ) ]
        for i, t in enumerate( baseConfigconfigJ['tools'] ):
            if t['name'] == name:
                del baseConfigconfigJ['tools'][i]

    trueConfigconfig = open( '../config/configconfig.json', 'w' )
    json.dump( baseConfigconfigJ, trueConfigconfig, indent=4, sort_keys=True )


if __name__ == '__main__':
    pargs = parse_args()
    env = pargs.environment.lower()
    tools = pargs.tools

    getFullToolNames();

    if env == 'r':
        set_rel_environment( tools )
    elif env == 'd':
        set_dev_environment()
