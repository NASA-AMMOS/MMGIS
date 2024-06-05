import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";

import {
  setModal,
  setSnackBarText,
  setMissions,
} from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

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
    width: "500px",
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
    color: theme.palette.swatches.grey[0],
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
  confirmInput: {
    width: "100%",
    margin: "10px 0px 4px 0px !important",
    borderTop: `1px solid ${theme.palette.swatches.grey[500]}`,
  },
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },

  layerName: {
    textAlign: "center",
    fontSize: "24px !important",
    letterSpacing: "1px !important",
    color: theme.palette.swatches.grey[150],
    fontWeight: "bold !important",
    margin: "10px !important",
    borderBottom: `1px solid ${theme.palette.swatches.grey[100]}`,
    paddingBottom: "10px",
  },
  hasOccurrencesTitle: {
    margin: "10px",
    display: "flex",
  },
  hasOccurrences: {
    fontStyle: "italic",
  },
  mission: {
    background: theme.palette.swatches.p[11],
    color: theme.palette.swatches.grey[900],
    height: "24px",
    lineHeight: "24px",
    padding: "0px 5px",
    borderRadius: "3px",
    display: "inline-block",
    letterSpacing: "1px",
    marginLeft: "20px",
  },
  pathName: {
    display: "flex",
    marginLeft: "40px",
    marginTop: "4px",
    height: "24px",
    lineHeight: "24px",
  },
  path: {
    color: theme.palette.swatches.grey[500],
  },
  name: {
    color: theme.palette.swatches.grey[100],
    fontWeight: "bold",
  },
  confirmMessage: {
    fontStyle: "italic",
    fontSize: "15px !important",
  },
  dialogActions: {
    display: "flex !important",
    justifyContent: "space-between !important",
  },
  submit: {
    background: `${theme.palette.swatches.p[0]} !important`,
    color: `${theme.palette.swatches.grey[1000]} !important`,
    "&:hover": {
      background: `${theme.palette.swatches.grey[0]} !important`,
    },
  },
  cancel: {},
}));

const MODAL_NAME = "cloneConfig";
const CloneConfigModal = (props) => {
  const { queryGeoDatasets } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const mission = useSelector((state) => state.core.mission);
  const missions = useSelector((state) => state.core.missions);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [newMissionName, setNewMissionName] = useState(null);
  const [hasPaths, setHasPaths] = useState(false);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (newMissionName == "" || newMissionName == null) {
      dispatch(
        setSnackBarText({
          text: "A new mission name to clone into needs to be specified.",
          severity: "error",
        })
      );
      return;
    }

    for (let i = 0; i < missions.length; i++) {
      if (newMissionName.toLowerCase() === missions[i].toLowerCase()) {
        dispatch(
          setSnackBarText({
            text: "Must clone into a new mission name!",
            severity: "error",
          })
        );
        return;
      }
    }

    calls.api(
      "clone",
      {
        existingMission: mission,
        cloneMission: newMissionName,
        hasPaths: hasPaths,
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Successfully cloned this mission into '${newMissionName}'.`,
            severity: "success",
          })
        );
        calls.api(
          "missions",
          null,
          (res) => {
            dispatch(setMissions(res.missions));
          },
          (res) => {
            dispatch(
              setSnackBarText({
                text: res?.message || "Failed to get available missions.",
                severity: "error",
              })
            );
          }
        );
        handleClose();
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Failed to clone this mission.`,
            severity: "error",
          })
        );
      }
    );
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
            <ContentCopyIcon className={c.backgroundIcon} />
            <div className={c.title}>Clone a Mission</div>
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
        <Typography className={c.layerName}>{`Cloning: ${mission}`}</Typography>
        <TextField
          className={c.confirmInput}
          label="New Mission Name to Clone Into"
          variant="filled"
          value={newMissionName}
          onChange={(e) => {
            setNewMissionName(e.target.value);
          }}
        />
        <Typography
          className={c.confirmMessage}
        >{`Enter a new mission name above and click 'Clone' to clone this mission.`}</Typography>
        <FormGroup className={c.checkbox}>
          <FormControlLabel
            control={
              <Checkbox
                checked={hasPaths}
                onChange={(e) => {
                  setHasPaths(e.target.checked);
                }}
              />
            }
            label={"Adjust Paths"}
          />
        </FormGroup>
        <Typography
          className={c.confirmMessage}
        >{`Adjust new paths so that they still point to the same data (../{mission})`}</Typography>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button className={c.cancel} variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          className={c.submit}
          variant="contained"
          startIcon={<ContentCopyIcon size="small" />}
          onClick={handleSubmit}
        >
          Clone
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloneConfigModal;
