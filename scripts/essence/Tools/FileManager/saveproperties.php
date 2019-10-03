<?php
session_start();

if( $_POST['master'] == 'true' ) {
    $dir = 'sqlite:../../../../db/mmgismaster.sqlite3';
}
else {
    $dir = 'sqlite:../../../../Missions/' . $_POST['mission'] . '/Database/mmgis.sqlite3';
}
$conn = new PDO( $dir ) or die( 'Cannot open SQLite database' );

$sql = $conn->prepare("UPDATE userfiles SET name = :name, description = :description, public = :public WHERE filename = :filename");
$sql->bindParam(':name', $_POST['name'], PDO::PARAM_STR );
$sql->bindParam(':description', $_POST['description'], PDO::PARAM_STR );
$sql->bindParam(':public', $_POST['public'], PDO::PARAM_INT );
$sql->bindParam(':filename', $_POST['filename'], PDO::PARAM_STR );

$sql->execute();

echo 'Successfully saved properties of ' . $_POST['name'];

$conn = NULL;
?>