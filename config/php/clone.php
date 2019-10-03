<?php
  if( isset( $_POST['existing']      ) &&
      isset( $_POST['cloneName']     ) &&
      isset( $_POST['clonePassword'] ) ) {
      if( preg_match( '/[^a-zA-Z\d]/', $_POST['existing'] ) ) {
        echo "failure";
      }
      elseif( preg_match( '/[^a-zA-Z\d]/', $_POST['cloneName'] ) ) {
        echo "failure";
      }
      elseif( preg_match( '/[^a-zA-Z\d]/', $_POST['clonePassword'] ) ) {
        echo "failure";
      }
      else {
        $output = shell_exec( "python ../python/cloneMission.py -paths " . escapeshellarg($_POST['existing']) . " " . escapeshellarg($_POST['cloneName']) . " " . escapeshellarg($_POST['clonePassword']) . " 2>&1" );
        if( stripos( $output, 'Successfully cloned mission' ) !== FALSE ) {
          echo "success";
        }
        else {
          echo "failure";
        }
      }
  }
  else {
    echo "failure";
  }
?>