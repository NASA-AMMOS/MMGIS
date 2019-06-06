<?php
session_start();

$servername = "localhost";
$username = "root";
$password = "root";
$dbname = "login_practice";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
$user = $_POST['username'];
$pass = $_POST['password'];
$pass = md5( $pass );
// Check if username is unique
$sql = "SELECT * FROM users WHERE username='" . $user . " ' AND password='" . $pass . "'";
$result = $conn->query( $sql );
if( $result->num_rows > 0 ) {
  $_SESSION['LoggedIn'] = true;
  $_SESSION['Username'] = $user;
  //setcookie( 'Username', $user, time() + (86400 * 30), '/' );
  //setcookie( 'Password', $pass, time() + (86400 * 30), '/' );
	echo( "Successfully logged in as " . $user );
}
else {
	echo( "Invalid username or password" );
}

// pass') ALTER TABLE users AUTO_INCREMENT = 1; --

$conn->close();
?>