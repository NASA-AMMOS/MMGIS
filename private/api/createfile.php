<?php
session_start();

$argc = count($argv);

$username = sqlite_escape_string($argv[1]);
$name = sqlite_escape_string($argv[2]);
$filedata = $argv[3];
$mission = ($argc == 5 && !empty($argv[4])) ? $argv[4] : false;

if( $mission === false ) {
  $dir = 'sqlite:db/mmgismaster.sqlite3';
}
else {
  $dir = 'sqlite:Missions/' . $mission . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = $conn->prepare("SELECT * FROM userfiles WHERE username=:username");
$sql->bindParam(':username', $username);
$sql->execute();
$result = count($sql->fetchAll());

if( isset( $filedata ) && $filedata != '' ) {
    $baseDrawGeojson = $filedata;
}
else {
    $baseDrawGeojson = '{"type": "FeatureCollection","crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },"features": [{"type":"Feature","properties":{"boundingbox":[0,0,0,0],"fill":"#000"},"geometry":{"type":"Polygon","coordinates":[]}}]}';
}

$sql = $conn->prepare( "INSERT INTO 'userfiles'('filename','fileid','username','name','description','type','data') VALUES ('" . $result . '_' . $username . "','" . $result . "','" . $username . "','" . $name . "','','geojson',:data)" );
$sql->bindParam(':data', $baseDrawGeojson, PDO::PARAM_STR );
$sql->execute();

$conn = NULL;

echo json_encode( array( 'status'=>'success', 'filename'=> $result . '_' . $username ) );
?>