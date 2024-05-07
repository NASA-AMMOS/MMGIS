import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";
import { getLayerByUUID } from "../../../../../core/utils";

import {
  setMissions,
  setModal,
  setSnackBarText,
} from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import LayersIcon from "@mui/icons-material/Layers";

import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

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
    maxWidth: "1500px !important",
    maxHeight: "calc(100% - 32px) !important",
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[0],
    borderBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
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
    textAlign: "right",
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
}));

const MODAL_NAME = "layer";
const LayerModal = (props) => {
  const {} = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);

  const layerUUID = modal && modal.layerUUID ? modal.layerUUID : null;

  const layer = getLayerByUUID(configuration.layers, layerUUID) || {};

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

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

    default:
      break;
  }

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
        <Maker config={config} layer={layer} />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => {}}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LayerModal;
