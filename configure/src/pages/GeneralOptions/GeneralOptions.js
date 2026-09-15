import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { getIn } from "../../core/utils";
import Maker from "../../core/Maker";
import { setSnackBarText, setConfiguration } from "../../core/ConfigureStore";

import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import SaveIcon from "@mui/icons-material/Save";
import PhishingIcon from "@mui/icons-material/Phishing";
import SettingsIcon from "@mui/icons-material/Settings";

const config = {
  rows: [
    {
      name: "Landing Page",
      components: [
        {
          field: "temp.generalOptions.landingPage.theme",
          name: "Theme",
          description: "Color theme of the mission landing page.",
          type: "dropdown",
          options: ["light", "dark"],
          default: "light",
          width: 3,
        },
        {
          field: "temp.generalOptions.landingPage.heading",
          name: "Heading",
          description:
            "Main landing page heading. Wrap words in asterisks to highlight them in the accent color, e.g. 'Mapping *Any World*'. Leave blank for the default.",
          type: "text",
          width: 4,
        },
        {
          field: "temp.generalOptions.landingPage.subheading",
          name: "Subheading",
          description:
            "Text shown under the heading. Leave blank for the default ('Select a mission to start exploring geospatial data').",
          type: "text",
          width: 5,
        },
        {
          field: "temp.generalOptions.landingPage.backgroundImageUrl",
          name: "Background Image URL",
          description:
            "Optional full-screen background image for the landing page. Supports absolute URLs and public assets (e.g., 'public/images/mars.jpg'). Leave blank for the default contour background.",
          type: "text",
          width: 6,
        },
        {
          field: "temp.generalOptions.landingPage.hideArchived",
          name: "Hide Archived Missions",
          description:
            "When enabled, missions marked as Archived (Home tab) are omitted from the landing page instead of being listed under 'Archived Missions'.",
          type: "checkbox",
          width: 3,
        },
        {
          field: "temp.generalOptions.landingPage.creditText",
          name: "Footer Credit Text",
          description:
            "Credit link text shown in the landing page footer. Defaults to 'NASA-AMMOS'.",
          type: "text",
          width: 3,
        },
        {
          field: "temp.generalOptions.landingPage.creditUrl",
          name: "Footer Credit URL",
          description:
            "Where the footer credit links to. Defaults to 'https://github.com/NASA-AMMOS/MMGIS'.",
          type: "text",
          width: 4,
        },
        {
          field: "temp.generalOptions.landingPage.hideSearch",
          name: "Hide Search & Grouping",
          description:
            "When enabled, the mission search box and the A–Z / Planet grouping toggle are not shown on the landing page.",
          type: "checkbox",
          width: 3,
        },
      ],
    },
    {
      name: "STAC/TiTiler",
      subname: "COG Mosaicking",
      components: [
        {
          field: "temp.generalOptions.stac.mosaicItemLimit",
          name: "Item Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Item Limit' denotes the max number of items/COGs to allow an individual tile to be composed of. Depending on your STAC Collection, higher numbers are more complete but possibly less performant. Defaults to 100.",
          type: "number",
          min: 0,
          step: 1,
          default: 100,
          width: 3,
        },
        {
          field: "temp.generalOptions.stac.mosaicScanLimit",
          name: "Scan Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Scan Limit' denotes the max number of items/COGs to search through and consider when composing any given individual tile. Depending on your STAC Collection, higher numbers are more complete but possibly less performant. Defaults to 10000.",
          type: "number",
          min: 0,
          step: 1,
          default: 10000,
          width: 3,
        },
        {
          field: "temp.generalOptions.stac.mosaicTimeLimit",
          name: "Time Limit",
          description:
            "TiTiler with STAC can return a tile made on-the-fly composed of a number COGs mosaicked together. 'Time Limit' denotes the max number of seconds before a request for a tile is forced to return. If the 'Time Limit' is too short, returned mosaicked tiles may be incomplete. Defaults to 5 seconds.",
          type: "number",
          min: 1,
          step: 1,
          default: 5,
          width: 3,
        },
      ],
    },
  ],
};

const useStyles = makeStyles((theme) => ({
  GeneralOptions: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  GeneralOptionsInner: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    display: "flex",
    padding: "0px 32px 64px 32px",
    flexFlow: "column",
    boxSizing: "border-box",
  },
  topbar: {
    width: "calc(100% - 100px)",
    height: "44px",
    minHeight: "44px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: `0px 20px`,
    boxSizing: `border-box !important`,
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": {
      color: theme.palette.swatches.grey[150],
      margin: "3px 10px 0px 2px",
    },
  },
  gap: {
    height: "64px",
    width: "100%",
  },
  save: {
    margin: "8px !important",
    height: "32px",
    borderRadius: "3px !important",
    background: `${theme.palette.swatches.p[11]} !important`,
    color: "white !important",
    position: "absolute !important",
    bottom: "0px",
    right: "5px",
  },
}));

export default function GeneralOptions() {
  const c = useStyles();

  const configuration = useSelector((state) => state.core.configuration);

  const dispatch = useDispatch();

  const saveGeneralOptions = () => {
    let generalOptions = getIn(configuration, "temp.generalOptions", null);

    if (generalOptions != null) {
      generalOptions = JSON.parse(JSON.stringify(generalOptions));

      calls.api(
        "update_generaloptions",
        {
          options: generalOptions,
        },
        (res) => {
          if (res.status === "success") {
            dispatch(
              setSnackBarText({
                text: "Successfully saved the General Options.",
                severity: "success",
              })
            );
          } else
            dispatch(
              setSnackBarText({
                text: res?.message || "Failed to save the General Options.",
                severity: "error",
              })
            );
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to save the General Options.",
              severity: "error",
            })
          );
        }
      );
    }
  };
  const queryGeneralOptions = () => {
    calls.api(
      "get_generaloptions",
      {},
      (res) => {
        if (res.status === "success") {
          if (res.options) {
            dispatch(
              setConfiguration({
                temp: {
                  generalOptions: res.options,
                },
              })
            );
          }
        } else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get the General Options.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get the General Options.",
            severity: "error",
          })
        );
      }
    );
  };
  useEffect(() => {
    queryGeneralOptions();
  }, []);

  console.log("render", getIn(configuration, "temp.generalOptions", null));
  return (
    <div className={c.GeneralOptions}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <SettingsIcon />
          <Typography
            sx={{ flex: "1 1 100%" }}
            style={{
              fontWeight: "bold",
              fontSize: "16px",
              lineHeight: "29px",
            }}
            variant="h6"
            component="div"
          >
            General Options
          </Typography>
        </div>
      </Toolbar>
      <div className={c.GeneralOptionsInner}>
        <Maker config={config} inlineHelp={true} />
        <div className={c.gap}></div>
        <Button
          className={c.save}
          variant="contained"
          startIcon={<PhishingIcon />}
          endIcon={<SaveIcon />}
          onClick={() => {
            saveGeneralOptions();
          }}
        >
          Save General Options
        </Button>
      </div>
    </div>
  );
}
