<?php
  $path = escapeshellarg(urldecode($argv[1]));
  $lat = escapeshellarg(urldecode($argv[2]));
  $lon = escapeshellarg(urldecode($argv[3]));
  echo json_encode(exec("gdallocationinfo -valonly -wgs84 " . $path . " " . $lon . " " . $lat . " 2>&1" ));
?>