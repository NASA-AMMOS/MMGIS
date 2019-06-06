<?php
  $old = umask(0);
  echo makeMission( urldecode($argv[1]), urldecode($argv[2]) );
  umask( $old );
	
  function makeMission( $missionname, $password ) {
    $status = 'success';
    $message = 'Successfully Created Mission for ' . $missionname . '.';
    //Get lowercased array a folders under MMGIS/Missions
    $currentMissionFolders = scandir( 'Missions' );
    $currentMissionFolders = array_map( 'strtolower', $currentMissionFolders );

    //Check that mission name is not used
    if( !in_array( strtolower( $missionname ), $currentMissionFolders ) ) {
      //cp resources/MissionTemplate to ../Missions
      if( $status == 'success' ) {
        $cpMT = cpMissionTemplate( 'Missions', $missionname );
        if( !$cpMT ) {
          $status = 'failure';
          $message = 'Failed to Created MissionTemplate for ' . $missionname;
        }
      }

      //Update [missionname]/config.json's msv mission
      if( $status == 'success' ) {
        $uCMN = updateConfigJSONMissionName( 'Missions', $missionname );
        if( !$uCMN ) {
          $status = 'failure';
          $message = 'Failed to Update config.json for ' . $missionname;
        }
      }

      //Add missionname to configconfig.json
      if( $status == 'success' ) {
        $aCCMN = addConfigconfigJSONMissionName( 'config', $missionname );
        if( !$aCCMN ) {
          $status = 'failure';
          $message = 'Failed to Add Mission ' . $missionname . ' to configconfig.json';
        }
      }

      //Add password
      if( $status == 'success' ) {
        $aMP = addMissionPassword( $missionname, $password );
        if( !$aMP ) {
          $status = 'failure';
          $message = 'Failed to Update config.sqlite3 with ' . $missionname . '';
        }
      }
    }
    else {
      $status = 'failure';
      $message = 'Mission folder ' . $missionname . ' already exists.';
    }
    return json_encode( array( 'status' => $status, 'message' => $message ) );
  }

  function cpMissionTemplate( $to, $named ) {
    //Mission Name
    if( !mkdir( $to . '/' . $named, 0777 ) ) return false;
      //Data
      if( !mkdir( $to . '/' . $named . '/Data', 0777 ) ) return false;
      //Database
      if( !mkdir( $to . '/' . $named . '/Database', 0777 ) ) return false;
        //mmgis.sqlite3
        if( !copy( 'config/resources/MissionTemplate/Database/mmgis.sqlite3', $to . '/' . $named . '/Database/mmgis.sqlite3' ) ) return false;
        if( !chmod( $to . '/' . $named . '/Database/mmgis.sqlite3', 0666 ) ) return false;
      //Drawn
      if( !mkdir( $to . '/' . $named . '/Drawn', 0777 ) ) return false;
        //_speDrawings.geojson
        if( !copy( 'config/resources/MissionTemplate/Drawn/_speDrawings.geojson', $to . '/' . $named . '/Drawn/_speDrawings.geojson' ) ) return false;
        if( !chmod( $to . '/' . $named . '/Drawn/_speDrawings.geojson', 0666 ) ) return false;
      //Layers
      if( !mkdir( $to . '/' . $named . '/Layers', 0777 ) ) return false;
      //config.json
      if( !copy( 'config/resources/MissionTemplate/config.json', $to . '/' . $named . '/config.json' ) ) return false;
      if( !chmod( $to . '/' . $named . '/config.json', 0666 ) ) return false;

    return true;
  }

  function updateConfigJSONMissionName( $at, $named ) {
    //Get config.json
    $configjsonFile = file_get_contents( $at . '/' . $named . '/config.json' );
    if( $configjsonFile === false ) return false;
    $configjson = json_decode( $configjsonFile, true );

    //Change the mission name
    $configjson['msv']['mission'] = $named;

    //Write it back out
    $newConfigjsonFile = json_encode( $configjson, JSON_PRETTY_PRINT );
    file_put_contents( $at . '/' . $named . '/config.json', $newConfigjsonFile );

    return true;
  }

  function addConfigconfigJSONMissionName( $at, $named ) {
    //Get configconfig.json
    $configconfigjsonFile = file_get_contents( $at . '/configconfig.json' );
    if( $configconfigjsonFile === false ) return false;
    $configconfigjson = json_decode( $configconfigjsonFile, true );

    //Change the mission name
    $configconfigjson['missions'][] = $named;

    //Write it back out
    $newConfigconfigjsonFile = json_encode( $configconfigjson, JSON_PRETTY_PRINT );
    file_put_contents( $at . '/configconfig.json', $newConfigconfigjsonFile );

    return true;
  }

  function addMissionPassword( $mission, $password ) {
    //Open the database
    $dir = 'sqlite:config/db/config.sqlite3';
    try {
      $conn = new PDO( $dir );
    }
    catch( PDOException $e ) {
      return false;
    }
    //Hash the pass
    $pass = md5( $password );
    //Insert the entry
    $stmt = $conn->prepare("INSERT INTO Passwords (mission, password) VALUES (:mission, :password)");
    $stmt->bindParam(':mission', strtolower( $mission ));
    $stmt->bindParam(':password', $pass);
    
    try {
      // $conn->exec( $sql );
      $stmt->execute();
      $conn = null;
      return true;
    }
    catch( Exception $e ) {
      $conn = null;
      return false;
    }
  }
?>