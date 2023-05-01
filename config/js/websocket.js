const Websocket = {
  initialWebSocketRetryInterval: 60000, // 1 minute
  webSocketRetryInterval: 60000, // Start with this time and double if disconnected
  webSocketPingInterval: null,
  init: function () {
    if (typeof window.setLockConfig === "function")
      window.clearLockConfig("disconnect");

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
      Websocket.webSocketRetryInterval =
        Websocket.initialWebSocketRetryInterval;
      clearInterval(Websocket.webSocketPingInterval);
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
          if (typeof window.setLockConfig === "function")
            window.setLockConfig();
        }
      } catch (err) {}
    });

    socket.addEventListener("close", (event) => {
      if (typeof window.setLockConfig === "function")
        window.setLockConfig("disconnect");

      clearInterval(Websocket.webSocketPingInterval);
      Websocket.webSocketPingInterval = setInterval(
        Websocket.init,
        Websocket.webSocketRetryInterval
      ); // 1 minute
      Websocket.webSocketRetryInterval *= 2;
    });
  },
};

if (
  mmgisglobal.ENABLE_CONFIG_WEBSOCKETS === "true" ||
  mmgisglobal.ENABLE_CONFIG_WEBSOCKETS === true
)
  Websocket.init();
