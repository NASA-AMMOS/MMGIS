import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";
import { getIn } from "../../../../core/utils";
import Maker from "../../../../core/Maker";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import HorizontalSplitIcon from "@mui/icons-material/HorizontalSplit";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import TextField from "@mui/material/TextField";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

const useStyles = makeStyles((theme) => ({
  Modal: {
    margin: theme.headHeights[1],
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      height: "unset !important",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
    },
  },
  contents: {
    background: theme.palette.primary.main,
    height: "100%",
    maxWidth: "unset !important",
    maxHeight: "calc(100vh - 64px) !important",
    width: "700px",
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
    padding: "8px 16px 16px 16px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
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
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
}));

const config = {
  rows: [
    {
      name: "COG Mosaicking",
      components: [
        {
          field: "stac.mosaicItemLimit",
          name: "Item Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Item Limit' denotes the max number of items/COGs to allow an individual tile to be composed of. Depending on your STAC Collection, higher numbers are more complete but possibly less performant. Defaults to 100.",
          type: "number",
          min: 0,
          step: 1,
          default: 100,
          width: 12,
        },
        {
          field: "stac.mosaicScanLimit",
          name: "Scan Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Scan Limit' denotes the max number of items/COGs to search through and consider when composing any given individual tile. Depending on your STAC Collection, higher numbers are more complete but possibly less performant. Defaults to 10000.",
          type: "number",
          min: 0,
          step: 1,
          default: 10000,
          width: 12,
        },
        {
          field: "stac.mosaicTimeLimit",
          name: "Time Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Time Limit' denotes the max number of seconds before a request for a tile is forced to return. If the 'Time Limit' is too short, returned mosaicked tiles may be incomplete. Defaults to 5 seconds.",
          type: "number",
          min: 1,
          step: 1,
          default: 5,
          width: 12,
        },
      ],
    },
  ],
};

const MODAL_NAME = "stacSettings";
const StacSettingsModal = (props) => {
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  const handleSubmit = () => {
    handleClose();
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
            <HorizontalSplitIcon className={c.backgroundIcon} />
            <div className={c.title}>Global STAC Settings</div>
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
        <Typography className={c.subtitle}>
          {"Modify global performance-related settings for STAC and TiTiler"}
        </Typography>
        <Maker config={config} inlineHelp={true} />
      </DialogContent>
      <DialogActions>
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Finish
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StacSettingsModal;
