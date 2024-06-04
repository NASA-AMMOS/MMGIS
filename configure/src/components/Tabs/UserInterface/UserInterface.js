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
    display: "flex",
    background: theme.palette.swatches.grey[1000],
    padding: "0px 32px 64px 32px",
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
}));

export default function UserInterface() {
  const c = useStyles();

  const dispatch = useDispatch();

  return (
    <div className={c.UserInterface}>
      <Maker config={config} inlineHelp={true} />
    </div>
  );
}
