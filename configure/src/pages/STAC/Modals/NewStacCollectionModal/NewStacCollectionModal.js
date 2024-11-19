import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";
import { getIn } from "../../../../core/utils";
import Maker from "../../../../core/Maker";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import HorizontalSplitIcon from "@mui/icons-material/HorizontalSplit";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { useDropzone } from "react-dropzone";

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
    maxWidth: "unset !important",
    maxHeight: "calc(100vh - 64px) !important",
    width: "calc(100vw - 64px)",
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

  fileName: {
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: "1px",
    marginBottom: "10px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[500]}`,
    paddingBottom: "10px",
  },
  dropzone: {
    width: "100%",
    minHeight: "100px",
    margin: "16px 0px",
    "& > div": {
      flex: "1 1 0%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px",
      borderWidth: "2px",
      borderRadius: "2px",
      borderColor: theme.palette.swatches.grey[300],
      borderStyle: "dashed",
      backgroundColor: theme.palette.swatches.grey[900],
      color: theme.palette.swatches.grey[200],
      outline: "none",
      transition: "border 0.24s ease-in-out 0s",
      "&:hover": {
        borderColor: theme.palette.swatches.p[11],
      },
    },
  },
  dropzoneMessage: {
    textAlign: "center",
    color: theme.palette.swatches.p[11],
    "& > p:first-child": { fontWeight: "bold", letterSpacing: "1px" },
    "& > p:last-child": { fontSize: "14px", fontStyle: "italic" },
  },
  timeFields: {
    display: "flex",
    "& > div:first-child": {
      marginRight: "5px",
    },
    "& > div:last-child": {
      marginLeft: "5px",
    },
  },
}));

