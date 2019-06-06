<?php
session_start();

if( $_POST['master'] == 'true' ) {
  $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = "SELECT data FROM userfiles WHERE filename='" . $_POST['filename'] . "'";
$result = $conn->query( $sql )->fetchAll();

$toReturn = '{}';
foreach( $result as $row ) {
   $toReturn = $row['data'];
  break;
}
echo json_encode( $toReturn );

$conn = NULL;
?>