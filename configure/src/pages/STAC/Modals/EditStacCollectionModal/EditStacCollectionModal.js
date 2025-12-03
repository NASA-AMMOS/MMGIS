import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";
import { getIn, setIn } from "../../../../core/utils";
import Maker from "../../../../core/Maker";
import { config } from "./editStacCollectionConfig";

import {
  setModal,
  setSnackBarText,
  setConfiguration,
  setStacCollections,
} from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import EditIcon from "@mui/icons-material/Edit";
import WarningIcon from "@mui/icons-material/Warning";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

// CodeMirror for JSON editing
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

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
    maxWidth: "900px !important",
    maxHeight: "calc(100vh - 64px) !important",
    width: "900px",
    [theme.breakpoints.down("sm")]: {
      width: "calc(100vw - 64px)",
      maxWidth: "calc(100vw - 64px) !important",
    },
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
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
  tabContent: {
    paddingTop: "16px",
  },
  jsonEditor: {
    border: `1px solid ${theme.palette.swatches.grey[600]}`,
    borderRadius: "4px",
  },
  warningBox: {
    marginBottom: "16px",
  },
}));

const MODAL_NAME = "editStacCollection";

const EditStacCollectionModal = (props) => {
  const { querySTAC } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const stacCollections = useSelector((state) => state.core.stacCollections);
  const configuration = useSelector((state) => state.core.configuration);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const [currentTab, setCurrentTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track if we've initialized the form data
  const hasInitialized = useRef(false);

  // Get the collection being edited
  const collection = modal?.collection || null;
  const originalCollectionId = collection?.id;

  // Calculate occurrences count
  const occurrencesCount =
    collection?.occurrences
      ? Object.values(collection.occurrences).reduce(
          (sum, arr) => sum + arr.length,
          0
        )
      : 0;
  const missionsCount = collection?.occurrences
    ? Object.keys(collection.occurrences).length
    : 0;

  // Initialize form data when modal opens
  useEffect(() => {
    if (modal && collection && !hasInitialized.current) {
      hasInitialized.current = true;

      // Set form data in Redux temp storage
      const tempData = {
        id: collection.id,
        title: collection.title || "",
        description: collection.description || "",
        license: collection.license || "",
        keywords: collection.keywords || [],
        extent: {
          spatial: {
            bbox:
              typeof collection.extent?.spatial?.bbox === "string"
                ? collection.extent.spatial.bbox
                : JSON.stringify(collection.extent?.spatial?.bbox || [[-180, -90, 180, 90]]),
          },
          temporal: {
            interval:
              typeof collection.extent?.temporal?.interval === "string"
                ? collection.extent.temporal.interval
                : JSON.stringify(
                    collection.extent?.temporal?.interval || [["1970-01-01T00:00:00Z", null]]
                  ),
          },
        },
        links: collection.links || [],
        providers: collection.providers || [],
        summaries: collection.summaries || {},
      };

      const newConfig = {
        ...configuration,
        temp: {
          ...configuration.temp,
          editStacCollection: tempData
        }
      };
      dispatch(setConfiguration(newConfig));

      setHasUnsavedChanges(false);
    }
  }, [modal, collection, dispatch]);

  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!modal) {
      hasInitialized.current = false;
    }
  }, [modal]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to close?"
        )
      ) {
        return;
      }
    }
    dispatch(setModal({ name: MODAL_NAME, on: false }));
    setCurrentTab(0);
    setHasUnsavedChanges(false);
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const validateFields = (data) => {
    const errors = [];

    if (!data.id || data.id.trim() === "") {
      errors.push("Collection ID is required");
    }

    if (!data.description || data.description.trim() === "") {
      errors.push("Description is required");
    }

    if (!data.license || data.license.trim() === "") {
      errors.push("License is required");
    }

    // Validate bbox format
    try {
      const bbox =
        typeof data.extent?.spatial?.bbox === "string"
          ? JSON.parse(data.extent.spatial.bbox)
          : data.extent?.spatial?.bbox;
      if (!Array.isArray(bbox) || bbox.length === 0) {
        errors.push("Spatial extent bbox must be a valid array");
      }
    } catch (e) {
      errors.push("Invalid spatial extent bbox format");
    }

    // Validate temporal interval format
    try {
      const interval =
        typeof data.extent?.temporal?.interval === "string"
          ? JSON.parse(data.extent.temporal.interval)
          : data.extent?.temporal?.interval;
      if (!Array.isArray(interval) || interval.length === 0) {
        errors.push("Temporal extent interval must be a valid array");
      }
    } catch (e) {
      errors.push("Invalid temporal extent interval format");
    }

    return errors;
  };

  const handleSave = () => {
    setIsSaving(true);

    // Get form data from Redux
    const formData = getIn(configuration, "temp.editStacCollection", {});

    // Build the collection data from form fields
    const collectionData = {
      id: formData.id,
      title: formData.title,
      description: formData.description,
      license: formData.license,
      keywords: formData.keywords,
      links: formData.links,
      providers: formData.providers,
      summaries: formData.summaries,
      type: "Collection",
      stac_version: "1.0.0",
    };

    // Handle extent parsing
    try {
      collectionData.extent = {
        spatial: {
          bbox:
            typeof formData.extent?.spatial?.bbox === "string"
              ? JSON.parse(formData.extent.spatial.bbox)
              : formData.extent?.spatial?.bbox || [[-180, -90, 180, 90]],
        },
        temporal: {
          interval:
            typeof formData.extent?.temporal?.interval === "string"
              ? JSON.parse(formData.extent.temporal.interval)
              : formData.extent?.temporal?.interval || [["1970-01-01T00:00:00Z", null]],
        },
      };
    } catch (e) {
      dispatch(
        setSnackBarText({
          text: "Invalid extent format",
          severity: "error",
        })
      );
      setIsSaving(false);
      return;
    }

    // Validate
    const validationErrors = validateFields(collectionData);
    if (validationErrors.length > 0) {
      dispatch(
        setSnackBarText({
          text: validationErrors.join(", "),
          severity: "error",
        })
      );
      setIsSaving(false);
      return;
    }

    // API call to update collection
    const apiPayload = {
      urlReplacements: { collection: originalCollectionId },
      ...collectionData
    };

    calls.api(
      "stac_update_collection",
      apiPayload,
      (res) => {
        if (res?.status === "success") {
          // Update Redux state
          const updatedCollections = stacCollections.map((col) =>
            col.id === originalCollectionId ? res.body : col
          );
          dispatch(setStacCollections(updatedCollections));

          dispatch(
            setSnackBarText({
              text: `Successfully updated collection: ${res.body.id}`,
              severity: "success",
            })
          );

          setIsSaving(false);
          setHasUnsavedChanges(false);
          handleClose();

          // Refresh from server to ensure consistency
          querySTAC();
        }
      },
      (err) => {
        dispatch(
          setSnackBarText({
            text: err?.message || "Failed to update collection",
            severity: "error",
          })
        );
        setIsSaving(false);
      }
    );
  };

  // Get current form data for JSON display
  const formData = getIn(configuration, "temp.editStacCollection", {});

  // Build current JSON from form data
  const currentJson = {
    ...collection,
    id: formData.id,
    title: formData.title,
    description: formData.description,
    license: formData.license,
    keywords: formData.keywords,
    links: formData.links,
    providers: formData.providers,
    summaries: formData.summaries,
    extent: {
      spatial: {
        bbox:
          typeof formData.extent?.spatial?.bbox === "string"
            ? JSON.parse(formData.extent.spatial.bbox)
            : formData.extent?.spatial?.bbox || [[-180, -90, 180, 90]],
      },
      temporal: {
        interval:
          typeof formData.extent?.temporal?.interval === "string"
            ? JSON.parse(formData.extent.temporal.interval)
            : formData.extent?.temporal?.interval || [["1970-01-01T00:00:00Z", null]],
      },
    },
  };

  if (!modal || !collection) {
    return null;
  }

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="edit-collection-dialog"
      PaperProps={{
        className: c.contents,
      }}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <EditIcon className={c.backgroundIcon} />
            <div className={c.title}>Edit STAC Collection</div>
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
          Edit collection metadata. For more, see the STAC Collection Spec:
          https://github.com/radiantearth/stac-spec/blob/master/collection-spec/collection-spec.md
        </Typography>

        {occurrencesCount > 0 && (
          <Alert severity="warning" icon={<WarningIcon />} className={c.warningBox}>
            This collection is used by {occurrencesCount} layer(s) in {missionsCount} mission(s).
            Metadata changes will not break existing layers.
          </Alert>
        )}

        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Form" />
          <Tab label="Current JSON" />
        </Tabs>

        <div className={c.tabContent}>
          {currentTab === 0 && (
            <Box>
              <Maker
                config={config}
                inlineHelp={true}
                onChange={() => setHasUnsavedChanges(true)}
              />
            </Box>
          )}
          {currentTab === 1 && (
            <Box>
              <Typography className={c.subtitle} style={{ marginBottom: "8px" }}>
                This shows the current state of your form data as JSON. This is read-only - edit using the Form tab.
              </Typography>
              <div className={c.jsonEditor}>
                <CodeMirror
                  value={JSON.stringify(currentJson, null, 2)}
                  height="400px"
                  extensions={[json()]}
                  editable={false}
                  readOnly={true}
                />
              </div>
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={20} /> : null}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditStacCollectionModal;
