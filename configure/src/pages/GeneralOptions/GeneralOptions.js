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
