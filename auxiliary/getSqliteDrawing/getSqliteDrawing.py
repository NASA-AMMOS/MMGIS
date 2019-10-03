#!/usr/bin/env python

import os
import sys
import argparse
import sqlite3 as sqlite
import json


def main( arguments ):

    parser = argparse.ArgumentParser(
        description="Writes out the geojson from a user's file in a mmgis.sqlite3",
        formatter_class=argparse.RawDescriptionHelpFormatter )
    parser.add_argument( 'dbpath', help='path to an mmgis.sqlite3 database' )
    parser.add_argument( 'username', help='name of a user in the database' )
    parser.add_argument( 'filename', help="name of the user's file you wish to extract the geojson from" )
    parser.add_argument( 'output', help='output .geojson path and name' )
    parser.add_argument( '-p', '--prettify', help='prettify the outputted json', action='store_true' )

    args = parser.parse_args( arguments )

    conn = None

    args.output = os.path.splitext( args.output )[0] + '.geojson'

    response = 'y'
    if os.path.isfile( args.output ):
        if sys.version_info[0] > 2:
            response = input( args.output + ' already exists. Overwrite it? (y/!y) ' )
        else:
            response = raw_input( args.output + ' already exists. Overwrite it? (y/!y) ' )
    print
    if response.lower() != 'y' :
        print( 'FAILURE: Quiting... Nothing altered.' )
        sys.exit(1)

    try:
        conn = sqlite.connect( args.dbpath )

        cur = conn.cursor()
        cur.execute( "SELECT data FROM userfiles WHERE username='%s' AND name='%s'" % ( args.username, args.filename ) )

        data = cur.fetchone()
        if not data:
            print( 'FAILURE: Not found in database.' )
            sys.exit(1)

        file = open( args.output, 'w' )

        indentation = None
        if( args.prettify ):
            indentation = 4;
        geojson = json.dumps( json.loads( data[0] ), indent=indentation )

        file.write( geojson )
        file.close()
        print( "SUCCESS: Created %s from %s's %s." % ( args.output, args.username, args.filename ) )

    except Exception as e:
        print( 'FAILURE: %s' % e.args[0] )
        sys.exit(1)

    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    sys.exit( main( sys.argv[1:] ) )