import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./LayersSlice";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import { setSnackBarText, setModal } from "../../../core/ConfigureStore";

import LayerModal from "./Modals/LayerModal/LayerModal";

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
  Layers: {
    width: "100%",
    height: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
  },
  layersList: {
    width: "100%",
    padding: "0px 15% !important",
  },
  layersListItem: {
    height: "32px",
  },
  layersListItemButton: {
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

export default function Layers() {
  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);
  const configuration = useSelector((state) => state.core.configuration);

  const handleClick = (layer) => {
    dispatch(
      setModal({
        name: "layer",
        on: true,
        layerUUID: layer.uuid,
        onClose: () => {
          console.log("closed");
        },
      })
    );
  };

  if (configuration?.layers?.length == null) {
    return <div className={c.Layers}>Not found</div>;
  }

  const flatLayers = [];
  traverseLayers(configuration.layers, (layer, path, i, depth) => {
    flatLayers.push({ layer, depth });
  });

  return (
    <>
      <div className={c.Layers}>
        <List className={c.layersList}>
          {flatLayers.map((l, idx) => {
            const indentationPerDepth = 30;
            let color = "#FFFFFF";
            let iconType = null;
            switch (l.layer.type) {
              case "header":
                iconType = <KeyboardArrowDownIcon fontSize="small" />;
                color = "#2c2f30";
                break;
              case "data":
                iconType = <StorageIcon fontSize="small" />;
                color = "#c43541";
                break;
              case "vector":
                iconType = <PolylineIcon fontSize="small" />;
                color = "#0792c5";
                break;
              case "query":
                iconType = <TravelExploreIcon fontSize="small" />;
                color = "#87b051";
                break;
              case "tile":
                iconType = <LanguageIcon fontSize="small" />;
                color = "#75351e";
                break;
              case "vectortile":
                iconType = <GridViewIcon fontSize="small" />;
                color = "#78b1c2";
                break;
              case "model":
                iconType = <ViewInArIcon fontSize="small" />;
                color = "#dbb658";
                break;
              default:
            }

            return (
              <ListItem
                className={c.layersListItem}
                key={idx}
                disablePadding
                style={{
                  paddingLeft: l.depth * indentationPerDepth + "px",
                }}
              >
                <ListItemButton
                  className={c.layersListItemButton}
                  role={undefined}
                  onClick={(e) => {
                    handleClick(l.layer);
                  }}
                  dense
                  style={{
                    borderLeft: `6px solid ${color}`,
                  }}
                >
                  <div>
                    <ListItemIcon
                      style={{
                        color: color,
                      }}
                    >
                      {iconType}
                    </ListItemIcon>
                    <ListItemText primary={l.layer.name} />
                  </div>
                  <div>
                    {l.layer.time?.enabled === true ? (
                      <ListItemIcon>
                        <AccessTimeFilledIcon fontSize="small" />
                      </ListItemIcon>
                    ) : null}
                    {l.layer.visibility === true ? (
                      <ListItemIcon>
                        <VisibilityIcon fontSize="small" />
                      </ListItemIcon>
                    ) : null}
                  </div>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </div>

      <LayerModal />
    </>
  );
}

function traverseLayers(layers, onLayer) {
  depthTraversal(layers, 0, []);
  function depthTraversal(node, depth, path) {
    for (let i = 0; i < node.length; i++) {
      onLayer(node[i], path, i, depth);
      //Add other feature information while we're at it
      if (
        node[i] &&
        node[i].sublayers != null &&
        node[i].sublayers.length > 0
      ) {
        depthTraversal(
          node[i].sublayers,
          depth + 1,
          `${path.length > 0 ? path + "." : ""}${node[i].name}`
        );
      }
    }
  }
}
