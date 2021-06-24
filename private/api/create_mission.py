import sys
import json
import os.path
from os import listdir, makedirs
try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote


def make_mission(mission_name):
    status = 'success'
    message = 'Successfully Created Mission for ' + mission_name + '.'

    # Get lowercased array of folders under MMGIS/Missions
    current_mission_folders = [str(x).lower() for x in listdir('Missions')]

    # Check that mission name is not used
    if (mission_name.lower() not in current_mission_folders):
        copy_success = copy_mission_template('Missions', mission_name)

        if copy_success is False:
            status = 'failure'
            message = 'Failed to Created MissionTemplate for ' + mission_name
    else:
        status = 'failure'
        message = 'Mission folder ' + mission_name + ' already exists.'

    response = {}
    response['status'] = status
    response['message'] = message
    return response


def copy_mission_template(location, mission):

    # Don't allow directory transversal
    if mission.startswith('.'):
        return False
    mission_path = os.path.join(location, mission)
    if os.path.abspath(mission_path).startswith(os.path.abspath(location)):
        if os.path.exists(mission_path) is False:
            # Mission Name
            makedirs(mission_path, mode=0o777)
            # Data
            makedirs(os.path.join(mission_path, 'Data'), mode=0o777)
            # Layers
            makedirs(os.path.join(mission_path, 'Layers'), mode=0o777)
        else:
            return False
    else:
        return False

    return True


mission_name = unquote(sys.argv[1])
print(json.dumps(make_mission(mission_name)))
