<?php
  $filename = $argv[1];
  $json = $argv[2];
  $file = fopen($filename, "w") or die("failure");
  fwrite($file, $json);
  fclose($file);
  echo "success";
?>
