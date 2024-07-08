import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import ReportIcon from "@mui/icons-material/Report";

import { clearLockConfig, setLockConfig } from "./ConfigureStore";

const vars = {
  initialWebSocketRetryInterval: 20000, // 1 minute
  webSocketRetryInterval: 20000, // Start with this time and double if disconnected
  webSocketPingInterval: null,
};
function init(dispatch) {
  const port = parseInt(window.mmgisglobal.PORT || "8888", 10);
  const protocol =
    window.location.protocol.indexOf("https") !== -1 ? "wss" : "ws";

  const path =
    window.mmgisglobal.NODE_ENV === "development"
      ? `${protocol}://localhost:${port}${
          window.mmgisglobal.WEBSOCKET_ROOT_PATH ||
          window.mmgisglobal.ROOT_PATH ||
          ""
        }/`
      : `${protocol}://${window.location.host}${
          window.mmgisglobal.WEBSOCKET_ROOT_PATH ||
          window.mmgisglobal.ROOT_PATH ||
          ""
        }/`;

  // Create WebSocket connection.
  const socket = new WebSocket(path);

  // Connection opened
  socket.addEventListener("open", (event) => {
    vars.webSocketRetryInterval = vars.initialWebSocketRetryInterval;
    clearInterval(vars.webSocketPingInterval);
    dispatch(clearLockConfig({ type: "disconnect" }));
  });

  // Listen for messages
  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (
        data?.info?.route === "config" &&
        parseInt(data?.info?.id || -1) !== window.configId &&
        data?.info?.mission === window.mission
      ) {
        dispatch(setLockConfig({}));
      }
    } catch (err) {}
  });

  socket.addEventListener("close", (event) => {
    dispatch(setLockConfig({ type: "disconnect" }));

    clearInterval(vars.webSocketPingInterval);
    vars.webSocketPingInterval = setInterval(() => {
      init(dispatch);
    }, vars.webSocketRetryInterval);
    vars.webSocketRetryInterval *= 2;
  });
}

const useStyles = makeStyles((theme) => ({
  Websocket: {
    right: "8px",
    bottom: "48px",
    position: "absolute",
    background: theme.palette.swatches.red[500],
    height: "24px",
    color: "white",
    lineHeight: "24px",
    borderRadius: "3px",
    fontSize: "12px",
    padding: "0px 8px 0px 2px",
    boxShadow: "0px 2px 3px 0px rgba(0, 0, 0, 0.3)",
    display: "flex",
    "& > svg": {
      fontSize: "20px",
      padding: "2px 1px 1px 2px",
    },
  },
}));

export default function Websocket() {
  const c = useStyles();

  const dispatch = useDispatch();

  const lockConfig = useSelector((state) => state.core.lockConfig);
  //const lockConfigCount = useSelector((state) => state.core.lockConfigCount);
  const lockConfigTypes = useSelector((state) => state.core.lockConfigTypes);

  useEffect(() => {
    if (
      window.mmgisglobal.ENABLE_CONFIG_WEBSOCKETS === "true" ||
      window.mmgisglobal.ENABLE_CONFIG_WEBSOCKETS === true
    ) {
      init(dispatch);
    }
  }, [dispatch]);

  if (lockConfig === false) return null;
  else if (lockConfigTypes.disconnect === true) {
    return (
      <div className={c.Websocket}>
        <ReportIcon />
        {`Websocket disconnected. You will not be able to save until it reconnects.`}
      </div>
    );
  } else {
    return (
      <div className={c.Websocket}>
        <ReportIcon />
        {`This configuration changed while you were working on it. You must refresh.`}
      </div>
    );
  }
}
