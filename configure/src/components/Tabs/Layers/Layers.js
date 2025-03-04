import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./LayersSlice";
import { makeStyles } from "@mui/styles";

import clsx from "clsx";

import { reorderArray, insertLayerAfterUUID } from "../../../core/utils";
import ConfigureStore from "../../../core/ConfigureStore";
import { setModal, setConfiguration } from "../../../core/ConfigureStore";

import LayerModal from "./Modals/LayerModal/LayerModal";

import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"; // Header
import StorageIcon from "@mui/icons-material/Storage"; // Data
import PolylineIcon from "@mui/icons-material/Polyline"; // Vector
import TravelExploreIcon from "@mui/icons-material/TravelExplore"; // Query
import LanguageIcon from "@mui/icons-material/Language"; // Tile
import GridViewIcon from "@mui/icons-material/GridView"; // Vector tile
import ViewInArIcon from "@mui/icons-material/ViewInAr"; // Model
import AirIcon from "@mui/icons-material/Air"; // Velocity
import ImageIcon from '@mui/icons-material/Image'; // Image
import AddIcon from "@mui/icons-material/Add";

import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

const INDENT_WIDTH = 40;

const useStyles = makeStyles((theme) => ({
  Layers: {
    width: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
    paddingBottom: "64px",
    position: "relative",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  verticalLines: {
    display: "flex",
    height: "calc(100% - 128px)",
    position: "absolute",
    top: "0px",
    left: "0px",
    margin: "32px 18%",
    "& > div": {
      width: `${INDENT_WIDTH - 1}px`,
      height: "100%",
      borderLeft: `1px solid ${theme.palette.swatches.grey[700]}`,
    },
  },
  layersList: {
    width: "100%",
    margin: "28px 18%",
  },
  layersListItem: {
    height: "28px",
    margin: "4px 0px",
    color: theme.palette.swatches.grey[1000],
    width: "unset !important",
    transition: "background 0.2s ease-out",
    "&:hover": {
      background: theme.palette.swatches.grey[1000],
      "& .addAtPosition": {
        opacity: 1,
      },
    },
  },
  layersListItemButton: {
    height: "28px",
    display: "flex !important",
    justifyContent: "space-between !important",
    paddingLeft: "8px !important",
    paddingRight: "4px !important",
    "& > div": {
      display: "flex",
      justifyContent: "space-between",
    },
    "& > div:first-child": {
      "& .MuiListItemIcon-root": {
        minWidth: "26px",
        marginTop: "4px",
      },
    },
    "& > div:nth-child(2)": {
      "& .MuiListItemIcon-root": {
        minWidth: "20px",
        color: theme.palette.swatches.grey[1000],
      },
    },
  },
  layerName: {
    lineHeight: "21px",
  },
  right: {
    display: "flex",
    justifyContent: "space-between",
    lineHeight: "0px",
    height: "28px",
  },
  indicatorIcons: {
    display: "flex",
    justifyContent: "space-between",
    borderRight: `4px solid ${theme.palette.swatches.grey[1000]}`,
    marginRight: "4px",
    paddingRight: "4px",
    "& > div": {
      padding: "4px",
      width: "28px",
      height: "28px",
      boxSizing: "border-box",
    },
  },
  positionIcons: {
    display: "flex",
    justifyContent: "space-between",
  },
  rowIcon: {
    width: "28px",
    height: "28px",
    color: `${theme.palette.swatches.grey[1000]} !important`,
  },
  dragHandle: {
    padding: "4px",
  },
  addLayer: {
    position: "fixed !important",
    top: "58px",
    left: "230px",
    borderRadius: "3px !important",
    backgroundColor: `${theme.palette.swatches.p[0]} !important`,
    border: "none !important",
  },
  addAtPosition: {
    position: "absolute",
    left: "-34px",
    bottom: "-3px",
    opacity: 0,
    transition: "opacity 0.2s ease-out",
    "& > button": {
      background: `${theme.palette.swatches.p[0]} !important`,
      borderBottomRightRadius: "0px !important",
      borderTopRightRadius: "4px !important",
      borderBottomLeftRadius: "4px !important",
      borderTopLeftRadius: "4px !important",
    },
  },
  line: {
    width: "486px",
    height: "2px",
    background: theme.palette.swatches.p[0],
    marginTop: "26px",
  },
}));

let configuration = {};
let savedMinLayers = "";
export default function Layers() {
  const c = useStyles();

  const dispatch = useDispatch();
  const [flatLayers, setFlatLayers] = useState([]);

  const mission = useSelector((state) => state.core.mission);
  const minLayersStr = useSelector((state) => {
    if (state.core.configuration?.layers == null) return "[]";

    configuration = state.core.configuration;

    const minLayers = [];
    traverseLayers(state.core.configuration.layers, (layer, path, i, depth) => {
      minLayers.push({
        layer: {
          name: layer.name,
          uuid: layer.uuid,
          type: layer.type,
          visibility: layer.visibility,
        },
        depth,
      });
    });
    return JSON.stringify(minLayers);
  });
  const minLayers = JSON.parse(minLayersStr);

  useEffect(() => {
    return () => {
      savedMinLayers = "";
    };
  }, []);

  const handleClick = (layer) => {
    dispatch(
      setModal({
        name: "layer",
        on: true,
        layerUUID: layer.uuid,
        onClose: () => {},
      })
    );
  };

  if (configuration?.layers?.length == null) {
    return <div className={c.Layers}>Not found</div>;
  }

  const strConf = JSON.stringify(minLayers);
  if (savedMinLayers != strConf) {
    const nextFlatLayers = [];
    traverseLayers(configuration.layers, (layer, path, i, depth) => {
      nextFlatLayers.push({ layer, depth });
    });
    setFlatLayers(nextFlatLayers);
    savedMinLayers = strConf;
  }

  const updateDepth = (nextFlatLayers, result) => {
    // Now we have to convert flatLayers to actual configuration structure
    const nextLayers = [];

    const prevIndentations = [];
    const prevLayerObjects = [];
    //Iterate over actual layer rows and not modals (which is where the data is)
    // because modals aren't ordered.
    nextFlatLayers.forEach(function (layer, idx) {
      const l = layer.layer;

      if (l.type === "header") {
        l.sublayers = [];
      }

      // Make dragged layer always match the depth of the new layer just above it
      if (result != null)
        if (idx === result.destination.index) {
          if (idx === 0) layer.depth = 0;
          else if (prevLayerObjects[idx - 1].type === "header")
            layer.depth = prevIndentations[idx - 1] + 1;
          else layer.depth = prevIndentations[idx - 1];
        }

      //This is now the proper spelling and 'broke' is the misspelling
      let breaked = false;
      for (let i = prevIndentations.length - 1; i >= 0; i--) {
        if (layer.depth > prevIndentations[i]) {
          if (prevLayerObjects[i].type === "header") {
            if (!prevLayerObjects[i].hasOwnProperty("sublayers")) {
              prevLayerObjects[i].sublayers = [];
            }
            prevLayerObjects[i].sublayers.push(l);
            breaked = true;
            break;
          } else {
            layer.depth = prevIndentations[i];
          }
        }
      }

      if (!breaked || prevIndentations.length == 0) {
        nextLayers.push(l);
      }

      prevIndentations.push(layer.depth);
      prevLayerObjects.push(l);
    });

    const nextConfiguration = JSON.parse(JSON.stringify(configuration));
    nextConfiguration.layers = nextLayers;
    dispatch(setConfiguration(nextConfiguration));
  };

  const onIndent = (layer, idx) => {
    const nextFlatLayers = JSON.parse(JSON.stringify(flatLayers));
    nextFlatLayers[idx].depth = Math.min(nextFlatLayers[idx].depth + 1, 12);
    updateDepth(nextFlatLayers);
  };
  const onExdent = (layer, idx) => {
    const nextFlatLayers = JSON.parse(JSON.stringify(flatLayers));
    nextFlatLayers[idx].depth = Math.max(nextFlatLayers[idx].depth - 1, 0);
    updateDepth(nextFlatLayers);
  };

  const onDragEnd = (result) => {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    const nextFlatLayers = reorderArray(
      JSON.parse(JSON.stringify(flatLayers)),
      result.source.index,
      result.destination.index
    );

    updateDepth(nextFlatLayers, result);
  };

  return (
    <>
      <div className={c.Layers}>
        <Button
          className={c.addLayer}
          variant="outlined"
          startIcon={<AddIcon size="small" />}
          onClick={() => {
            const nextConfiguration = JSON.parse(JSON.stringify(configuration));
            window.newUUIDCount++;
            const uuid = window.newUUIDCount;
            nextConfiguration.layers.unshift({
              name: "New Layer",
              uuid,
              type: "header",
              sublayers: [],
            });
            dispatch(setConfiguration(nextConfiguration));
          }}
        >
          Add New Layer
        </Button>
        <div className={c.verticalLines}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={c.layersList}
              >
                {flatLayers.map((l, idx) => {
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
                      color = "#245980";
                      break;
                    case "query":
                      iconType = <TravelExploreIcon fontSize="small" />;
                      color = "#4c8b2d";
                      break;
                    case "tile":
                      iconType = <LanguageIcon fontSize="small" />;
                      color = "#67401d";
                      break;
                    case "vectortile":
                      iconType = <GridViewIcon fontSize="small" />;
                      color = "#0792c5";
                      break;
                    case "model":
                      iconType = <ViewInArIcon fontSize="small" />;
                      color = "#a98732";
                      break;
                    case "velocity":
                      iconType = <AirIcon fontSize="small" />;
                      color = "#24807c";
                    case "image":
                      iconType = <ImageIcon fontSize="small" />;
                      color = "#b0518f";
                      break;
                    default:
                  }

                  return (
                    <Draggable
                      key={l.layer.uuid ? String(l.layer.uuid) : l.layer.name}
                      draggableId={
                        l.layer.uuid ? String(l.layer.uuid) : l.layer.name
                      }
                      index={idx}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <ListItem
                            className={c.layersListItem}
                            key={idx}
                            disablePadding
                            style={{
                              marginLeft: l.depth * INDENT_WIDTH + "px",
                              background: color,
                              marginTop: snapshot.isDragging ? "0px" : "4px",
                              boxShadow: snapshot.isDragging
                                ? `0px 1px 4px 0px rgba(0,0,0,0.4)`
                                : `0px 1px 2px 0px rgba(0,0,0,0.2)`,
                            }}
                          >
                            <ListItemButton
                              className={c.layersListItemButton}
                              role={undefined}
                              onClick={(e) => {
                                handleClick(l.layer);
                              }}
                              dense
                            >
                              <div>
                                <ListItemIcon
                                  style={{
                                    color: "white",
                                  }}
                                >
                                  {iconType}
                                </ListItemIcon>
                                <ListItemText
                                  className={c.layerName}
                                  primary={l.layer.name}
                                />
                              </div>
                              <div className={c.right}>
                                <div className={c.indicatorIcons}>
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
                                <div className={c.positionIcons}>
                                  <IconButton
                                    className={c.rowIcon}
                                    title="Indent Left"
                                    aria-label="indent left"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onExdent(l, idx);
                                    }}
                                  >
                                    <KeyboardArrowLeftIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    className={c.rowIcon}
                                    title="Indent Right"
                                    aria-label="indent right"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onIndent(l, idx);
                                    }}
                                  >
                                    <KeyboardArrowRightIcon fontSize="small" />
                                  </IconButton>
                                  <div
                                    {...provided.dragHandleProps}
                                    className={c.dragHandle}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <ListItemIcon>
                                      <DragIndicatorIcon fontSize="small" />
                                    </ListItemIcon>
                                  </div>
                                </div>
                              </div>
                              <div
                                className={clsx(
                                  c.addAtPosition,
                                  "addAtPosition"
                                )}
                                style={{
                                  transform: `translateX(${
                                    l.depth * -INDENT_WIDTH
                                  }px)`,
                                }}
                              >
                                <Tooltip
                                  title="Add New Layer Here"
                                  placement="left"
                                  arrow
                                >
                                  <IconButton
                                    className={c.rowIcon}
                                    title="Indent Right"
                                    aria-label="indent right"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextConfiguration = JSON.parse(
                                        JSON.stringify(configuration)
                                      );
                                      window.newUUIDCount++;
                                      const uuid = window.newUUIDCount;
                                      insertLayerAfterUUID(
                                        nextConfiguration.layers,
                                        {
                                          name: "New Layer",
                                          uuid,
                                          type: "header",
                                          sublayers: [],
                                        },
                                        l.layer.uuid
                                      );
                                      dispatch(
                                        setConfiguration(nextConfiguration)
                                      );
                                    }}
                                  >
                                    <AddIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <div className={c.line}></div>
                              </div>
                            </ListItemButton>
                          </ListItem>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
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
