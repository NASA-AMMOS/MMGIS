import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import Papa from "papaparse";

import { calls } from "../../../../core/calls";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";

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
    borderBottom: `1px solid ${theme.palette.swatches.grey[500]}`,
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
  timeFields: {
    display: "flex",
    "& > div:first-child": {
      marginRight: "5px",
    },
    "& > div:last-child": {
      marginLeft: "5px",
    },
  },
}));

const MODAL_NAME = "updateDataset";
const UpdateDatasetModal = (props) => {
  const { queryDatasets } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [fileName, setFileName] = useState(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    const datasetName = modal?.dataset?.name;

    if (file == null || fileName === null) {
      dispatch(
        setSnackBarText({
          text: "Please upload a file.",
          severity: "error",
        })
      );
      return;
    }

    if (datasetName == null || datasetName == "") {
      dispatch(
        setSnackBarText({
          text: "Missing Dataset name.",
          severity: "error",
        })
      );
      return;
    }

    if (datasetName.match(/[|\\/~^:,;?!&%$@#*+\{\}\[\]<>]/)) {
      dispatch(
        setSnackBarText({
          text: "Dataset names cannot contain the following symbols: |\\/~^:,;?!&%$@#*+.{}[]<>",
          severity: "error",
        })
      );
      return;
    }

    const rowsPerChunk = 10000;
    let currentRows = [];
    let header = [];
    let first = true;
    let firstStep = true;
    let cursorSum = 0;
    let cursorStep = null;
    Papa.parse(file, {
      step: (row, parser) => {
        if (firstStep) {
          header = row.data;
          firstStep = false;
        } else {
          let r = {};
          for (let i = 0; i < header.length; i++) r[header[i]] = row.data[i];
          currentRows.push(r);

          if (currentRows.length >= rowsPerChunk) {
            cursorStep = cursorStep || row.meta.cursor;
            cursorSum += cursorStep;
            setProgress(Math.round((cursorSum / file.size) * 100));

            parser.pause();

            calls.api(
              "datasets_recreate",
              {
                name: datasetName,
                csv: JSON.stringify(currentRows),
                header: header,
                mode: first ? "full" : "append",
              },
              (res) => {
                first = false;
                currentRows = [];
                parser.resume();
              },
              (res) => {
                currentRows = [];
                console.log(res?.message);
                dispatch(
                  setSnackBarText({
                    text: "Failed to upload a Dataset.",
                    severity: "error",
                  })
                );
              }
            );
          }
        }
      },
      complete: function () {
        if (currentRows.length > 0) {
          calls.api(
            "datasets_recreate",
            {
              name: datasetName,
              csv: JSON.stringify(currentRows),
              header: header,
              mode: "append",
            },
            (res) => {
              dispatch(
                setSnackBarText({
                  text: "Successfully updated/replaced Dataset.",
                  severity: "success",
                })
              );
              queryDatasets();
              setProgress(null);
              handleClose();
            },
            (res) => {
              currentRows = [];
              console.log(res?.message);
              dispatch(
                setSnackBarText({
                  text: "Failed to upload a Dataset.",
                  severity: "error",
                })
              );
            }
          );
        } else {
          queryDatasets();
          setProgress(null);
        }
      },
    });

    return;
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
      "application/csv": [".csv"],
    },
    onDropAccepted: (files) => {
      const uploadedFile = files[0];
      setFileName(uploadedFile.name);
      setFile(uploadedFile);
    },
    onDropRejected: () => {
      setFileName(null);
      setFile(null);
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
            <div
              className={c.title}
            >{`Update/Replace this Dataset: ${modal?.dataset?.name}`}</div>
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
          {`Overwrites the contents of the existing Dataset with that of the uploaded file.`}
        </Typography>
        <div className={c.dropzone}>
          <div {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            {isDragAccept && <p>All files will be accepted</p>}
            {isDragReject && <p>Some files will be rejected</p>}
            {!isDragActive && (
              <div className={c.dropzoneMessage}>
                <p>Drag 'n' drop or click to select files...</p>
                <p>Only *.csv files are accepted.</p>
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
        {progress != null && (
          <LinearProgress variant="determinate" value={progress} />
        )}
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Update/Replace Dataset
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateDatasetModal;
