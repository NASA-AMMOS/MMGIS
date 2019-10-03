<?php
session_start();

if( $_POST['master'] == 'true' ) {
    $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
    $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = $conn->prepare("DELETE FROM userfiles WHERE filename = :filename");
$sql->bindParam(':filename', $_POST['filename'], PDO::PARAM_STR );

$sql->execute();

$conn = NULL;

echo json_encode( array( 'status'=>'success' ) );
?>