<?php
  echo json_encode(exec("python BandsToProfileREG.py " . $_POST["path"] . " " . $_POST["x"] . " " . $_POST["y"] . " " . $_POST["xyorll"] . " " . $_POST["bands"] . " 2>&1" ));
?>