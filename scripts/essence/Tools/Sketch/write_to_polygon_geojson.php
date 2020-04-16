<?php
  session_start();

  $rawfilename = $argv[1];
  $mode = $argv[2];
  $featuretodelete = $argv[3];
  $feature = $argv[4];
  $replacing = $argv[5];
  $replacer = $argv[6];
  $movingTo = $argv[7];
  $moving = $argv[8];
  $mission = ($argc == 10 && !empty($argv[9])) ? $argv[9] : false;

  if( $_POST['isDBFile'] == 'true' ) {

  }
  else {
    $filename = $rawfilename;
    $file = fopen($filename, "r+") or die("Unable to open file.");

    if( $mode == "adddel" ) {
      $stat = fstat($file);
      ftruncate($file, $stat['size']-2);
      fclose($file);

      if ($featuretodelete != "null") {
        $contents = file_get_contents($filename);
        $contents = str_ireplace("\n," . $featuretodelete, '', $contents);

        file_put_contents($filename, $contents);
      }

      if ($feature != "null") {
        echo $feature;
        $str = "\n," . $feature . ']}';
      }
      else {
        $str = ']}';
      }
      $file = fopen("$filename", "a") or die("Unable to open file.");
      fwrite($file, $str);
    }
    else if( $mode == "replace" ) {
      if( $replacing != "null" && $replacer != "null" ) {
        $contents = file_get_contents($filename);
        $contents = str_ireplace("\n," . $replacing, "\n," . $replacer, $contents );

        file_put_contents($filename, $contents);
      }
    }
    else if( $mode == "move" ) {
      if( $moving != "null" && $movingTo != "null" ) {
        if( $movingTo == "front" ) {
          $stat = fstat($file);
          ftruncate($file, $stat['size']-2);
          fclose($file);

          $contents = file_get_contents($filename);
          $contents = str_ireplace("\n," . $moving, "", $contents );
          file_put_contents($filename, $contents);

          $str = "\n," . $moving . ']}';
          $file = fopen("$filename", "a") or die("Unable to open file.");
          fwrite($file, $str);
        }
        else if( $movingTo == "back" ) {
          $contents = file_get_contents($filename);
          $contents = str_ireplace("\n," . $moving, "", $contents );
          file_put_contents($filename, $contents);

          $contents = file_get_contents($filename);
          $contents = str_ireplace( '"coordinates":[]}}', '"coordinates":[]}}' . "\n," . $moving, $contents );
          file_put_contents($filename, $contents);          
        }
      }
    }
  }
?>
