<?php
session_start();

if( $_POST['master'] == 'true' ) {
	$dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
	$dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = "SELECT DISTINCT username FROM userfiles";
$result = $conn->query( $sql )->fetchAll();

$toReturn = array();

//$size = count($result);
foreach( $result as $row ) {
	$sql = "SELECT * FROM userfiles WHERE username='" . $row['username'] . "' AND public='1'";
	$result1 = $conn->query( $sql )->fetchAll();
	$userFiles = array();

	foreach( $result1 as $row1 ) {
		$userFiles = array_merge( $userFiles, array( $row1['filename'] => $row1['name'] ) );
	}
	//get current users private files too
	if( $_POST['username'] == $row['username'] ) {
		$sql = "SELECT * FROM userfiles WHERE username='" . $_POST['username'] . "' AND public='0'";
		$result2 = $conn->query( $sql )->fetchAll();
		foreach( $result2 as $row2 ) {
			$userFiles = array_merge( $userFiles, array( $row2['filename'] => $row2['name'] ) );
		}
	}
	if( count( $userFiles ) > 0 ) {
		$toReturn = array_merge( $toReturn, array( $row['username'] => $userFiles ) );
	}
}

echo json_encode( $toReturn );

$conn = NULL;
?>