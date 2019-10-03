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

// Check if username is unique
$sql = "SELECT * FROM users WHERE username='" . $user . "'";
$result = $conn->query( $sql );
$size = count($result->fetchAll());
if( $size > 0 ) {
	die( "Username already exists" );
}

$email = $_POST['email'];
$datetime = date("Y-m-d H:i:s");
$permissions = 'a';
$pass = $_POST['password'];
$pass = md5( $pass );
$sql = "INSERT INTO users (username, email, signupdate, permissions, password)
VALUES ('" . $user . "', '" . $email . "', '" . $datetime . "', '" . $permissions . "', '" . $pass . "')";
$conn->exec($sql);

$_SESSION['LoggedIn'] = true;
$_SESSION['Username'] = $user;
echo( 'Successfully Signed Up' );

?>