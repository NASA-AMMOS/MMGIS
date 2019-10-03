<?php
  session_start();

  if( $_POST['isDBFile'] == 'true' ) {
    if( $_POST['master'] == 'true' ) {
      $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
    }
    else {
      $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
    }
    $conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

    $sql = "SELECT data FROM userfiles WHERE filename='" . $_POST['rawfilename'] . "'";
    $result = $conn->query( $sql )->fetchAll();

    $data = '{}';
    foreach( $result as $row ) {
       $data = $row['data'];
      break;
    }

    if( $data != '{}' ) {

      if( $_POST["mode"] == "adddel" ) {
        $data = substr( $data, 0, -2 );
        if ($_POST["featuretodelete"] != "null") {
          $data = str_ireplace("\n," . $_POST["featuretodelete"], '', $data);
        }

        if ($_POST["feature"] != "null") {
          $str = "\n," . $_POST["feature"] . ']}';
        }
        else {
          $str = ']}';
        }

        $data = $data . $str;
      }
      else if( $_POST["mode"] == "replace" ) {
        if( $_POST["replacing"] != "null" && $_POST["replacer"] != "null" ) {
          $data = str_ireplace("\n," . $_POST["replacing"], "\n," . $_POST["replacer"], $data );
        }
      }
      else if( $_POST["mode"] == "move" ) {
        if( $_POST["movingTo"] == "front" ) {
          $data = str_ireplace("\n," . $_POST["moving"], '', $data);
          $data = substr( $data, 0, -2 );
          $data = $data . "\n," . $_POST["moving"] . ']}';
        }
        else if( $_POST["movingTo"] == "back" ) {
          $data = str_ireplace("\n," . $_POST["moving"], '', $data);
          $data = str_ireplace( '"coordinates":[]}}', '"coordinates":[]}}' . "\n," . $_POST["moving"], $data );
        }
      }

      $sql = $conn->prepare( "UPDATE userfiles SET data = :data WHERE filename = :filename" );
      $sql->bindParam(':data', $data, PDO::PARAM_STR );
      $sql->bindParam(':filename', $_POST['rawfilename'], PDO::PARAM_STR );
      $sql->execute();
    }

    $conn = NULL;
  }
  else {
    $filename = $_POST["filename"];
    $file = fopen($filename, "r+") or die("Unable to open file.");

    if( $_POST["mode"] == "adddel" ) {
      $stat = fstat($file);
      ftruncate($file, $stat['size']-2);
      fclose($file);

      if ($_POST["featuretodelete"] != "null") {
        $contents = file_get_contents($filename);
        $contents = str_ireplace("\n," . $_POST["featuretodelete"], '', $contents);

        file_put_contents($filename, $contents);
      }

      if ($_POST["feature"] != "null") {
        echo $_POST["feature"];
        $str = "\n," . $_POST["feature"] . ']}';
      }
      else {
        $str = ']}';
      }
      $file = fopen("$filename", "a") or die("Unable to open file.");
      fwrite($file, $str);
    }
    else if( $_POST["mode"] == "replace" ) {
      if( $_POST["replacing"] != "null" && $_POST["replacer"] != "null" ) {
        $contents = file_get_contents($filename);
        $contents = str_ireplace("\n," . $_POST["replacing"], "\n," . $_POST["replacer"], $contents );

        file_put_contents($filename, $contents);
      }
    }
    else if( $_POST["mode"] == "move" ) {
      if( $_POST["moving"] != "null" && $_POST["movingTo"] != "null" ) {
        if( $_POST["movingTo"] == "front" ) {
          $stat = fstat($file);
          ftruncate($file, $stat['size']-2);
          fclose($file);

          $contents = file_get_contents($filename);
          $contents = str_ireplace("\n," . $_POST["moving"], "", $contents );
          file_put_contents($filename, $contents);

          $str = "\n," . $_POST["moving"] . ']}';
          $file = fopen("$filename", "a") or die("Unable to open file.");
          fwrite($file, $str);
        }
        else if( $_POST["movingTo"] == "back" ) {
          $contents = file_get_contents($filename);
          $contents = str_ireplace("\n," . $_POST["moving"], "", $contents );
          file_put_contents($filename, $contents);

          $contents = file_get_contents($filename);
          $contents = str_ireplace( '"coordinates":[]}}', '"coordinates":[]}}' . "\n," . $_POST["moving"], $contents );
          file_put_contents($filename, $contents);          
        }
      }
    }
  }
?>
