<?php
  $old = umask(0);
  echo makeMission( urldecode($argv[1]) );
  umask( $old );
	
  function makeMission( $missionname ) {
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
    //Layers
    if( !mkdir( $to . '/' . $named . '/Layers', 0777 ) ) return false;

    return true;
  }
?>