const config = {
  rows: [
    {
      name: "Required",
      components: [
        {
          field: "temp.newStacCollection.id",
          name: "Collection ID",
          description:
            "Identifier for the Collection that is unique across all collections in the root catalog.",
          type: "text",
          width: 12,
        },
      ],
    },
    {
      name: "Optional",
      components: [
        {
          field: "temp.newStacCollection.description",
          name: "Description",
          description:
            "Detailed multi-line description to fully explain the Collection. Defaults to: 'A STAC Collection'",
          type: "text",
          width: 12,
        },
        {
          field: "temp.newStacCollection.links",
          name: "Links",
          description: "A list of references to other documents.",
          type: "objectarray",
          width: 12,
          object: [
            {
              field: "title",
              name: "Title",
              description:
                "A human readable title to be used in rendered displays of the link.",
              type: "text",
              width: 8,
            },
            {
              field: "href",
              name: "HREF",
              description:
                "The actual link in the format of an URL. Relative and absolute links are both allowed. Trailing slashes are significant.",
              type: "text",
              width: 8,
            },
            {
              field: "rel",
              name: "Relations",
              description:
                "STAC Entities use a variety of rel types in the Link Object, to describe the exact nature of the link between the STAC object and the entity it is linking to. It is recommended to use the official IANA Link Relation Types (https://www.iana.org/assignments/link-relations/link-relations.xhtml) where possible.",
              type: "dropdown",
              width: 4,
              options: [
                "UNSET",
                "self",
                "root",
                "parent",
                "child",
                "collection",
                "item",
                "about",
                "acl",
                "alternate",
                "amphtml",
                "appendix",
                "apple-touch-icon",
                "apple-touch-startup-image",
                "archives",
                "author",
                "blocked-by",
                "bookmark",
                "c2pa-manifest",
                "canonical",
                "chapter",
                "cite-as",
                "collection",
                "compression-dictionary",
                "contents",
                "convertedfrom",
                "copyright",
                "create-form",
                "current",
                "deprecation",
                "describedby",
                "describes",
                "disclosure",
                "dns-prefetch",
                "duplicate",
                "edit",
                "edit-form",
                "edit-media",
                "enclosure",
                "external",
                "first",
                "glossary",
                "help",
                "hosts",
                "hub",
                "ice-server",
                "icon",
                "index",
                "intervalafter",
                "intervalbefore",
                "intervalcontains",
                "intervaldisjoint",
                "intervalduring",
                "intervalequals",
                "intervalfinishedby",
                "intervalfinishes",
                "intervalin",
                "intervalmeets",
                "intervalmetby",
                "intervaloverlappedby",
                "intervaloverlaps",
                "intervalstartedby",
                "intervalstarts",
                "item",
                "last",
                "latest-version",
                "license",
                "linkset",
                "lrdd",
                "manifest",
                "mask-icon",
                "me",
                "media-feed",
                "memento",
                "micropub",
                "modulepreload",
                "monitor",
                "monitor-group",
                "next",
                "next-archive",
                "nofollow",
                "noopener",
                "noreferrer",
                "opener",
                "openid2.local_id",
                "openid2.provider",
                "original",
                "p3pv1",
                "payment",
                "pingback",
                "preconnect",
                "predecessor-version",
                "prefetch",
                "preload",
                "prerender",
                "prev",
                "preview",
                "previous",
                "prev-archive",
                "privacy-policy",
                "profile",
                "publication",
                "related",
                "restconf",
                "replies",
                "ruleinput",
                "search",
                "section",
                "service",
                "service-desc",
                "service-doc",
                "service-meta",
                "sip-trunking-capability",
                "sponsored",
                "start",
                "status",
                "stylesheet",
                "subsection",
                "successor-version",
                "sunset",
                "tag",
                "terms-of-service",
                "timegate",
                "timemap",
                "type",
                "ugc",
                "up",
                "version-history",
                "via",
                "webmention",
                "working-copy",
                "working-copy-of",
              ],
            },
            {
              field: "type",
              name: "Media/MIME Type",
              description:
                "Media type of the referenced entity. For instance 'image/tiff; application=geotiff'. Use 'application/geo+json' for a STAC Item and 'application/json' for STAC Collections and Catalogs.",
              type: "dropdown",
              options: [
                "UNSET",
                "application/json",
                "image/tiff; application=geotiff",
                "image/tiff; application=geotiff; profile=cloud-optimized",
                "image/jp2",
                "image/png",
                "image/jpeg",
                "application/geo+json",
                "application/geo+json-seq",
                "application/geopackage+sqlite3",
                "application/vnd.google-earth.kml+xml",
                "application/vnd.google-earth.kmz",
                "application/x-protobuf",
                "application/vnd.mapbox-vector-tile",
                "application/x-hdf",
                "application/x-hdf5",
                "application/xml",
                "application/ndjson",
                "text/html",
                "text/plain",
                "application/vnd.oai.openapi+json;version=3.0",
                "application/vnd.oai.openapi;version=3.0",
                "application/schema+json",
                "application/pdf",
                "text/csv",
                "application/vnd.apache.parquet",
              ],
              width: 6,
            },
          ],
        },
        {
          field: "temp.newStacCollection.extent.spatial.bbox",
          name: "Spatial Extent Bounding Box",
          description:
            "Potential spatial extents covered by the Collection. Defaults to: [[-180.0, -90.0, 180.0, 90.0]]",
          type: "text",
          width: 12,
        },
        {
          field: "temp.newStacCollection.extent.temporal.interval",
          name: "Temporal Extent Interval",
          description: `Potential temporal extents covered by the Collection. Each inner array consists of exactly two elements, either a UTC date timestamp or null. Defaults to: [["1970-01-01T00:00:00Z", null]]`,
          type: "text",
          width: 12,
        },
        {
          field: "temp.newStacCollection.license",
          name: "License",
          description:
            "License(s) of the data collection as SPDX License identifier, SPDX License expression, or other. Defaults to MIT",
          type: "text",
          width: 4,
        },
      ],
    },
    {
      components: [
        {
          field: "temp.newStacCollection.title",
          name: "Title",
          description: "A short descriptive one-line title for the Collection.",
          type: "text",
          width: 4,
        },
        {
          field: "temp.newStacCollection.keywords",
          name: "Keywords",
          description: `Comma-separated list of keywords describing the Collection.`,
          type: "textarray",
          width: 8,
        },
        {
          field: "temp.newStacCollection.providers",
          name: "Providers",
          description:
            "A list of providers, which may include all organizations capturing or processing the data or the hosting provider.",
          type: "objectarray",
          width: 12,
          object: [
            {
              field: "name",
              name: "Name",
              description:
                "Required - The name of the organization or the individual.",
              type: "text",
              width: 8,
            },
            {
              field: "description",
              name: "Description",
              description:
                "Multi-line description to add further provider information such as processing details for processors and producers, hosting details for hosts or basic contact information.",
              type: "text",
              width: 8,
            },
            {
              field: "roles",
              name: "Roles",
              description:
                "Comma-separated list of roles of the provider. Any of 'licensor', 'producer', 'processor' or 'host'",
              type: "textarray",
              width: 8,
            },
            {
              field: "url",
              name: "URL",
              description:
                "Homepage on which the provider describes the dataset and publishes contact information.",
              type: "text",
              width: 8,
            },
          ],
        },
        {
          field: "temp.newStacCollection.summaries",
          name: "Summaries",
          description:
            "A map of property summaries, either a set of values, a range of values or a JSON Schema.",
          type: "json",
          width: 12,
          height: "300px",
        },
      ],
    },
  ],
};

