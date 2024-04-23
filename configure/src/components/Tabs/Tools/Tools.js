import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./ToolsSlice";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import { setSnackBarText, setModal } from "../../../core/ConfigureStore";

import ToolModal from "./Modals/ToolModal/ToolModal";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"; // Header
import StorageIcon from "@mui/icons-material/Storage"; // Data
import PolylineIcon from "@mui/icons-material/Polyline"; // Vector
import TravelExploreIcon from "@mui/icons-material/TravelExplore"; // Query
import LanguageIcon from "@mui/icons-material/Language"; // Tile
import GridViewIcon from "@mui/icons-material/GridView"; // Vector tile
import ViewInArIcon from "@mui/icons-material/ViewInAr"; // Model

import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";

const useStyles = makeStyles((theme) => ({
  Tools: {
    width: "100%",
    height: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
  },
  toolsList: {
    width: "100%",
    padding: "0px 15% !important",
  },
  toolsListItem: {
    height: "32px",
  },
  toolsListItemButton: {
    height: "32px",
    borderTop: `1px solid ${theme.palette.swatches.grey[800]} !important`,
    //borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    borderRight: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    display: "flex !important",
    justifyContent: "space-between !important",
    paddingRight: "8px !important",
    "& > div": {
      display: "flex",
      justifyContent: "space-between",
    },
    "& > div:first-child": {
      "& .MuiListItemIcon-root": {
        minWidth: "36px",
        marginTop: "4px",
      },
    },
    "& > div:nth-child(2)": {
      "& .MuiListItemIcon-root": {
        minWidth: "20px",
      },
    },
  },
}));

export default function Tools() {
  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);
  const configuration = useSelector((state) => state.core.configuration);

  const handleClick = (tool) => {
    dispatch(
      setModal({
        name: "tool",
        on: true,
        toolUUID: tool.uuid,
        onClose: () => {
          console.log("closed");
        },
      })
    );
  };

  if (configuration?.tools?.length == null) {
    return <div className={c.Tools}>Not found</div>;
  }

  return (
    <>
      <div className={c.Tools}></div>

      <ToolModal />
    </>
  );
}
