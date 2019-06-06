//Assumes mmgisglobal set
console.log( mmgisglobal );

var calls = {};

if( mmgisglobal.SERVER == 'apache' ) {
    calls = {
        configconfigPath: 'configconfig.json',
        missionPath: '../Missions/',
        verify: {
            type: 'POST',
            url: 'php/verify.php'
        },
        write_json: {
            type: 'POST',
            url: 'php/write_json.php',
            pathprefix: '../'
        },
        make_mission: {
            type: 'POST',
            url: 'php/make_mission.php'
        },
        delete_mission: {
            type: 'POST',
            url: 'php/delete_mission.php'
        },
        clone_mission: {
            type: 'POST',
            url: 'php/clone.php'
        },
        rename_mission: {
            type: 'POST',
            url: 'php/rename_mission.php'
        }
    };
}
else if( mmgisglobal.SERVER == 'node' ) {
    calls = {
        configconfigPath: 'config/configconfig.json',
        missionPath: 'Missions/',
        verify: {
            type: 'POST',
            url: 'api/config/verify'
        },
        write_json: {
            type: 'POST',
            url: 'api/config/write_json',
            pathprefix: ''
        },
        make_mission: {
            type: 'POST',
            url: 'api/config/make_mission'
        },
        delete_mission: {
            type: 'POST',
            url: 'api/config/delete_mission'
        },
        clone_mission: {
            type: 'POST',
            url: 'api/config/clone_mission'
        },
        rename_mission: {
            type: 'POST',
            url: 'api/config/rename_mission'
        }
    };
}
else {
    console.warn( 'Unknown SERVER: ' + mmgisglobal.SERVER );
}