import React from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  getLayerByUUID,
  traverseLayers,
  insertLayerAfterUUID,
  getIn,
  setIn,
} from "../../../../../core/utils";

import {
  setModal,
  setSnackBarText,
  setConfiguration,
} from "../../../../../core/ConfigureStore";

import { inject } from "../../../../../core/injectables";
import {
  attachmentTabsFor,
  attachmentConfigPaths,
} from "../../../../../core/layerAttachmentTabs";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import LayersIcon from "@mui/icons-material/Layers";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";

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
  dialogActions: {
    display: "flex !important",
    justifyContent: "space-between !important",
    background: `${theme.palette.swatches.grey[150]} !important`,
    padding: "8px 14px !important",
  },
  removeButton: {
    background: `${theme.palette.swatches.red[500]} !important`,
    color: `${theme.palette.swatches.grey[1000]} !important`,
    border: "none !important",
  },
  uuid: {
    color: theme.palette.swatches.grey[600],
    fontSize: "14px",
  },
  actionsRight: {
    display: "flex",
  },
  cloneButton: {
    color: `${theme.palette.swatches.grey[900]} !important`,
  },
  divider: {
    borderColor: `${theme.palette.swatches.grey[300]} !important`,
    margin: "0px 10px !important",
  },
  doneButton: {
    background: `${theme.palette.swatches.p[0]} !important`,
    color: `${theme.palette.swatches.grey[150]} !important`,
    border: "none !important",
    width: "100px",
  },
  unavailable: {
    padding: theme.spacing(4),
    color: theme.palette.swatches.grey[400],
    fontSize: "14px",
    lineHeight: 1.5,
  },
}));

