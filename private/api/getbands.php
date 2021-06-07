<?php
  $path = escapeshellarg(urldecode($argv[1]));
  $x = escapeshellarg(urldecode($argv[2]));
  $y = escapeshellarg(urldecode($argv[3]));
  $xyorll = escapeshellarg(urldecode($argv[4]));
  $bands = escapeshellarg(urldecode($argv[5]));
  echo json_encode(exec("python private/api/BandsToProfile.py " . $path . " " . $x . " " . $y . " " . $xyorll . " " . $bands . " 2>&1" ));
?>