<?php
  $path = escapeshellarg(urldecode($argv[1]));
  $lat1 = escapeshellarg(urldecode($argv[2]));
  $lon1 = escapeshellarg(urldecode($argv[3]));
  $lat2 = escapeshellarg(urldecode($argv[4]));
  $lon2 = escapeshellarg(urldecode($argv[5]));
  $steps = escapeshellarg(urldecode($argv[6]));
  $axes = escapeshellarg(urldecode($argv[7]));

  echo json_encode(exec("python3 private/api/2ptsToProfile.py $path $lat1 $lon1 $lat2 $lon2 $steps $axes 1 2>&1" ));
?>