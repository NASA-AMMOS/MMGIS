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

// Check if username is unique
$sql = "SELECT * FROM users WHERE username='" . $user . "'";
$result = $conn->query( $sql );
if( $result->num_rows > 0 ) {
	die( "Username already exists" );
}

$email = $_POST['email'];
$pass = $_POST['password'];
$pass = md5( $pass );
$datetime = date("Y-m-d H:i:s");
$sql = "INSERT INTO Users (username, email, signup_date, password)
VALUES ('" . $user . "', '" . $email . "', '" . $datetime . "', '" . $pass . "')";
$result = $conn->query($sql);

$_SESSION['LoggedIn'] = true;
$_SESSION['Username'] = $user;
echo( 'Successfully Signed Up' );

//ALTER TABLE users AUTO_INCREMENT = 1

$conn->close();
?>