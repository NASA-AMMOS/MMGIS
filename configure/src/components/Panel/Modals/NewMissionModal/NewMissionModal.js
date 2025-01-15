import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";

import {
  setMissions,
  setModal,
  setSnackBarText,
} from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

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
}));

const MODAL_NAME = "newMission";
const NewMissionModal = (props) => {
  const {} = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [missionName, setMissionName] = useState("");
  const [createDir, setCreateDir] = useState(true);

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (missionName == null || missionName === "") {
      dispatch(
        setSnackBarText({
          text: "Please enter a mission name.",
          severity: "error",
        })
      );
      return;
    }

    calls.api(
      "add",
      {
        mission: missionName,
        makedir: createDir,
      },
      (res) => {
        calls.api(
          "missions",
          null,
          (res) => {
            dispatch(setMissions(res.missions));

            dispatch(
              setSnackBarText({
                text:
                  res.message ||
                  `Successfully added new mission: ${missionName}`,
                severity: "success",
              })
            );
            // reset fields
            setMissionName("");
            setCreateDir(true);

            // and then close
            handleClose();
          },
          (res) => {
            dispatch(
              setSnackBarText({
                text: res?.message || "Failed to requery missions.",
                severity: "error",
              })
            );

            // reset fields
            setMissionName("");
            setCreateDir(true);

            // and then close
            handleClose();
          }
        );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to make new mission.",
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
            <RocketLaunchIcon className={c.backgroundIcon} />
            <div className={c.title}>Make a New Mission</div>
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
          Missions are separately configurable MMGIS map interfaces.
        </Typography>
        <TextField
          className={c.missionNameInput}
          label="Mission Name"
          variant="filled"
          value={missionName}
          onChange={(e) => {
            setMissionName(e.target.value);
          }}
        />
        <Typography className={c.subtitle2}>
          {`A new and unique name for a mission. No special characters allowed and it should not start with a number.`}
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={createDir}
                onChange={(e) => {
                  setCreateDir(!createDir);
                }}
              />
            }
            label="Create a /Missions/{Mission Name} directory"
          />
        </FormGroup>
        <Typography className={c.subtitle2}>
          {`Layer, Tiles and Data for this mission can be stored in /Missions/{Mission Name} directory.
            Whenever a non-absolute URL is found in this mission's configuration, it will be treated as relative to this folder regardless of whether this folder exists.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Make Mission
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewMissionModal;
