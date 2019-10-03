<?php
  $existing = urldecode($argv[1]);
  $cloneName = urldecode($argv[2]);
  $clonePassword = urldecode($argv[3]);
  
  if( isset( $existing      ) &&
      isset( $cloneName     ) &&
      isset( $clonePassword ) ) {
      if( preg_match( '/[^a-zA-Z\d]/', $existing ) ) {
        echo "failure";
      }
      elseif( preg_match( '/[^a-zA-Z\d]/', $cloneName ) ) {
        echo "failure";
      }
      elseif( preg_match( '/[^a-zA-Z\d]/', $clonePassword ) ) {
        echo "failure";
      }
      else {
        $existingArg = escapeshellarg($existing);
        $cloneNameArg = escapeshellarg($cloneName);
        $clonePassword = escapeshellarg($clonePassword);
        $cmd = "python private/api/cloneMission.py -paths $existingArg $cloneNameArg $clonePassword 2>&1";
        $output = shell_exec($cmd);

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