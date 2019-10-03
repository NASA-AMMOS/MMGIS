<?php
if( $_POST["type"] == "1pt" ) {
  
  echo json_encode(exec("gdallocationinfo -valonly -wgs84 " . $_POST["path"] . " " . $_POST["lon"] . " " . $_POST["lat"] . " 2>&1" ));
}
if( $_POST["type"] == "2pts" ) {
  echo json_encode(exec("python 2ptsToProfile.py " . $_POST["path"] . " " . $_POST["lat1"] . " " . $_POST["lon1"] . " " . $_POST["lat2"] . " " . $_POST["lon2"] . " " . $_POST["steps"] . " " . $_POST["axes"] . " " . "1". " 2>&1" ));
}
elseif( $_POST["type"] == "band" ) {
  echo json_encode(exec("python BandsToProfile.py " . $_POST["path"] . " " . $_POST["x"] . " " . $_POST["y"] . " " . $_POST["xyorll"] . " " . $_POST["bands"] . " 2>&1" ));
}
?>