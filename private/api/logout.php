<?php
  session_start();
  echo( $_SESSION['Username'] . ' Logged Out' );
  if( isset($_SESSION) ) {
    session_unset();
  }
?>