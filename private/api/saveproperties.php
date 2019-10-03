<?php
session_start();

$argc = count($argv);

$filename = $argv[1];
$name = $argv[2];
$description = $argv[3];
$public = $argv[4];
$mission = ($argc == 6 && !empty($argv[5])) ? $argv[5] : false;

if( $mission === false ) {
  $dir = 'sqlite:db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:Missions/' . $mission . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = $conn->prepare("UPDATE userfiles SET name = :name, description = :description, public = :public WHERE filename = :filename");
$sql->bindParam(':name', $name, PDO::PARAM_STR );
$sql->bindParam(':description', $description, PDO::PARAM_STR );
$sql->bindParam(':public', $public, PDO::PARAM_INT );
$sql->bindParam(':filename', $filename, PDO::PARAM_STR );

$sql->execute();

echo 'Successfully saved properties of ' . $name;

$conn = NULL;
?>