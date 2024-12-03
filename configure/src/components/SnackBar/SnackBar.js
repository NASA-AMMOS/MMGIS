import React from "react";
import { useSelector, useDispatch } from "react-redux";

import { setSnackBarText } from "../../core/ConfigureStore";

import { makeStyles } from "@mui/styles";

import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

const useStyles = makeStyles((theme) => ({
  main: { top: "74px !important" },
  snackbar: {
    fontSize: 14,
    fontWeight: "bold",
  },
}));

// Just a small bit of anti-pattern so that, when the snackbar fades, it
// doesn't snap to a no text state
let afterImage = "";

const SnackBar = (props) => {
  const c = useStyles();
  const dispatch = useDispatch();

  const snackBarText = useSelector((state) => state.core.snackBarText);

  const openSnackbar = snackBarText !== false;

  const handleCloseSnackbar = (e, reason) => {
    if (reason === "clickaway") return;
    dispatch(setSnackBarText(false));
  };

  afterImage = snackBarText.text || afterImage;

  return (
    <Snackbar
      className={c.main}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={openSnackbar}
      autoHideDuration={5000}
      onClose={handleCloseSnackbar}
    >
      <MuiAlert
        className={c.snackbar}
        elevation={6}
        variant="filled"
        onClose={handleCloseSnackbar}
        severity={snackBarText.severity || "success"}
      >
        {snackBarText.text || afterImage}
      </MuiAlert>
    </Snackbar>
  );
};

SnackBar.propTypes = {};

export default SnackBar;
