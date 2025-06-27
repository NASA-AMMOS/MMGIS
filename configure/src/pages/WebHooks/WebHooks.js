import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { getIn } from "../../core/utils";
import Maker from "../../core/Maker";
import { setSnackBarText, setConfiguration } from "../../core/ConfigureStore";

import Button from "@mui/material/Button";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import SaveIcon from "@mui/icons-material/Save";
import PhishingIcon from "@mui/icons-material/Phishing";

const config = {
  rows: [
    {
      description:
        "Trigger HTTP requests whenever certain actions are executed in MMGIS.",
      components: [
        {
          field: "temp.webhooks",
          name: "Webhooks",
          description:
            "Configure HTTP requests whenever certain actions are executed in MMGIS.",
          type: "objectarray",
          width: 12,
          object: [
            {
              field: "action",
              name: "Action",
              description:
                "Which action upon which to trigger the webhook request.",
              type: "dropdown",
              width: 2,
              options: ["DrawFileAdd", "DrawFileChange", "DrawFileDelete"],
            },
            {
              field: "type",
              name: "HTTP Method",
              description: "The HTTP method for which to send the request.",
              type: "dropdown",
              width: 2,
              options: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            },
            {
              field: "url",
              name: "URL",
              description:
                "The URL for which to send the request. Valid injectable variables for URL: {created_on}, {efolders}, {file_description}, {file_id}, {file_name}, {file_owner}, {file_owner_group}, {folders}, {geojson}, {hidden}, {intent}, {is_master}, {public}, {public_editors}, {publicity_type}, {raw_file_description}, {tags}, {template}, {updated_on}.",
              type: "text",
              width: 8,
            },
            {
              field: "header",
              name: "Header JSON",
              description:
                'A JSON object of request headers to use with NodeJS fetch. For example: {"Content-Type": "application/json"}',
              type: "json",
              width: 12,
              height: "100px",
            },
            {
              field: "body",
              name: "Body JSON",
              description:
                "A JSON object to be the body of the request. MMGIS will auto-replace the following strings contained anywhere in the body before sending it to the URL. Valid injectable variables for Body fields: {created_on}, {efolders}, {file_description}, {file_id}, {file_name}, {file_owner}, {file_owner_group}, {folders}, {geojson}, {hidden}, {intent}, {is_master}, {public}, {public_editors}, {publicity_type}, {raw_file_description}, {tags}, {template}, {updated_on}",
              type: "json",
              width: 12,
              height: "180px",
            },
          ],
        },
      ],
    },
  ],
};

const useStyles = makeStyles((theme) => ({
  WebHooks: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    padding: "0px",
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
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
  content: {
    width: "100%",
    overflowY: "auto",
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

export default function WebHooks() {
  const c = useStyles();

  const configuration = useSelector((state) => state.core.configuration);

  const dispatch = useDispatch();

  const saveWebHooks = () => {
    let webhooks = getIn(configuration, "temp.webhooks", null);

    if (webhooks != null) {
      webhooks = JSON.parse(JSON.stringify(webhooks));

      calls.api(
        "webhooks_save",
        {
          config: JSON.stringify({ webhooks }),
        },
        (res) => {
          if (res.status === "success") {
            dispatch(
              setSnackBarText({
                text: "Successfully saved webhooks.",
                severity: "success",
              })
            );
          } else
            dispatch(
              setSnackBarText({
                text: res?.message || "Failed to save webhooks.",
                severity: "error",
              })
            );
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to save webhooks.",
              severity: "error",
            })
          );
        }
      );
    }
  };
  const queryWebHooks = () => {
    calls.api(
      "webhooks_entries",
      {},
      (res) => {
        if (res.status === "success") {
          if (res.body && res.body.entries && res.body.entries.length > 0) {
            const config = JSON.parse(res.body.entries[0].config);
            dispatch(
              setConfiguration({
                temp: {
                  webhooks: config.webhooks,
                },
              })
            );
          }
        } else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get webhooks.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get webhooks.",
            severity: "error",
          })
        );
      }
    );
  };
  useEffect(() => {
    queryWebHooks();
  }, []);

  return (
    <div className={c.WebHooks}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <PhishingIcon />
          <Typography
            style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
            variant="h6"
            component="div"
          >
            Webhooks
          </Typography>
        </div>
      </Toolbar>
      <div className={c.content}>
        <Maker config={config} inlineHelp={true} />
      </div>
      <div className={c.gap}></div>
      <Button
        className={c.save}
        variant="contained"
        startIcon={<PhishingIcon />}
        endIcon={<SaveIcon />}
        onClick={() => {
          saveWebHooks();
        }}
      >
        Save Webhooks
      </Button>
    </div>
  );
}
