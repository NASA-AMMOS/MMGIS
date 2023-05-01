const WebSocket = require("isomorphic-ws");
const logger = require("./logger");

const websocket = {
  wss: null,
  init: function (server) {
    logger("info", "Trying to init websocket...", "websocket", null, "");

    if (!server === null) {
      logger(
        "websocket_error",
        "server parameter not defined.",
        "error",
        null,
        ""
      );
      return null;
    }

    logger(
      "info",
      "Server is valid so still trying to init websocket...",
      "websocket",
      null,
      ""
    );

    const wss = new WebSocket.Server({ noServer: true });
    websocket.wss = wss;

    // Broadcast to all clients
    wss.broadcast = function broadcast(data, isBinary) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && data !== undefined) {
          client.send(data, { binary: isBinary });
        }
      });
    };

    wss.on("connection", (ws) => {
      ws.on("message", (message) => {
        wss.broadcast(message);
      });
    });

    server.on("upgrade", function upgrade(request, socket, head) {
      const pathname = request.url;
      try {
        if (
          pathname ===
          (process.env.WEBSOCKET_ROOT_PATH || process.env.ROOT_PATH || "") + "/"
        ) {
          wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request);
          });
        } else {
          socket.destroy();
        }
      } catch (err) {
        socket.destroy();
      }
    });

    wss.on("close", () => {
      logger("info", "Websocket disconnected...", "websocket", null, "");
      websocket.wss = null;
    });
  },
};

module.exports = { websocket };
