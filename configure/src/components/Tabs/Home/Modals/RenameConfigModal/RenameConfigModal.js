import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";

import {
  setModal,
  setSnackBarText,
  setMissions,
  setMission,
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
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

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
  confirmMessage: {
    fontStyle: "italic",
    fontSize: "15px !important",
  },
  warningBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "4px",
    border: `1px solid ${theme.palette.swatches.p[1]}`,
    background: "rgba(192, 130, 47, 0.12)",
  },
  warningIcon: {
    color: `${theme.palette.swatches.p[1]} !important`,
    fontSize: "20px !important",
    marginTop: "1px",
    flex: "0 0 auto",
  },
  warningText: {
    fontSize: "13px !important",
    lineHeight: "1.4 !important",
    color: `${theme.palette.swatches.grey[200]} !important`,
  },
  warningStrong: {
    fontWeight: "bold",
    color: `${theme.palette.swatches.grey[50]} !important`,
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

const MODAL_NAME = "renameConfig";
const RenameConfigModal = (props) => {
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const mission = useSelector((state) => state.core.mission);
  const missions = useSelector((state) => state.core.missions);
  const configuration = useSelector((state) => state.core.configuration);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  // The /Missions folder can only follow the rename when it currently matches
  // the mission name. When it points somewhere else the folder is shared or
  // deliberately separate, so moving it would break the other user of it.
  const currentFolder = configuration?.msv?.missionFolderName;
  const folderMatchesName =
    currentFolder == null || currentFolder === "" || currentFolder === mission;

  const [newMissionName, setNewMissionName] = useState("");
  const [followFolder, setFollowFolder] = useState(folderMatchesName);

  useEffect(() => {
    setFollowFolder(folderMatchesName);
  }, [folderMatchesName, modal]);

  const handleClose = () => {
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  const handleSubmit = () => {
    if (newMissionName === "" || newMissionName == null) {
      dispatch(
        setSnackBarText({
          text: "A new mission name needs to be specified.",
          severity: "error",
        })
      );
      return;
    }

    if (newMissionName === mission) {
      dispatch(
        setSnackBarText({
          text: "The new mission name must differ from the current name.",
          severity: "error",
        })
      );
      return;
    }

    for (let i = 0; i < missions.length; i++) {
      if (newMissionName.toLowerCase() === missions[i].toLowerCase()) {
        dispatch(
          setSnackBarText({
            text: `A mission named '${missions[i]}' already exists.`,
            severity: "error",
          })
        );
        return;
      }
    }

    calls.api(
      "rename",
      {
        mission: mission,
        newName: newMissionName,
        followFolder: folderMatchesName ? followFolder : false,
      },
      (res) => {
        // Cross mission relative paths are reported by the endpoint. Surface
        // them, otherwise nobody sees what needs fixing.
        const warnings = Array.isArray(res?.warnings) ? res.warnings : [];
        dispatch(
          setSnackBarText({
            text:
              warnings.length > 0
                ? `${res.message} ${warnings.join(" ")}`
                : res?.message ||
                  `Successfully renamed this mission to '${newMissionName}'.`,
            severity: warnings.length > 0 ? "warning" : "success",
          })
        );
        calls.api(
          "missions",
          null,
          (res) => {
            dispatch(setMissions(res.missions));
            // The renamed mission is still the active one. Point the store at
            // the new name so Main's mission effect refetches the config under
            // the new name, otherwise the open page keeps showing the old name.
            dispatch(setMission(newMissionName));
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
            text: res?.message || "Failed to rename this mission.",
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
            <DriveFileRenameOutlineIcon className={c.backgroundIcon} />
            <div className={c.title}>Rename a Mission</div>
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
        <Typography
          className={c.layerName}
        >{`Renaming: ${mission}`}</Typography>
        <TextField
          className={c.confirmInput}
          label="New Mission Name"
          variant="filled"
          value={newMissionName}
          onChange={(e) => {
            setNewMissionName(e.target.value);
          }}
        />
        <Typography
          className={c.confirmMessage}
        >{`Enter a new mission name above and click 'Rename' to rename this mission.`}</Typography>
        <FormGroup className={c.checkbox}>
          <FormControlLabel
            control={
              <Checkbox
                checked={folderMatchesName ? followFolder : false}
                disabled={!folderMatchesName}
                onChange={(e) => {
                  setFollowFolder(e.target.checked);
                }}
              />
            }
            label={"Also rename the /Missions folder"}
          />
        </FormGroup>
        <Typography className={c.confirmMessage}>
          {folderMatchesName
            ? `Renames Missions/${mission} on disk to match the new name. Leave it unchecked to keep the mission's data where it is.`
            : `Disabled because this mission's /Missions Folder Name is '${currentFolder}' rather than '${mission}'. That folder may be shared with another mission, so it is left alone.`}
        </Typography>
        <div className={c.warningBox}>
          <WarningAmberIcon className={c.warningIcon} />
          <Typography className={c.warningText}>
            {folderMatchesName && followFolder
              ? `Renaming the folder stops data from loading for anyone with this mission open until they reload. `
              : `The /Missions folder is left as it is, so the mission's data stays where it currently sits. `}
            <span className={c.warningStrong}>
              {`Renaming the mission breaks existing ?mission=${mission} links and bookmarks permanently.`}
            </span>
            {` None of the mission's data files in /Missions will be deleted.`}
          </Typography>
        </div>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button className={c.cancel} variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          className={c.submit}
          variant="contained"
          startIcon={<DriveFileRenameOutlineIcon size="small" />}
          onClick={handleSubmit}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenameConfigModal;
