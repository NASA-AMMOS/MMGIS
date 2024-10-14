import React from "react";
import { makeStyles } from "@mui/styles";

import Maker from "../../../core/Maker";

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

  return (
    <div className={c.UserInterface}>
      <Maker config={config} inlineHelp={true} />
    </div>
  );
}
