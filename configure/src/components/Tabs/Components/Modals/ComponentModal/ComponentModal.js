import React from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  getComponentFromConfiguration,
  updateComponentInConfiguration,
  getIn,
  setIn,
} from "../../../../../core/utils";

import { setModal, setConfiguration } from "../../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ExtensionIcon from "@mui/icons-material/Extension";

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
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
    color: theme.palette.swatches.grey[700],
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

const MODAL_NAME = "component";

const ComponentModal = (props) => {
  const {} = props;
  const c = useStyles();

  let modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);

  const open = modal !== false;

  modal = modal || {};
  const componentName = modal.componentName;
  const componentConfig = modal.componentConfig;
  const component =
    getComponentFromConfiguration(componentName, configuration) || {};

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    const nextConfiguration = JSON.parse(JSON.stringify(configuration));
    if (!nextConfiguration.components) nextConfiguration.components = [];

    nextConfiguration.components.forEach((currentComponent, idx) => {
      if (currentComponent.name === componentName && componentConfig?.config?.rows) {
        componentConfig.config.rows.forEach((r) => {
          r.components.forEach((c) => {
            // Skip non-field components and unchangeable ones
            if (
              c.field == null ||
              c.field === "name" ||
              c.field === "js" ||
              c.field === "variables"
            )
              return;

            const currentValue = getIn(currentComponent, c.field.split("."), null);
            if (currentValue != null)
              setIn(currentComponent, c.field.split("."), currentValue, true);

            if (c.type === "dropdown" || c.type === "colordropdown") {
              const currentValue = getIn(currentComponent, c.field);
              if (currentValue == null) {
                setIn(currentComponent, c.field.split("."), c.options[0], true);
              }
            } else if (c.type === "checkbox" || c.type === "switch") {
              const currentValue = getIn(currentComponent, c.field);
              if (currentValue == null && c.defaultChecked != null) {
                setIn(currentComponent, c.field.split("."), c.defaultChecked, true);
              }
            } else if (c.type === "slider") {
              const currentValue = getIn(currentComponent, c.field);
              if (currentValue == null && c.default != null) {
                setIn(
                  currentComponent,
                  c.field.split("."),
                  c.default || c.min || 0,
                  true
                );
              }
            } else if (c.type === "colorpicker") {
              const currentValue = getIn(currentComponent, c.field);
              if (currentValue == null) {
                setIn(
                  currentComponent,
                  c.field.split("."),
                  c.default || "#FFFFFF",
                  true
                );
              }
            }
          });
        });
        nextConfiguration.components[idx] = currentComponent;
        dispatch(setConfiguration(nextConfiguration));
      }
    });

    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  let componentActive = component.name != null ? true : false;
  if (component?.on != null) componentActive = component.on;

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
            <ExtensionIcon className={c.backgroundIcon} />
            <div className={c.title}>{componentName}</div>
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
              {componentConfig?.description}
            </Typography>
            <Typography className={c.infoDescription}>
              {componentConfig?.descriptionFull?.title}
            </Typography>
          </div>
          <div className={c.topOptions}>
            <FormGroup>
              <FormControlLabel
                className={c.onLabel}
                control={
                  <Switch
                    className={c.switch}
                    checked={componentActive}
                    onChange={(e) => {
                      const nextConfiguration = JSON.parse(
                        JSON.stringify(configuration)
                      );
                      if (!nextConfiguration.components)
                        nextConfiguration.components = [];

                      if (component != null && component.name != null) {
                        updateComponentInConfiguration(
                          component.name,
                          nextConfiguration,
                          ["on"],
                          !componentActive
                        );
                      } else {
                        nextConfiguration.components.push({
                          on: true,
                          name: componentName,
                          icon: componentConfig.defaultIcon,
                          js: Object.keys(componentConfig.paths)[0],
                        });
                      }
                      dispatch(setConfiguration(nextConfiguration));
                    }}
                  />
                }
                label={componentActive ? "ON" : "OFF"}
                labelPlacement="start"
              />
            </FormGroup>
            {componentConfig?.defaultIcon && (
              <TextField
                className={c.text}
                variant="filled"
                size="small"
                value={component?.icon || componentConfig?.defaultIcon || ""}
                label={"MDI Icon Name (optional)"}
                onChange={(e) => {
                  const nextConfiguration = JSON.parse(
                    JSON.stringify(configuration)
                  );
                  if (!nextConfiguration.components)
                    nextConfiguration.components = [];

                  if (component != null && component.name != null) {
                    updateComponentInConfiguration(
                      component.name,
                      nextConfiguration,
                      ["icon"],
                      e.target.value
                    );
                  } else {
                    nextConfiguration.components.push({
                      on: true,
                      name: componentName,
                      icon: e.target.value,
                      js: Object.keys(componentConfig.paths)[0],
                    });
                  }
                  dispatch(setConfiguration(nextConfiguration));
                }}
              />
            )}
          </div>
        </div>
        {componentConfig?.hasVars ? (
          <Maker
            config={componentConfig.config}
            data={component?.variables || {}}
            onChange={(field, value) => {
              const nextConfiguration = JSON.parse(
                JSON.stringify(configuration)
              );
              if (!nextConfiguration.components)
                nextConfiguration.components = [];

              if (component != null && component.name != null) {
                updateComponentInConfiguration(
                  component.name,
                  nextConfiguration,
                  ["variables", ...field.split(".")],
                  value
                );
              } else {
                const newComponent = {
                  on: true,
                  name: componentName,
                  icon: componentConfig.defaultIcon,
                  js: Object.keys(componentConfig.paths)[0],
                  variables: {},
                };
                setIn(newComponent.variables, field.split("."), value, true);
                nextConfiguration.components.push(newComponent);
              }
              dispatch(setConfiguration(nextConfiguration));
            }}
          />
        ) : (
          <Typography className={c.noFurtherConf}>
            No further configuration
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ComponentModal;
