import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import Maker from "../../core/Maker";
import { setSnackBarText } from "../../core/ConfigureStore";

const config = {
  rows: [
    {
      name: "WebHooks",
      description:
        "Configures the available functionalities of the Map's and Globe's right-click context menu.",
      components: [
        {
          field: "webhooks",
          name: "Context Menu Actions",
          description:
            "When right-clicking on the Map or Globe, a custom context-menu appears. By default it only offers 'Copy Coordinates'. By adding objects to the rightClickMenuActions array, entries can be added to the context-menu to send users to links with parameters populated with the current coordinates.",
          type: "objectarray",
          width: 12,
          object: [
            {
              field: "action",
              name: "Action",
              description:
                "Optionally restrict some right-click menu actions to only be supported when clicking on a polygon.",
              type: "dropdown",
              width: 2,
              options: ["DrawFileAdd", "DrawFileChange", "DrawFileDelete"],
            },
            {
              field: "type",
              name: "HTTP Method",
              description:
                "Optionally restrict some right-click menu actions to only be supported when clicking on a polygon.",
              type: "dropdown",
              width: 2,
              options: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            },
            {
              field: "url",
              name: "URL",
              description:
                "The text for this menu entry when users right-click.",
              type: "text",
              width: 2,
            },
            {
              field: "header",
              name: "Header JSON",
              description:
                "Vector Tiles are styled differently than Vectors. Raw variables here takes an object that maps internal vector tile layer names to styles. All raw variables are optional.",
              type: "json",
              width: 12,
            },
            {
              field: "body",
              name: "Body JSON",
              description:
                "Vector Tiles are styled differently than Vectors. Raw variables here takes an object that maps internal vector tile layer names to styles. All raw variables are optional.",
              type: "json",
              width: 12,
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
    overflowY: "auto",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
    padding: "0px 32px 64px 32px",
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
}));

export default function WebHooks() {
  const c = useStyles();

  const dispatch = useDispatch();

  return (
    <div className={c.WebHooks}>
      <Maker config={config} inlineHelp={true} />
    </div>
  );
}
