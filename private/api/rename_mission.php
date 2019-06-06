<?php

  echo renameMission( urldecode($argv[1]), urldecode($argv[2]) );

  function renameMission( $mission, $tomission ) {
    $status = 'success';
    $message = 'Successfully Renamed Mission ' . $mission . ' to ' . '$tomission';
    
    $currentMissionFolders = scandir( 'Missions' );
    $currentMissionFolders = array_map( 'strtolower', $currentMissionFolders );

    //Check that tomission name is not used
    if( !in_array( strtolower( $tomission ), $currentMissionFolders ) ) {
      //Rename Mission Folder
      if( $status == 'success' ) {
        $rMF = renameMissionFolder( $mission, $tomission );
        if( !$rMF ) {
          $status = 'failure';
          $message = 'Failed to Rename Mission Folder for ' . $mission;
        }
      }

      //Rename Configconfig Mission
      if( $status == 'success' ) {
        $rCMN = renameConfigconfigJSONMissionName( $mission, $tomission );
        if( !$rCMN ) {
          $status = 'failure';
          $message = 'Failed to Update configconfig.json for ' . $mission;
        }
      }

      //Rename Config Database Mission
      if( $status == 'success' ) {
        $rMDN = renameMissionDatabaseName( $mission, $tomission );
        if( !$rMDN ) {
          $status = 'failure';
          $message = 'Failed to Update database entry for ' . $mission;
        }
      }

      return json_encode( array( 'status' => $status, 'message' => $message ) );
    }
  }

  function renameMissionFolder( $m, $tm ) {
    if( !rename( 'Missions/' . $m, 'Missions/' . $tm ) ) return true;
    return true;
  }

  function renameConfigconfigJSONMissionName( $m, $tm ) {
    //Get configconfig.json
    $configconfigjsonFile = file_get_contents( 'config/configconfig.json' );
    if( $configconfigjsonFile === false ) return false;
    $configconfigjson = json_decode( $configconfigjsonFile, true );

    //Change the mission name
    for( $i = 0; $i < count( $configconfigjson['missions'] ); $i++ ) {
      if( strcasecmp( $configconfigjson['missions'][$i], $m ) == 0 ) {
        $configconfigjson['missions'][$i] = $tm;
        break;
      }
    }

    //Write it back out
    $newConfigconfigjsonFile = json_encode( $configconfigjson, JSON_PRETTY_PRINT );
    file_put_contents( 'config/configconfig.json', $newConfigconfigjsonFile );

    return true;
  }

  function renameMissionDatabaseName( $m, $tm ) {
    //Open the database
    $dir = 'sqlite:config/db/config.sqlite3';
    try {
      $conn = new PDO( $dir );
    }
    catch( PDOException $e ) {
      return false;
    }

    $m = strtolower( $m );
    $tm = strtolower( $tm );

    //Update entry
    $stmt = $conn->prepare("UPDATE Passwords SET mission=:tm WHERE mission=:m");
    $stmt->bindParam(':tm', $tm);
    $stmt->bindParam(':m', $m);
    $stmt->execute();

    $conn = null;

    return true;
  }

?>