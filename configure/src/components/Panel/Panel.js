import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { decrement, increment } from "./PanelSlice";
import { makeStyles } from "@mui/styles";
import mmgisLogo from "../../images/mmgis.png";

import Button from "@mui/material/Button";

const useStyles = makeStyles((theme) => ({
  Panel: {
    width: "220px",
    height: "100%",
    background: theme.palette.secondary.main,
  },
  title: {
    padding: "30px 0px",
    textAlign: "center",
  },
  titleImage: {
    height: "30px",
  },
  configurationName: {
    color: theme.palette.swatches.grey[700],
    fontSize: "13px",
    marginTop: "-5px",
    textTransform: "uppercase",
  },
  newMission: {
    width: "100%",
  },
  newMissionButton: {
    width: "100%",
    background: `${theme.palette.swatches.p[0]} !important`,
    "&:hover": {
      background: `${theme.palette.swatches.p[5]} !important`,
    },
  },
}));

export default function Panel() {
  const c = useStyles();

  const count = useSelector((state) => state.panel.value);
  const dispatch = useDispatch();

  return (
    <div className={c.Panel}>
      <div className={c.title}>
        <img className={c.titleImage} src={mmgisLogo}></img>
        <div className={c.configurationName}>Configuration</div>
      </div>
      <div className={c.newMission}>
        <Button
          className={c.newMissionButton}
          variant="contained"
          disableElevation
        >
          New Mission
        </Button>
      </div>
      <div className={c.missions}></div>
      <div className={c.pages}></div>
      <div>
        <button
          aria-label="Increment value"
          onClick={() => dispatch(increment())}
        >
          Increment
        </button>
        <span>{count}</span>
        <button
          aria-label="Decrement value"
          onClick={() => dispatch(decrement())}
        >
          Decrement
        </button>
      </div>
    </div>
  );
}
