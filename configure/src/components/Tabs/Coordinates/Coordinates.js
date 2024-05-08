import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import Maker from "../../../core/Maker";
import { setSnackBarText } from "../../../core/ConfigureStore";

import config from "../../../metaconfigs/tab-coordinates-config.json";

const useStyles = makeStyles((theme) => ({
  Coordinates: {
    width: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
  },
}));

export default function Coordinates() {
  const c = useStyles();

  const dispatch = useDispatch();

  return (
    <div className={c.Coordinates}>
      <Maker config={config} shadowed={true} inlineHelp={true} />
    </div>
  );
}
