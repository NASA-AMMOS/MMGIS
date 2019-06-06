<?php
  $dir = 'sqlite:../db/config.sqlite3';
  $conn = new PDO( $dir ) or die( 'Cannot Open Config Database.' );

  $mission = $_POST['m'];
  $pass = $_POST['p'];
  $pass = md5( $pass );

  $stmt = $conn->prepare("SELECT * FROM Passwords WHERE mission=:mission AND password=:password");
  $stmt->bindParam(':mission', $mission);
  $stmt->bindParam(':password', $pass);
  $stmt->execute();
  $result = $stmt->fetchAll();
  $size = count($result);

  if( $size > 0 ) {
    echo "success";
  }
  else {
    echo "failure";
  }

  $conn = NULL;
?>