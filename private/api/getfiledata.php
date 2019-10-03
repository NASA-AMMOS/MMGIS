<?php
session_start();

$argc = count($argv);

$filename = $argv[1];
$mission = ($argc == 3 && !empty($argv[2])) ? $argv[2] : false;

if( $mission === false ) {
  $dir = 'sqlite:db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:Missions/' . $mission . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = $conn->prepare("SELECT data FROM userfiles WHERE filename=:filename");
$sql->bindParam(':filename', $filename);
$sql->execute();
$result = $sql->fetchAll();

$toReturn = '{}';
foreach( $result as $row ) {
   $toReturn = $row['data'];
  break;
}
echo json_encode( $toReturn );

$conn = NULL;
?>