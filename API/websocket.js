const WebSocket = require("isomorphic-ws");
const logger = require("./logger");

const websocket = {
  wss: null,
  broadcast: function (data, isBinary) {
    if (!websocket.wss || typeof websocket.wss.broadcast !== "function") {
      return false;
    }

    websocket.wss.broadcast(data, isBinary);
    return true;
  },
  init: function (server, sessionMiddleware) {
    logger("info", "Trying to init websocket...", "websocket", null, "");

    if (!server) {
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

    const wss = new WebSocket.Server({ noServer: true, maxPayload: 64 * 1024 });
    websocket.wss = wss;
    const { isOriginAllowed } = require("./origin");

    // Broadcast to all clients
    wss.broadcast = function broadcast(data, isBinary) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && data !== undefined) {
          client.send(data, { binary: isBinary });
        }
      });
    };

    wss.on("connection", (ws, request) => {
      ws.on("message", (message) => {
        logger(
          "warn",
          `Rejected websocket client message (from ${
            request.headers["x-forwarded-for"] || request.socket.remoteAddress
          })`,
          "websocket",
          request,
        );
        ws.close(1008, "Client messages are not accepted");
      });
    });

    server.on("upgrade", function upgrade(request, socket, head) {
      const pathname = request.url;
      const remoteAddress =
        request.headers["x-forwarded-for"] || request.socket.remoteAddress;
      const reject = (reason) => {
        logger(
          "warn",
          `Rejected websocket upgrade (reason: ${reason}, from ${remoteAddress})`,
          "websocket",
          request,
        );
        socket.destroy();
      };

      try {
        if (
          pathname !==
          (process.env.WEBSOCKET_ROOT_PATH || process.env.ROOT_PATH || "") + "/"
        ) {
          reject("invalid path");
          return;
        }

        const origin = request.headers.origin;
        if (!origin) {
          reject("missing origin");
          return;
        }
        if (!isOriginAllowed(origin, request.headers.host)) {
          reject("origin not allowed");
          return;
        }

        const completeUpgrade = () => {
          const authenticated =
            process.env.AUTH === "off" ||
            (request.session &&
              ((typeof request.session.user === "string" &&
                request.session.user.length > 0) ||
                (typeof request.session.permission === "string" &&
                  request.session.permission.length > 0)));

          if (!authenticated) {
            reject("unauthenticated session");
            return;
          }

          wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request);
          });
        };

        if (typeof sessionMiddleware === "function") {
          sessionMiddleware(request, {}, (err) => {
            if (err) {
              reject("session middleware error");
              return;
            }
            completeUpgrade();
          });
        } else {
          completeUpgrade();
        }
      } catch (err) {
        reject("upgrade error");
      }
    });

    wss.on("close", () => {
      logger("info", "Websocket disconnected...", "websocket", null, "");
      websocket.wss = null;
    });
  },
};

module.exports = { websocket };
