<?php
session_start();

if( $_POST['master'] == 'true' ) {
  $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = "SELECT filename,fileid,username,name,description,public,requestingmerge,type FROM userfiles WHERE filename='" . $_POST['filename'] . "'";
$result = $conn->query( $sql )->fetchAll();

$toReturn = array();
foreach( $result as $row ) {
  array_push( $toReturn, array( 'filename' => $row['filename'], 'fileid' => $row['fileid'], 'username' => $row['username'], 'name' => $row['name'], 'description' => $row['description'], 'public' => $row['public'], 'requestingmerge' => $row['requestingmerge'], 'type' => $row['type'] ) );
  break;
}
echo json_encode( $toReturn );

$conn = NULL;
?>