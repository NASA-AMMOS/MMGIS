<?php
session_start();

if( $_POST['master'] == 'true' ) {
  $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$user = $_POST['username'];
$pass = $_POST['password'];
$pass = md5( $pass );

$sql = "SELECT * FROM users WHERE username='" . $user . "' AND password='" . $pass . "'";
$result = $conn->query( $sql );
$size = count($result->fetchAll());

if( $size > 0 ) {
  $_SESSION['LoggedIn'] = true;
  $_SESSION['Username'] = $user;
	echo( "Successfully logged in as " . $user );
}
else {
	echo( "Invalid username or password" );
}

$conn = NULL;
?>