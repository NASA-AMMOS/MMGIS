import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../../core/calls";
import {
  getLayerByUUID,
  getIn,
  setIn,
  getToolFromConfiguration,
  updateToolInConfiguration,
} from "../../../../../core/utils";

import {
  setModal,
  setSnackBarText,
  setConfiguration,
} from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import HandymanIcon from "@mui/icons-material/Handyman";

import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import Maker from "../../../../../core/Maker";

const useStyles = makeStyles((theme) => ({
  Modal: {
    margin: theme.headHeights[1],
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      width: "100%",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
      marginLeft: "111px",
    },
  },
  contents: {
    height: "100%",
    width: "calc(100% - 350px)",
    maxWidth: "1400px !important",
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
    padding: "0px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
    overflowY: "auto",
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
    textAlign: "right",
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
  top: {
    display: "flex",
    justifyContent: "space-between",
  },
  topOptions: {
    padding: "20px 20px 0px 20px",
    "& > div:first-child": {
      float: "right",
    },
  },
  switch: {
    transform: "scale(1.25)",
    marginRight: "8px",
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: theme.palette.accent.main,
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: theme.palette.swatches.p[8],
    },
  },
  info: {
    padding: "16px",
    marginBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
  },
  infoTitle: {
    color: theme.palette.swatches.grey[500],
    marginBottom: "8px",
  },
  infoDescription: {
    color: theme.palette.swatches.grey[200],
  },
}));

const MODAL_NAME = "tool";
const ToolModal = (props) => {
  const {} = props;
  const c = useStyles();

  let modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);

  const open = modal !== false;

  modal = modal || {};
  const toolName = modal.toolName;
  const toolConfig = modal.toolConfig;
  const tool = getToolFromConfiguration(toolName, configuration) || {};

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  console.log(modal);

  let toolActive = tool.name != null ? true : false;
  if (tool?.on != null) toolActive = tool.on;

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={open}
      onClose={handleClose}
      aria-labelledby="responsive-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <HandymanIcon className={c.backgroundIcon} />
            <div className={c.title}>{toolName}</div>
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
        <div className={c.top}>
          <div className={c.info}>
            <Typography className={c.infoTitle}>
              {toolConfig?.description}
            </Typography>
            <Typography className={c.infoDescription}>
              {toolConfig?.descriptionFull?.title}
            </Typography>
          </div>
          <div className={c.topOptions}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    className={c.switch}
                    checked={toolActive}
                    onChange={(e) => {
                      const nextConfiguration = JSON.parse(
                        JSON.stringify(configuration)
                      );
                      if (tool != null) {
                        updateToolInConfiguration(
                          tool.name,
                          nextConfiguration,
                          ["on"],
                          !toolActive
                        );
                      } else {
                        nextConfiguration.tools.push({
                          on: true,
                          name: toolName,
                          icon: toolConfig.defaultIcon,
                          js: Object.keys(toolConfig.paths)[0],
                        });
                      }
                      dispatch(setConfiguration(nextConfiguration));
                    }}
                  />
                }
                label={toolActive ? "ON" : "OFF"}
                labelPlacement="start"
              />
            </FormGroup>
            <TextField
              className={c.text}
              variant="filled"
              size="small"
              value={tool?.icon || toolConfig?.defaultIcon || ""}
              label={"Icon Name"}
              onChange={(e) => {
                //updateConfiguration(forceField || com.field, e.target.value, layer);
              }}
            />
          </div>
        </div>

        {toolConfig && toolName ? (
          <Maker
            config={toolConfig.config}
            toolName={toolName}
            inlineHelp={true}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => {}}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ToolModal;
