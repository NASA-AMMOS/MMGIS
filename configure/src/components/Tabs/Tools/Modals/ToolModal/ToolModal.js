import React from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  getToolFromConfiguration,
  updateToolInConfiguration,
  getIn,
  setIn,
} from "../../../../../core/utils";

import { setModal, setConfiguration } from "../../../../../core/ConfigureStore";

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
    width: "100%",
    maxWidth: "80% !important",
    maxHeight: "calc(100% - 32px) !important",
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
    borderBottom: `3px solid ${theme.palette.swatches.p[0]}`,
    paddingBottom: `10px`,
    background: theme.palette.secondary.main,
    color: theme.palette.swatches.grey[700],
  },
  topOptions: {
    padding: "20px 20px 0px 20px",
    minWidth: "180px",
    "& > div:first-child": {
      padding: "5px",
    },
  },
  switch: {
    transform: "scale(1.25)",
    marginRight: "8px",
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: theme.palette.accent.main,
    },
    "& .MuiSwitch-track": {
      backgroundColor: `${theme.palette.swatches.grey[800]} !important`,
    },
  },
  onLabel: {
    "& .MuiFormControlLabel-label": {
      color: theme.palette.swatches.grey[900],
      marginRight: "5px",
    },
  },
  info: {
    padding: "16px",
    marginBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
  },
  infoTitle: {
    color: theme.palette.swatches.grey[900],
    marginBottom: "8px",
  },
  infoDescription: {
    color: theme.palette.swatches.grey[600],
  },
  text: {
    "& .MuiFormLabel-root": {
      color: `${theme.palette.swatches.grey[700]} !important`,
    },
    "& .MuiInputBase-root": {
      background: `${theme.palette.swatches.grey[300]} !important`,
      color: `${theme.palette.swatches.grey[900]} !important`,
    },
    "& .MuiInputBase-root::after": {
      borderBottom: `1px solid ${theme.palette.swatches.grey[400]}`,
    },
  },
  noFurtherConf: {
    textAlign: "center",
    margin: "40px 0px !important",
    color: theme.palette.swatches.grey[600],
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
    const nextConfiguration = JSON.parse(JSON.stringify(configuration));
    nextConfiguration.tools.forEach((currentTool, idx) => {
      if (currentTool.name === toolName && toolConfig?.config?.rows) {
        toolConfig.config.rows.forEach((r) => {
          r.components.forEach((c) => {
            // Skip non-field components and unchangeable ones
            if (
              c.field == null ||
              c.field === "name" ||
              c.field === "js" ||
              c.field === "variables"
            )
              return;

            const currentValue = getIn(currentTool, c.field.split("."), null);
            if (currentValue != null)
              setIn(currentTool, c.field.split("."), currentValue, true);

            if (c.type === "dropdown" || c.type === "colordropdown") {
              const currentValue = getIn(currentTool, c.field);
              if (currentValue == null) {
                setIn(currentTool, c.field.split("."), c.options[0], true);
              }
            } else if (c.type === "checkbox" || c.type === "switch") {
              const currentValue = getIn(currentTool, c.field);
              if (currentValue == null && c.defaultChecked != null) {
                setIn(currentTool, c.field.split("."), c.defaultChecked, true);
              }
            } else if (c.type === "slider") {
              const currentValue = getIn(currentTool, c.field);
              if (currentValue == null && c.default != null) {
                setIn(
                  currentTool,
                  c.field.split("."),
                  c.default || c.min || 0,
                  true
                );
              }
            } else if (c.type === "colorpicker") {
              const currentValue = getIn(currentTool, c.field);
              if (currentValue == null) {
                setIn(
                  currentTool,
                  c.field.split("."),
                  c.default || "#FFFFFF",
                  true
                );
              }
            }
          });
        });
        nextConfiguration.tools[idx] = currentTool;
        dispatch(setConfiguration(nextConfiguration));
      }
    });

    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

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
                className={c.onLabel}
                control={
                  <Switch
                    className={c.switch}
                    checked={toolActive}
                    onChange={(e) => {
                      const nextConfiguration = JSON.parse(
                        JSON.stringify(configuration)
                      );
                      if (tool != null && tool.name != null) {
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
              label={"MDI Icon Name"}
              onChange={(e) => {
                const nextConfiguration = JSON.parse(
                  JSON.stringify(configuration)
                );
                if (tool != null && tool.name != null) {
                  updateToolInConfiguration(
                    tool.name,
                    nextConfiguration,
                    ["icon"],
                    e.target.value
                  );
                } else {
                  nextConfiguration.tools.push({
                    on: true,
                    name: toolName,
                    icon: e.target.value,
                    js: Object.keys(toolConfig.paths)[0],
                  });
                }
                dispatch(setConfiguration(nextConfiguration));
              }}
            />
          </div>
        </div>

        {toolConfig && toolConfig.config && toolName ? (
          <Maker
            config={toolConfig.config}
            toolName={toolName}
            inlineHelp={true}
          />
        ) : (
          <Typography className={c.noFurtherConf}>
            This tool takes no further configurations.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ToolModal;