const MODAL_NAME = "newStacCollection";
const NewStacCollectionModal = (props) => {
  const { querySTAC } = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const stacCollections = useSelector((state) => state.core.stacCollections);

  const configuration = useSelector((state) => state.core.configuration);
  const newStacCollection = getIn(
    configuration,
    "temp.newStacCollection",
    null
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  const handleSubmit = () => {
    const nextStacCollection = JSON.parse(JSON.stringify(newStacCollection));
    nextStacCollection.type = "Collection";
    nextStacCollection.stac_version = "1.0.0";

    nextStacCollection.links = nextStacCollection.links || [];
    nextStacCollection.description =
      nextStacCollection.description || "A STAC Collection";
    nextStacCollection.license = nextStacCollection.license || "MIT";
    if (nextStacCollection == null || nextStacCollection.id == null) {
      dispatch(
        setSnackBarText({
          text: "Please fill out all Required Fields.",
          severity: "warning",
        })
      );
      return;
    }

    nextStacCollection.extent = nextStacCollection.extent || {};

    nextStacCollection.extent.spatial = nextStacCollection.extent.spatial || {};
    nextStacCollection.extent.spatial.bbox = JSON.parse(
      nextStacCollection.extent.spatial.bbox || "[[-180.0, -90.0, 180.0, 90.0]]"
    );

    nextStacCollection.extent.temporal =
      nextStacCollection.extent.temporal || {};
    nextStacCollection.extent.temporal.interval = JSON.parse(
      nextStacCollection.extent.temporal.interval ||
        '[["1970-01-01T00:00:00Z", null]]'
    );

    calls.api(
      "stac_create_collection",
      nextStacCollection || {},
      (res) => {
        if (res?.type === "Collection") {
          querySTAC();
          dispatch(
            setSnackBarText({
              text: "Successfully made a new STAC Collection!",
              severity: "success",
            })
          );
          handleClose();
        } else
          dispatch(
            setSnackBarText({
              text: "Failed to create STAC Collections. ",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to create STAC Collections.",
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
            <HorizontalSplitIcon className={c.backgroundIcon} />
            <div className={c.title}>Make a New STAC Collection</div>
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
          {
            "Create a new STAC collection. For more, see the STAC Collection Spec: https://github.com/radiantearth/stac-spec/blob/master/collection-spec/collection-spec.md"
          }
        </Typography>
        <Maker config={config} inlineHelp={true} />
      </DialogContent>
      <DialogActions>
        <Button
          className={c.addSelected}
          variant="contained"
          onClick={handleSubmit}
        >
          Create STAC Collection
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewStacCollectionModal;
