import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./MainSlice";
import { makeStyles } from "@mui/styles";

import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import HomeIcon from "@mui/icons-material/Home";
import LayersIcon from "@mui/icons-material/Layers";
import HandymanIcon from "@mui/icons-material/Handyman";
import ExploreIcon from "@mui/icons-material/Explore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ViewQuiltIcon from "@mui/icons-material/ViewQuilt";

import { calls } from "../../core/calls";
import { setConfiguration, setSnackBarText } from "../../core/ConfigureStore";

const useStyles = makeStyles((theme) => ({
  Main: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey[1000],
    boxShadow: `inset 10px 0px 10px -5px rgba(0,0,0,0.3)`,
  },
  tabs: {
    width: "100%",
    height: "48px",
    minHeight: "48px",
    display: "flex",
    justifyContent: "center",
    background: theme.palette.swatches.grey[900],
    boxShadow: `inset 10px 0px 10px -5px rgba(0,0,0,0.3)`,
    borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    "& > div": {
      borderRight: "none",
      height: "48px",
      minHeight: "48px",
    },
    "& .MuiTab-root": {
      color: theme.palette.swatches.grey[500],
      height: "48px",
      minHeight: "48px",
      padding: "0px 24px",
      fontSize: "13px",
      textTransform: "none",
      borderBottom: `none !important`,
    },
    "& .MuiTab-root.Mui-selected": {
      background: theme.palette.swatches.p[0],
      color: theme.palette.swatches.grey[100],
      fontWeight: "bold",
    },

    "& .MuiTabs-indicator": {
      background: theme.palette.swatches.grey[100],
    },
  },
}));

export default function Main() {
  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);

  useEffect(() => {
    if (mission != null)
      calls.api(
        "get",
        { mission: mission },
        (res) => {
          dispatch(setConfiguration(res));
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get configuration for mission.",
              severity: "error",
            })
          );
        }
      );
  }, [dispatch, mission]);

  const [tabValue, setTabValue] = useState(0);

  let TabPage = null;
  switch (tabValue) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      TabPage = (
        <div>
          {mission} {tabValue}
        </div>
      );
      break;
    default:
  }

  return (
    <div className={c.Main}>
      <div className={c.tabs}>
        <Tabs
          variant="scrollable"
          value={tabValue}
          onChange={(e, val) => {
            setTabValue(val);
          }}
          sx={{ borderRight: 1, borderColor: "divider" }}
        >
          <Tab icon={<HomeIcon />} iconPosition="start" label="Home" />
          <Tab icon={<LayersIcon />} iconPosition="start" label="Layers" />
          <Tab icon={<HandymanIcon />} iconPosition="start" label="Tools" />
          <Tab
            icon={<ExploreIcon />}
            iconPosition="start"
            label="Coordinates"
          />
          <Tab icon={<AccessTimeIcon />} iconPosition="start" label="Time" />
          <Tab
            icon={<ViewQuiltIcon />}
            iconPosition="start"
            label="User Interface"
          />
        </Tabs>
      </div>
      <div className={c.tabPage}>{TabPage}</div>
    </div>
  );
}
