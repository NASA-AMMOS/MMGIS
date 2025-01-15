import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ControlPointDuplicateIcon from "@mui/icons-material/ControlPointDuplicate";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { useDropzone } from "react-dropzone";

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

const MODAL_NAME = "appendGeoDataset";
const AppendGeoDatasetModal = (props) => {
  const { queryGeoDatasets } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [geojson, setGeojson] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [startTimeField, setStartTimeField] = useState(null);
  const [endTimeField, setEndTimeField] = useState(null);

  useEffect(() => {
    setStartTimeField(modal?.geoDataset?.start_time_field);
    setEndTimeField(modal?.geoDataset?.end_time_field);
  }, [JSON.stringify(modal)]);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    const geoDatasetName = modal?.geoDataset?.name;

    if (geojson == null || fileName === null) {
      dispatch(
        setSnackBarText({
          text: "Please upload a file.",
          severity: "error",
        })
      );
      return;
    }

    if (geoDatasetName === null) {
      dispatch(
        setSnackBarText({
          text: "No GeoDataset found to append to.",
          severity: "error",
        })
      );
      return;
    }
    const forceParams = {
      filename: fileName,
    };
    if (startTimeField) forceParams.start_prop = startTimeField;
    if (endTimeField) forceParams.end_prop = endTimeField;

    calls.api(
      "geodatasets_append",
      {
        urlReplacements: {
          name: geoDatasetName,
        },
        forceParams,
        type: geojson.type,
        features: geojson.features,
      },
      (res) => {
        if (res.status === "success") {
          dispatch(
            setSnackBarText({
              text: "Successfully appended to GeoDataset.",
              severity: "success",
            })
          );
          queryGeoDatasets();
          handleClose();
        } else {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to append to GeoDataset.",
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to append to GeoDataset.",
            severity: "error",
          })
        );
      }
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
      "application/json": [".json", ".geojson"],
    },
    onDropAccepted: (files) => {
      const file = files[0];
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        setGeojson(JSON.parse(e.target.result));
      };
      reader.readAsText(file);
    },
    onDropRejected: () => {
      setFileName(null);
      setGeojson(null);
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
            <ControlPointDuplicateIcon className={c.backgroundIcon} />
            <div
              className={c.title}
            >{`Append features to this GeoDataset: ${modal?.geoDataset?.name}`}</div>
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
          {`Appends the features of the uploaded file to the GeoDataset`}
        </Typography>
        <div className={c.dropzone}>
          <div {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            {isDragAccept && <p>All files will be accepted</p>}
            {isDragReject && <p>Some files will be rejected</p>}
            {!isDragActive && (
              <div className={c.dropzoneMessage}>
                <p>Drag 'n' drop or click to select files...</p>
                <p>Only *.json and *.geojson files are accepted.</p>
              </div>
            )}
          </div>
        </div>

        <div className={c.fileName}>
          <InsertDriveFileIcon />
          <div>{fileName || "No File Selected"}</div>
        </div>

        <div className={c.timeFields}>
          <div>
            <TextField
              className={c.missionNameInput}
              label="Start Time Field"
              variant="filled"
              value={startTimeField}
              onChange={(e) => {
                setStartTimeField(e.target.value);
              }}
            />
            <Typography className={c.subtitle2}>
              {`If this GeoDataset already has a Start Time Field attached, the name of that start time field inside each feature's "properties" object for which to create a temporal index for the geodataset. Take care in using time field names for the appended GeoJSON features that are different from that of the existing features.`}
            </Typography>
          </div>
          <div>
            <TextField
              className={c.missionNameInput}
              label="End Time Field"
              variant="filled"
              value={endTimeField}
              onChange={(e) => {
                setEndTimeField(e.target.value);
              }}
            />
            <Typography className={c.subtitle2}>
              {`If this GeoDataset already has a End Time Field attached, the name of that end time field inside each feature's "properties" object for which to create a temporal index for the geodataset. Take care in using time field names for the appended GeoJSON features that are different from that of the existing features.`}
            </Typography>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Append to GeoDataset
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppendGeoDatasetModal;
