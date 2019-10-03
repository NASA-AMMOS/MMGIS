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
?>