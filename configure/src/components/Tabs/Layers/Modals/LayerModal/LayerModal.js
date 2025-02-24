import React from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  getLayerByUUID,
  traverseLayers,
  insertLayerAfterUUID,
  getIn,
  setIn,
} from "../../../../../core/utils";

import {
  setModal,
  setSnackBarText,
  setConfiguration,
} from "../../../../../core/ConfigureStore";

import { inject } from "../../../../../core/injectables";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import LayersIcon from "@mui/icons-material/Layers";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import Maker from "../../../../../core/Maker";

import dataConfig from "../../../../../metaconfigs/layer-data-config.json";
import headerConfig from "../../../../../metaconfigs/layer-header-config.json";
import modelConfig from "../../../../../metaconfigs/layer-model-config.json";
import queryConfig from "../../../../../metaconfigs/layer-query-config.json";
import tileConfig from "../../../../../metaconfigs/layer-tile-config.json";
import vectorConfig from "../../../../../metaconfigs/layer-vector-config.json";
import vectortileConfig from "../../../../../metaconfigs/layer-vectortile-config.json";
import velocityConfig from "../../../../../metaconfigs/layer-velocity-config.json";
import imageConfig from "../../../../../metaconfigs/layer-image-config.json";

const useStyles = makeStyles((theme) => ({
  Modal: {
    margin: theme.headHeights[1],
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      width: "100%",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
      marginLeft: "111px",
    },
  },
  contents: {
    height: "100%",
    width: "100%",
    maxWidth: "80% !important",
    maxHeight: "calc(100% - 32px) !important",
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[0],
    padding: `4px ${theme.spacing(2)} 4px ${theme.spacing(4)} !important`,
  },
  title: {
    padding: `8px 0px`,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  content: {
    padding: "0px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
    overflowY: "auto",
  },
  closeIcon: {
    padding: theme.spacing(1.5),
    height: "100%",
    margin: "4px 0px",
  },
  flexBetween: {
    display: "flex",
    justifyContent: "space-between",
  },
  subtitle: {
    fontSize: "14px !important",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[300],
    letterSpacing: "0.2px",
  },
  subtitle2: {
    fontSize: "12px !important",
    fontStyle: "italic",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[400],
  },
  missionNameInput: {
    width: "100%",
    margin: "8px 0px 4px 0px !important",
  },
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
  dialogActions: {
    display: "flex !important",
    justifyContent: "space-between !important",
    background: `${theme.palette.swatches.grey[150]} !important`,
    padding: "8px 14px !important",
  },
  removeButton: {
    background: `${theme.palette.swatches.red[500]} !important`,
    color: `${theme.palette.swatches.grey[1000]} !important`,
    border: "none !important",
  },
  uuid: {
    color: theme.palette.swatches.grey[600],
    fontSize: "14px",
  },
  actionsRight: {
    display: "flex",
  },
  cloneButton: {
    color: `${theme.palette.swatches.grey[900]} !important`,
  },
  divider: {
    borderColor: `${theme.palette.swatches.grey[300]} !important`,
    margin: "0px 10px !important",
  },
  doneButton: {
    background: `${theme.palette.swatches.p[0]} !important`,
    color: `${theme.palette.swatches.grey[150]} !important`,
    border: "none !important",
    width: "100px",
  },
}));