const MODAL_NAME = "layer";
const LayerModal = (props) => {
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);
  const layerTypeConfiguration = useSelector(
    (state) => state.core.layerTypeConfiguration,
  );
  const layerAttachmentConfiguration = useSelector(
    (state) => state.core.layerAttachmentConfiguration,
  );

  const layerUUID = modal && modal.layerUUID ? modal.layerUUID : null;
  const layer = getLayerByUUID(configuration.layers, layerUUID) || {};

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  let config = layerTypeConfiguration?.[layer.type]?.metaconfig || {};

  // Built-in types always have a metaconfig in the registry, so an empty config
  // for a real layer means the async registry hasn't loaded (or failed) yet —
  // render a notice and block editing instead of a silent, no-op blank form.
  const registryUnavailable =
    layer.type != null && !Array.isArray(config?.tabs);

  // A layer type's own settings, then whatever its attachments add.
  if (Array.isArray(config?.tabs)) {
    const attachmentTabs = attachmentTabsFor(
      layerAttachmentConfiguration,
      layerTypeConfiguration,
      layer.type,
    );
    if (attachmentTabs.length > 0)
      config = { ...config, tabs: [...config.tabs, ...attachmentTabs] };
  }

  config = inject(config);

  const handleClose = (skipSetConfiguration) => {
    // config (from the async layer-type registry) may be {} — no fields were
    // rendered, so skip the repopulation pass (which would throw on config.tabs).
    if (skipSetConfiguration !== true && Array.isArray(config?.tabs)) {
      const nextConfiguration = JSON.parse(JSON.stringify(configuration));
      traverseLayers(nextConfiguration.layers, (l, path, index) => {
        if (layer.uuid === l.uuid) {
          // We're repopulating all the layers values to trim it exactly to its spec
          // (otherwise defaults may be missing and switching layer types would mix parameters)
          let completedLayer = {
            uuid: l.uuid,
            sublayers: l.sublayers || [],
          };

          // Settings that belong to an attachment this layer type doesn't
          // show are still the attachment's, not junk: keep them rather than
          // trimming them away because no tab rendered them.
          attachmentConfigPaths(layerAttachmentConfiguration).forEach(
            (configPath) => {
              const existing = getIn(l, configPath.split("."), null);
              if (existing != null)
                setIn(completedLayer, configPath.split("."), existing, true);
            },
          );
          config.tabs.forEach((t) => {
            t.rows.forEach((r) => {
              r.components.forEach((c) => {
                const fields = c.fields || (c.field != null ? [c.field] : []);
                fields.forEach((field) => {
                  const currentValue = getIn(l, field.split("."), null);
                  if (currentValue != null)
                    setIn(completedLayer, field.split("."), currentValue, true);
                });

                if (c.field == null) return;
                if (c.type === "interactions") {
                  if (getIn(l, "kind", null) == null)
                    setIn(completedLayer, ["kind"], "none", true);
                } else if (
                  c.type === "dropdown" ||
                  c.type === "colordropdown"
                ) {
                  const currentValue = getIn(l, c.field);
                  if (currentValue == null) {
                    setIn(
                      completedLayer,
                      c.field.split("."),
                      c.options[0],
                      true,
                    );
                  }
                } else if (c.type === "checkbox" || c.type === "switch") {
                  const currentValue = getIn(l, c.field);
                  if (currentValue == null && c.defaultChecked != null) {
                    setIn(
                      completedLayer,
                      c.field.split("."),
                      c.defaultChecked,
                      true,
                    );
                  }
                } else if (c.type === "slider") {
                  const currentValue = getIn(l, c.field);
                  if (currentValue == null && c.default != null) {
                    setIn(
                      completedLayer,
                      c.field.split("."),
                      c.default || c.min || 0,
                      true,
                    );
                  }
                } else if (c.type === "colorpicker") {
                  const currentValue = getIn(l, c.field);
                  if (currentValue == null) {
                    setIn(
                      completedLayer,
                      c.field.split("."),
                      c.default || "#FFFFFF",
                      true,
                    );
                  }
                }
              });
            });
          });

          // Filter empty strings from any indexed text array fields
          const filterEmptyStrings = (obj) => {
            Object.keys(obj).forEach((key) => {
              if (key === "interactions") return;
              const val = obj[key];
              if (Array.isArray(val)) {
                obj[key] = val.filter((v) => v != null && v !== "");
                if (obj[key].length === 0) delete obj[key];
              } else if (val != null && typeof val === "object") {
                filterEmptyStrings(val);
              }
            });
          };
          filterEmptyStrings(completedLayer);

          // Clear and copy while maintaining reference
          Object.keys(l).forEach((key) => {
            delete l[key];
          });
          // Setting these here just so that the show up first in the object
          l.name = completedLayer.name;
          l.uuid = completedLayer.uuid;
          Object.keys(completedLayer).forEach((key) => {
            l[key] = completedLayer[key];
          });
        }
      });
      dispatch(setConfiguration(nextConfiguration));
    }
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
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
            <LayersIcon className={c.backgroundIcon} />
            <div className={c.title}>{layer.name}</div>
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
        {registryUnavailable ? (
          <div className={c.unavailable}>
            {`Layer type configurations aren't available yet, so this layer can't be edited. Wait for them to load or reload the page; if this persists the layer type registry failed to load.`}
          </div>
        ) : (
          <Maker config={config} layer={layer} inlineHelp={true} />
        )}
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <div>
          <Button
            className={c.removeButton}
            variant="outlined"
            startIcon={<DeleteForeverIcon size="small" />}
            onClick={() => {
              const nextConfiguration = JSON.parse(
                JSON.stringify(configuration),
              );
              traverseLayers(nextConfiguration.layers, (l, path, index) => {
                if (layer.uuid === l.uuid) {
                  return "remove";
                }
              });
              dispatch(setConfiguration(nextConfiguration));
              dispatch(
                setSnackBarText({
                  text: `Removed '${layer.name}'.`,
                  severity: "success",
                }),
              );
              handleClose(true);
            }}
          >
            Remove Layer
          </Button>
        </div>
        <div className={c.uuid}>{`Layer UUID: ${layer.uuid}${
          typeof layer.uuid === "number"
            ? " (Will be formally assigned upon saving)"
            : ""
        }`}</div>
        <div className={c.actionsRight}>
          <Tooltip title="Clone Layer" placement="top" arrow>
            <IconButton
              className={c.cloneButton}
              onClick={() => {
                const nextConfiguration = JSON.parse(
                  JSON.stringify(configuration),
                );
                const clonedLayer = JSON.parse(JSON.stringify(layer));
                window.newUUIDCount++;
                const uuid = window.newUUIDCount;
                clonedLayer.uuid = uuid;
                if (clonedLayer.type === "header") clonedLayer.sublayers = [];
                insertLayerAfterUUID(
                  nextConfiguration.layers,
                  clonedLayer,
                  layer.uuid,
                );
                dispatch(setConfiguration(nextConfiguration));
                dispatch(
                  setSnackBarText({
                    text: `Cloned '${layer.name}'.`,
                    severity: "success",
                  }),
                );
              }}
            >
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>

          <Divider className={c.divider} orientation="vertical" flexItem />

          <Button
            className={c.doneButton}
            disabled={registryUnavailable}
            onClick={() => {
              handleClose();
            }}
          >
            Done
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default LayerModal;
