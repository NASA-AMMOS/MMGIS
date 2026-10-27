import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { makeStyles } from "@mui/styles";

import Main from "../components/Main/Main";
import Panel from "../components/Panel/Panel";

import { calls } from "../core/calls";
import {
  setMissions,
  setLayerTypeConfiguration,
  setLayerAttachmentConfiguration,
  setInteractionConfiguration,
  setSnackBarText,
} from "./ConfigureStore";
import Websocket from "./Websocket";
import { getInjectables } from "./injectables";

const useStyles = makeStyles((theme) => ({
  Configure: {
    width: "100%",
    height: "100%",
    display: "flex",
  },
  left: {
    height: "100%",
    width: "220px",
  },
  right: {
    height: "100%",
    width: "calc(100% - 220px)",
    position: "relative",
  },
}));

export default function Configure() {
  const c = useStyles();
  const dispatch = useDispatch();
  useEffect(() => {
    calls.api(
      "missions",
      null,
      (res) => {
        const missions = (res?.missions || [])
          .slice()
          .sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" }),
          );
        dispatch(setMissions(missions));
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get available missions.",
            severity: "error",
          }),
        );
      },
    );

    calls.api(
      "getLayerTypeConfig",
      null,
      (res) => {
        dispatch(setLayerTypeConfiguration(res || {}));
      },
      (res) => {
        dispatch(setLayerTypeConfiguration({}));
        dispatch(
          setSnackBarText({
            text:
              res?.message ||
              "Failed to load layer type configurations. Layer editing will be unavailable.",
            severity: "error",
          }),
        );
      },
    );

    // Attachments are configured on their host layer, so their settings UI
    // comes from the attachment plugins rather than from each layer type.
    calls.api(
      "getLayerAttachmentConfig",
      null,
      (res) => {
        dispatch(setLayerAttachmentConfiguration(res || {}));
      },
      () => {
        dispatch(setLayerAttachmentConfiguration({}));
      },
    );

    // An interaction's settings are configured on the layers that run it, so
    // the layer modal needs to know which config paths interactions own.
    calls.api(
      "getInteractionConfig",
      null,
      (res) => {
        dispatch(setInteractionConfiguration(res || {}));
      },
      () => {
        dispatch(setInteractionConfiguration({}));
      },
    );

    getInjectables();
  }, [dispatch]);

  return (
    <div className={c.Configure}>
      <div className={c.left}>
        <Panel />
      </div>
      <div className={c.right}>
        <Main />
      </div>
      <Websocket />
    </div>
  );
}
