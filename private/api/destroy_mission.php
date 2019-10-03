<?php
  echo deleteMission( urldecode($argv[1]) );

  function deleteMission( $mission ) {
    $status = 'success';
    $message = 'Successfully Deleted Mission: ' . $mission;
    
    $currentMissionFolders = scandir( 'Missions' );
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
    }
    else {
      $status = 'failure';
      $message = 'Please Rename/Delete the [ Missions/_deleted_' . $mission . ' ] folder';
    }

    return json_encode( array( 'status' => $status, 'message' => $message ) );
  }

  function renameMissionFolder( $m, $tm ) {
    if( !rename( 'Missions/' . $m, 'Missions/' . $tm ) ) return true;
    return true;
  }

?>