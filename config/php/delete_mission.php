<?php
  echo deleteMission( $_POST['mission'] );

  function deleteMission( $mission ) {
    $status = 'success';
    $message = 'Successfully Deleted Mission: ' . $mission;
    
    $currentMissionFolders = scandir( '../../Missions' );
    $currentMissionFolders = array_map( 'strtolower', $currentMissionFolders );

    //Check that _deleted_mission name is not used
    //Find first free $mission_deleted_i
    $mission_deleted_i = "";
    for( $i = 0; $i <= 100; $i++ ) {
      if( !in_array( strtolower( $mission . '_deleted_' . $mission_deleted_i ), $currentMissionFolders ) ) {
        break;
      }
      $mission_deleted_i = $i;
    }

    if( !in_array( strtolower( $mission . '_deleted_' . $mission_deleted_i ), $currentMissionFolders ) ) {
      //Rename Mission Folder to ^
      if( $status == 'success' ) {
        $rMF = renameMissionFolder( $mission, $mission . '_deleted_' . $mission_deleted_i );
        if( !$rMF ) {
          $status = 'failure';
          $message = 'Failed to Rename Mission Folder for ' . $mission . ' to ' . $mission . '_deleted_' . $mission_deleted_i;
        }
      }

      //Rename Configconfig Mission
      if( $status == 'success' ) {
        $rCMN = removeConfigconfigJSONMissionName( $mission );
        if( !$rCMN ) {
          $status = 'failure';
          $message = 'Failed to Remove Mission configconfig.json for ' . $mission;
        }
      }

      //Rename Config Database Mission
      if( $status == 'success' ) {
        $rMDN = removeMissionDatabaseName( $mission, $tomission );
        if( !$rMDN ) {
          $status = 'failure';
          $message = 'Failed to Remove Database Entry for ' . $mission;
        }
      }
    }
    else {
      $status = 'failure';
      $message = 'Please Rename/Delete the [ Missions/_deleted_' . $mission . ' ] folder';
    }

    return json_encode( array( 'status' => $status, 'message' => $message ) );
  }

  function renameMissionFolder( $m, $tm ) {
    if( !rename( '../../Missions/' . $m, '../../Missions/' . $tm ) ) return true;
    return true;
  }

  function removeConfigconfigJSONMissionName( $m ) {
    //Get configconfig.json
    $configconfigjsonFile = file_get_contents( '../configconfig.json' );
    if( $configconfigjsonFile === false ) return false;
    $configconfigjson = json_decode( $configconfigjsonFile, true );

    //Change the mission name
    for( $i = 0; $i < count( $configconfigjson['missions'] ); $i++ ) {
      if( strcasecmp( $configconfigjson['missions'][$i], $m ) == 0 ) {
        array_splice( $configconfigjson['missions'], $i, 1 );
        break;
      }
    }

    //Write it back out
    $newConfigconfigjsonFile = json_encode( $configconfigjson, JSON_PRETTY_PRINT );
    file_put_contents( '../configconfig.json', $newConfigconfigjsonFile );

    return true;
  }

  function removeMissionDatabaseName( $m ) {
    //Open the database
    $dir = 'sqlite:../db/config.sqlite3';
    try {
      $conn = new PDO( $dir );
    }
    catch( PDOException $e ) {
      return false;
    }

    $m = strtolower( $m );

    //Update entry
    $stmt = $conn->prepare("DELETE FROM Passwords WHERE mission=:mission");
    $stmt->bindParam(':mission', $m);
    $stmt->execute();

    $conn = null;

    return true;
  }

?>