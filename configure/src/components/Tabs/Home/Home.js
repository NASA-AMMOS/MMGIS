import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setVersions } from "./HomeSlice";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import Maker from "../../../core/Maker";
import { setSnackBarText } from "../../../core/ConfigureStore";

import config from "../../../metaconfigs/tab-home-config.json";

const useStyles = makeStyles((theme) => ({
  Home: {
    width: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
    padding: "0px 32px 64px 32px",
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
}));

export default function Home() {
  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);
  const versions = useSelector((state) => state.home.versions);

  useEffect(() => {
    if (mission != null)
      calls.api(
        "versions",
        { mission: mission },
        (res) => {
          dispatch(setVersions(res?.versions || []));
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get history for mission.",
              severity: "error",
            })
          );
        }
      );
  }, [dispatch, mission]);

  return (
    <div className={c.Home}>
      <ul style={{ display: "none" }}>
        {versions.map((v) => {
          return (
            <li>
              {v.version} - {v.createdAt}
            </li>
          );
        })}
      </ul>
      <Maker config={config} />
    </div>
  );
}
