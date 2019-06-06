<?php
  $filename = $_POST["filename"];
  $json = $_POST["json"];
  $file = fopen($filename, "w") or die("Unable to open file.");
  echo fwrite($file, $json);
  fclose($file);
?>
