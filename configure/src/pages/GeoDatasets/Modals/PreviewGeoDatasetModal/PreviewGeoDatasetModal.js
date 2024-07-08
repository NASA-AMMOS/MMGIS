import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import PreviewIcon from "@mui/icons-material/Preview";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Map from "../../../../components/Map/Map";

const useStyles = makeStyles((theme) => ({
  Modal: {
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      width: "100%",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
    },
    "& .MuiPaper-root": {
      margin: "0px",
    },
  },
  contents: {
    height: "100%",
    width: "100%",
    maxWidth: "calc(100vw - 32px) !important",
    maxHeight: "calc(100vh - 32px) !important",
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
    height: `calc(100vh - 32px)`,
    background: theme.palette.swatches.grey[100],
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
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
}));

const MODAL_NAME = "previewGeoDataset";
const PreviewGeoDatasetModal = (props) => {
  const {} = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const [geoDataset, setGeoDataset] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  const queryGeoDataset = () => {
    if (modal?.geoDataset?.name)
      calls.api(
        "geodatasets_get",
        {
          layer: modal.geoDataset.name,
        },
        (res) => {
          setGeoDataset(res);
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get geodataset.",
              severity: "error",
            })
          );
        }
      );
  };
  useEffect(() => {
    queryGeoDataset();
  }, [modal?.geoDataset?.name]);

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
            <PreviewIcon className={c.backgroundIcon} />
            <div className={c.title}>{`Previewing GeoDataset${
              modal?.geoDataset?.name ? `: ${modal.geoDataset.name}` : ""
            }`}</div>
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
        <Map
          vector={{
            geojson: geoDataset,
            style: { color: "#08aeea" },
          }}
          clickableFeatures={true}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PreviewGeoDatasetModal;
