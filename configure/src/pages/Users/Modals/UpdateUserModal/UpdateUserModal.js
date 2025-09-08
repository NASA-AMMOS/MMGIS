// UpdateUserModal.js - 15 July 2025
/* global mmgisglobal */

import React, { useState, useEffect } from "react";
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
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import OutlinedInput from "@mui/material/OutlinedInput";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

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

  fileName: {
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: "1px",
    marginBottom: "10px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[500]}`,
    paddingBottom: "10px",
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
  dropdown: {
    width: "100%",
    marginTop: "20px",
  },
  assignedMissions: {
    width: "100%",
  },
  selectDropdown: {
    '& .MuiSelect-select': {
      width: "100%",
      marginTop: "20px",
      height: "25px",
    },
  },
}));

const MODAL_NAME = "updateUser";
const UpdateUserModal = (props) => {
  const { queryUsers } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [email, setEmail] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [userName, setUserName] = useState(null);
  const [missionsManaging, setMissionsManaging] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);

  // Fetch available missions when modal opens
  useEffect(() => {
    if (modal !== false) {
      calls.api(
        "missions",
        {},
        (res) => {
          if (res?.missions) {
            const missions = res.missions
              .slice()
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
            setAvailableMissions(missions);
          }
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
      
      // Initialize missions managing state
      if (modal?.row?.missions_managing) {
        setMissionsManaging(modal.row.missions_managing);
      } else {
        setMissionsManaging([]);
      }
    }
  }, [modal, dispatch]);

  const handleClose = () => {
    setEmail(null);
    setPermissions(null);
    setUserName(null);
    setMissionsManaging([]);
    setAvailableMissions([]);
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (!modal?.row?.id) {
      dispatch(
        setSnackBarText({
          text: "Cannot update undefined User.",
          severity: "error",
        })
      );
      return;
    }

    if (userName !== modal.row.username) {
      dispatch(
        setSnackBarText({
          text: "Confirmation Username does not match.",
          severity: "error",
        })
      );
      return;
    }

    calls.api(
      "account_update_user",
      {
        id: modal.row.id,
        permission: permissions || modal.row.permission,
        email: email || modal.row.email,
        missions_managing: missionsManaging || modal.row.missions_managing,
      },
      (res) => {
        if (res.body?.updated_id === modal.row.id) {
          dispatch(
            setSnackBarText({
              text: `Successfully updated '${modal.row.username}'.`,
              severity: "success",
            })
          );
          queryUsers();
          handleClose();
        } else {
          dispatch(
            setSnackBarText({
              text: `Failed to update '${modal.row.username}'.`,
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Failed to update '${modal.row.username}'.`,
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
            <AccountBoxIcon className={c.backgroundIcon} />
            <div
              className={c.title}
            >{`Update a User's Account: ${modal?.row?.username}`}</div>
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
        <TextField
          className={c.confirmInput}
          label="Email Address"
          variant="filled"
          value={email || modal?.row?.email}
          inputProps={{
            autoComplete: "off",
          }}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <Typography className={c.subtitle2}>{`The user's email.`}</Typography>

        <FormControl className={c.dropdown} variant="filled" size="small">
          <InputLabel>Role</InputLabel>
          <Select
            value={permissions || modal?.row?.permission}
            onChange={(e) => {
              setPermissions(e.target.value);
              // Clear missions when changing to user role
              if (e.target.value === "001") {
                setMissionsManaging([]);
              }
            }}
          >
            <MenuItem value={"110"}>Administrator</MenuItem>
            <MenuItem value={"001"}>User</MenuItem>
          </Select>
        </FormControl>
        <Typography
          className={c.subtitle2}
        >{`Admins have full control over mission configurations as well as elevated privileges in the Draw Tool. Users do not and are the most basic role.`}</Typography>
        
        {(permissions === "110" || (!permissions && modal?.row?.permission === "110")) && (
          <>
            <FormControl className={c.assignedMissions} variant="filled" size="small">
              <InputLabel>Assigned Missions</InputLabel>
              <Select
                className={c.selectDropdown}
                multiple
                value={missionsManaging}
                disabled={mmgisglobal.permission !== "111"}
                onChange={(e) => {
                  setMissionsManaging(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value);
                }}
                input={<OutlinedInput />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availableMissions.map((mission) => (
                  <MenuItem key={mission} value={mission}>
                    {mission}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography
              className={c.subtitle2}
            >{`Select which missions this Admin can manage. Leave empty to restrict access to all missions. Only SuperAdmins can change modify this field.`}</Typography>
          </>
        )}
        <TextField
          className={c.confirmInput}
          label="Confirm Username"
          variant="filled"
          value={userName}
          inputProps={{
            autoComplete: "off",
          }}
          onChange={(e) => {
            setUserName(e.target.value);
          }}
        />
        <Typography
          className={c.subtitle2}
        >{`Because updating may grant privileges, enter '${modal?.row?.username}' above to confirm the update to this user's account.`}</Typography>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button
          variant="contained"
          startIcon={<AdminPanelSettingsIcon size="small" />}
          onClick={handleSubmit}
        >
          Update
        </Button>
        <Button className={c.cancel} variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateUserModal;
