<?php
  session_start();

  $argc = count($argv);

  $rawfilename = $argv[1];
  $mode = $argv[2];
  $featuretodelete = $argv[3];
  $feature = $argv[4];
  $replacing = $argv[5];
  $replacer = $argv[6];
  $movingTo = $argv[7];
  $moving = $argv[8];
  $mission = ($argc == 10 && !empty($argv[9])) ? $argv[9] : false;


  if( $mission === false ) {
    $dir = 'sqlite:db/mmgismaster.sqlite3';
  }
  else {
    $dir = 'sqlite:Missions/' . $mission . '/Database/mmgis.sqlite3';
  }
  $conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

  $sql = $conn->prepare("SELECT data FROM userfiles WHERE filename=:rawfilename");
  $sql->bindParam(':rawfilename', $rawfilename);
  $sql->execute();
  $result = $sql->fetchAll();

  $data = '{}';
  foreach( $result as $row ) {
      $data = $row['data'];
    break;
  }

  if( $data != '{}' ) {

    if( $mode == "adddel" ) {
      $data = substr( $data, 0, -2 );
      if ($featuretodelete != "null") {
        $data = str_ireplace("\n," . $featuretodelete, '', $data);
      }

      if ($feature != "null") {
        $str = "\n," . $feature . ']}';
      }
      else {
        $str = ']}';
      }

      $data = $data . $str;
    }
    else if( $mode == "replace" ) {
      if( $replacing != "null" && $replacer != "null" ) {
        $data = str_ireplace("\n," . $replacing, "\n," . $replacer, $data );
      }
    }
    else if( $mode == "move" ) {
      if( $movingTo == "front" ) {
        $data = str_ireplace("\n," . $moving, '', $data);
        $data = substr( $data, 0, -2 );
        $data = $data . "\n," . $moving . ']}';
      }
      else if( $movingTo == "back" ) {
        $data = str_ireplace("\n," . $moving, '', $data);
        $data = str_ireplace( '"coordinates":[]}}', '"coordinates":[]}}' . "\n," . $moving, $data );
      }
    }

    $sql = $conn->prepare( "UPDATE userfiles SET data = :data WHERE filename = :filename" );
    $sql->bindParam(':data', $data, PDO::PARAM_STR );
    $sql->bindParam(':filename', $rawfilename, PDO::PARAM_STR );
    $sql->execute();
  }

  $conn = NULL;
?>
