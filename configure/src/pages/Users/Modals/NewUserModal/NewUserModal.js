import React, { useState } from "react";
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
}));

const MODAL_NAME = "newUser";
const NewUserModal = (props) => {
  const { queryUsers } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [userName, setUserName] = useState(null);
  const [email, setEmail] = useState(null);
  const [password, setPassword] = useState(null);
  const [passwordRetype, setPasswordRetype] = useState(null);

  const handleClose = () => {
    setUserName(null);
    setEmail(null);
    setPassword(null);
    setPasswordRetype(null);
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };
  const handleSubmit = () => {
    if (
      userName == null ||
      userName == "" ||
      password == null ||
      password == ""
    ) {
      dispatch(
        setSnackBarText({
          text: "Username and Password must be filled.",
          severity: "error",
        })
      );
      return;
    }

    if (password !== passwordRetype) {
      dispatch(
        setSnackBarText({
          text: "Passwords do not match.",
          severity: "error",
        })
      );
      return;
    }

    calls.api(
      "user_signup",
      {
        username: userName,
        email: email,
        password: password,
        skipLogin: true,
      },
      (res) => {
        if (res.status === "success") {
          dispatch(
            setSnackBarText({
              text: `Successfully created new user: '${userName}'.`,
              severity: "success",
            })
          );
          queryUsers();
          handleClose();
        } else {
          dispatch(
            setSnackBarText({
              text: `Failed to create new user: ${res.message}`,
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Failed to create new user: ${res.message}`,
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
            <div className={c.title}>{`Create a New User`}</div>
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
          label="Username"
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
        >{`Username. Must be unique.`}</Typography>

        <TextField
          className={c.confirmInput}
          label="Email Address"
          variant="filled"
          value={email}
          inputProps={{
            autoComplete: "off",
          }}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <Typography
          className={c.subtitle2}
        >{`The user's email. Optional but if set, must be unique.`}</Typography>

        <TextField
          className={c.confirmInput}
          label="Password"
          variant="filled"
          value={password}
          inputProps={{
            autoComplete: "off",
          }}
          type="password"
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <Typography
          className={c.subtitle2}
        >{`Passwords must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.`}</Typography>

        <TextField
          className={c.confirmInput}
          label="Retype Password"
          variant="filled"
          value={passwordRetype}
          inputProps={{
            autoComplete: "off",
          }}
          type="password"
          onChange={(e) => {
            setPasswordRetype(e.target.value);
          }}
        />
        <Typography className={c.subtitle2}>{`Retype Password`}</Typography>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button
          variant="contained"
          startIcon={<AdminPanelSettingsIcon size="small" />}
          onClick={handleSubmit}
        >
          Create
        </Button>
        <Button className={c.cancel} variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewUserModal;
