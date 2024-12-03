import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";

import {
  setModal,
  setSnackBarText,
  saveConfiguration,
  setConfiguration,
  clearLockConfig,
} from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import UploadIcon from "@mui/icons-material/Upload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { useDropzone } from "react-dropzone";

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
    width: "600px",
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
  missionNameInput: {
    width: "100%",
    margin: "8px 0px 4px 0px !important",
  },
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
  fileName: {
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: "1px",
    marginBottom: "10px",
    paddingBottom: "10px",
  },
  dropzone: {
    width: "100%",
    minHeight: "100px",
    margin: "16px 0px",
    "& > div": {
      flex: "1 1 0%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px",
      borderWidth: "2px",
      borderRadius: "2px",
      borderColor: theme.palette.swatches.grey[300],
      borderStyle: "dashed",
      backgroundColor: theme.palette.swatches.grey[900],
      color: theme.palette.swatches.grey[200],
      outline: "none",
      transition: "border 0.24s ease-in-out 0s",
      "&:hover": {
        borderColor: theme.palette.swatches.p[11],
      },
    },
  },
  dropzoneMessage: {
    textAlign: "center",
    color: theme.palette.swatches.p[11],
    "& > p:first-child": { fontWeight: "bold", letterSpacing: "1px" },
    "& > p:last-child": { fontSize: "14px", fontStyle: "italic" },
  },
}));

const MODAL_NAME = "uploadConfig";
const UploadConfigModal = (props) => {
  const { queryVersions } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const mission = useSelector((state) => state.core.mission);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [configJson, setConfigJson] = useState(null);
  const [fileName, setFileName] = useState(null);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (configJson == null || fileName === null) {
      dispatch(
        setSnackBarText({
          text: "Please upload a file.",
          severity: "error",
        })
      );
      return;
    }
    console.log(configJson);

    if (
      !configJson.hasOwnProperty("msv") ||
      !configJson.hasOwnProperty("layers") ||
      !configJson.hasOwnProperty("tools")
    ) {
      dispatch(
        setSnackBarText({
          text: "This JSON doesn't appear to be an MMGIS Config.JSON file.",
          severity: "error",
        })
      );
      return;
    }

    dispatch(
      saveConfiguration({
        configuration: configJson,
        cb: (status, resp) => {
          dispatch(
            setSnackBarText({
              text:
                status === "success"
                  ? "Uploaded and Saved!"
                  : "Failed to save configuration!" +
                    (resp?.errors?.[0]?.reason
                      ? ` — ${resp?.errors?.[0]?.reason}`
                      : ""),
              severity: status,
            })
          );
          queryVersions();
          if (status === "success")
            if (mission != null)
              calls.api(
                "get",
                { mission: mission },
                (res) => {
                  dispatch(setConfiguration(res));
                  dispatch(clearLockConfig({}));
                  handleClose();
                },
                (res) => {
                  dispatch(
                    setSnackBarText({
                      text:
                        res?.message ||
                        "Failed to get configuration for mission.",
                      severity: "error",
                    })
                  );
                }
              );
        },
      })
    );
  };

  // Dropzone initialization
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    maxFiles: 1,
    accept: {
      "application/json": [".json"],
    },
    onDropAccepted: (files) => {
      const file = files[0];
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        setConfigJson(JSON.parse(e.target.result));
      };
      reader.readAsText(file);
    },
    onDropRejected: () => {
      setFileName(null);
      setConfigJson(null);
    },
  });

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
            <UploadIcon className={c.backgroundIcon} />
            <div className={c.title}>{`Upload a Configuration`}</div>
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
          {`Replaces the existing configuration for this mission with one that's uploaded.`}
        </Typography>
        <div className={c.dropzone}>
          <div {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            {isDragAccept && <p>All files will be accepted</p>}
            {isDragReject && <p>Some files will be rejected</p>}
            {!isDragActive && (
              <div className={c.dropzoneMessage}>
                <p>Drag 'n' drop or click to select files...</p>
                <p>Only *.json MMGIS configuration files are accepted.</p>
              </div>
            )}
          </div>
        </div>

        <div className={c.fileName}>
          <InsertDriveFileIcon />
          <div>{fileName || "No File Selected"}</div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Upload Config.JSON
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadConfigModal;
