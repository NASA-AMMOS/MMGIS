<?php
session_start();

if( $_POST['master'] == 'true' ) {
    $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
    $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = "SELECT * FROM userfiles WHERE username='" . $_POST['username'] . "'";
$result = count( $conn->query( $sql )->fetchAll() );

if( isset( $_POST['filedata'] ) && $_POST['filedata'] != '' ) {
    $baseDrawGeojson = $_POST['filedata'];
}
else {
    $baseDrawGeojson = '{"type": "FeatureCollection","crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },"features": [{"type":"Feature","properties":{"boundingbox":[0,0,0,0],"fill":"#000"},"geometry":{"type":"Polygon","coordinates":[]}}]}';
}

$sql = $conn->prepare( "INSERT INTO 'userfiles'('filename','fileid','username','name','description','type','data') VALUES ('" . $result . '_' . $_POST['username'] . "','" . $result . "','" . $_POST['username'] . "','" . $_POST['name'] . "','','geojson',:data)" );
$sql->bindParam(':data', $baseDrawGeojson, PDO::PARAM_STR );
$sql->execute();

$conn = NULL;

echo json_encode( array( 'status'=>'success', 'filename'=> $result . '_' . $_POST['username'] ) );
?>