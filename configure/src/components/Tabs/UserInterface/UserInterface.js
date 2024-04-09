import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import Maker from "../../../core/Maker";
import { setSnackBarText } from "../../../core/ConfigureStore";

import config from "../../../metaconfigs/tab-ui-config.json";

const useStyles = makeStyles((theme) => ({
  UserInterface: {
    width: "100%",
    height: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
  },
}));

export default function UserInterface() {
  const c = useStyles();

  const dispatch = useDispatch();

  return (
    <div className={c.UserInterface}>
      <Maker config={config} />
    </div>
  );
}