const MODAL_NAME = "layer";
const LayerModal = (props) => {
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);

  const layerUUID = modal && modal.layerUUID ? modal.layerUUID : null;
  const layer = getLayerByUUID(configuration.layers, layerUUID) || {};

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  let config = {};
  switch (layer.type) {
    case "data":
      config = dataConfig;
      break;

    case "header":
      config = headerConfig;
      break;

    case "model":
      config = modelConfig;
      break;

    case "query":
      config = queryConfig;
      break;

    case "tile":
      config = tileConfig;
      break;

    case "vector":
      config = vectorConfig;
      break;

    case "vectortile":
      config = vectortileConfig;
      break;

    case "velocity":
      config = velocityConfig;
      break;

    case "image":
      config = imageConfig;
      break;

    default:
      break;
  }

  config = inject(config);

  const handleClose = () => {
    const nextConfiguration = JSON.parse(JSON.stringify(configuration));
    traverseLayers(nextConfiguration.layers, (l, path, index) => {
      if (layer.uuid === l.uuid) {
        // We're repopulating all the layers values to trim it exactly to its spec
        // (otherwise defaults may be missing and switching layer types would mix parameters)
        let completedLayer = {
          uuid: l.uuid,
          sublayers: l.sublayers || [],
        };
        config.tabs.forEach((t) => {
          t.rows.forEach((r) => {
            r.components.forEach((c) => {
              // Skip non-field components (such as the map)
              if (c.field == null) return;

              const currentValue = getIn(l, c.field.split("."), null);
              if (currentValue != null)
                setIn(completedLayer, c.field.split("."), currentValue, true);

              if (c.type === "dropdown" || c.type === "colordropdown") {
                const currentValue = getIn(l, c.field);
                if (currentValue == null) {
                  setIn(completedLayer, c.field.split("."), c.options[0], true);
                }
              } else if (c.type === "checkbox" || c.type === "switch") {
                const currentValue = getIn(l, c.field);
                if (currentValue == null && c.defaultChecked != null) {
                  setIn(
                    completedLayer,
                    c.field.split("."),
                    c.defaultChecked,
                    true
                  );
                }
              } else if (c.type === "slider") {
                const currentValue = getIn(l, c.field);
                if (currentValue == null && c.default != null) {
                  setIn(
                    completedLayer,
                    c.field.split("."),
                    c.default || c.min || 0,
                    true
                  );
                }
              } else if (c.type === "colorpicker") {
                const currentValue = getIn(l, c.field);
                if (currentValue == null) {
                  setIn(
                    completedLayer,
                    c.field.split("."),
                    c.default || "#FFFFFF",
                    true
                  );
                }
              }
            });
          });
        });

        // Clear and copy while maintaining reference
        Object.keys(l).forEach((key) => {
          delete l[key];
        });
        // Setting these here just so that the show up first in the object
        l.name = completedLayer.name;
        l.uuid = completedLayer.uuid;
        Object.keys(completedLayer).forEach((key) => {
          l[key] = completedLayer[key];
        });
      }
    });
    dispatch(setConfiguration(nextConfiguration));

    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="responsive-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <LayersIcon className={c.backgroundIcon} />
            <div className={c.title}>{layer.name}</div>
          </div>
          <IconButton
            className={c.closeIcon}
            title="Close"
            aria-label="close"
            onClick={handleClose}
          >
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={c.content}>
        <Maker config={config} layer={layer} inlineHelp={true} />
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <div>
          <Button
            className={c.removeButton}
            variant="outlined"
            startIcon={<DeleteForeverIcon size="small" />}
            onClick={() => {
              const nextConfiguration = JSON.parse(
                JSON.stringify(configuration)
              );
              traverseLayers(nextConfiguration.layers, (l, path, index) => {
                if (layer.uuid === l.uuid) {
                  return "remove";
                }
              });
              dispatch(setConfiguration(nextConfiguration));
              dispatch(
                setSnackBarText({
                  text: `Successfully removed '${layer.name}'.`,
                  severity: "success",
                })
              );
              handleClose();
            }}
          >
            Remove Layer
          </Button>
        </div>
        <div className={c.uuid}>{`Layer UUID: ${layer.uuid}${
          typeof layer.uuid === "number"
            ? " (Will be formally assigned upon saving)"
            : ""
        }`}</div>
        <div className={c.actionsRight}>
          <Tooltip title="Clone Layer" placement="top" arrow>
            <IconButton
              className={c.cloneButton}
              onClick={() => {
                const nextConfiguration = JSON.parse(
                  JSON.stringify(configuration)
                );
                const clonedLayer = JSON.parse(JSON.stringify(layer));
                window.newUUIDCount++;
                const uuid = window.newUUIDCount;
                clonedLayer.uuid = uuid;
                if (clonedLayer.type === "header") clonedLayer.sublayers = [];
                insertLayerAfterUUID(
                  nextConfiguration.layers,
                  clonedLayer,
                  layer.uuid
                );
                dispatch(setConfiguration(nextConfiguration));
                dispatch(
                  setSnackBarText({
                    text: `Cloned '${layer.name}'.`,
                    severity: "success",
                  })
                );
              }}
            >
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>

          <Divider className={c.divider} orientation="vertical" flexItem />

          <Button
            className={c.doneButton}
            onClick={() => {
              handleClose();
            }}
          >
            Done
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default LayerModal;
