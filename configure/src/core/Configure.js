import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { makeStyles } from "@mui/styles";

import Main from "../components/Main/Main";
import Panel from "../components/Panel/Panel";

import { calls } from "../core/calls";
import {
  setMissions,
  setMission,
  setPage,
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
    width: "260px",
  },
  right: {
    height: "100%",
    width: "calc(100% - 260px)",
    position: "relative",
  },
}));

// Keeps ?mission= or ?page= in the URL so reloading or sharing returns to the same place
function useUrlState(dispatch) {
  const mission = useSelector((state) => state.core.mission);
  const page = useSelector((state) => state.core.page);
  const missions = useSelector((state) => state.core.missions);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !missions || missions.length === 0) return;
    restored.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("page")) dispatch(setPage({ page: q.get("page") }));
    else if (q.get("mission") && missions.includes(q.get("mission")))
      dispatch(setMission(q.get("mission")));
  }, [missions, dispatch]);
  useEffect(() => {
    if (!restored.current) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("mission");
    q.delete("page");
    if (page) q.set("page", page);
    else if (mission) q.set("mission", mission);
    const search = q.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }, [mission, page]);
}

export default function Configure() {
  const c = useStyles();
  const dispatch = useDispatch();
  useUrlState(dispatch);
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
