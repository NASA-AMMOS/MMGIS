const WebSocket = require("isomorphic-ws");
const logger = require("./logger");
const siteAccess = require("./permissions/siteAccess");

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
    const { getRequestHost, isOriginAllowed } = require("./origin");

    // Sends each mission's updates only to clients that can view that mission
    wss.broadcast = function broadcast(data, isBinary) {
      if (data === undefined) return;
      let mission = null;
      try {
        const parsed = JSON.parse(data);
        mission = parsed && parsed.body ? parsed.body.mission : null;
      } catch (err) {}
      if (typeof mission !== "string" || mission === "") return;
      const policy = require("./permissions/policy");
      require("./permissions/missions")
        .uuidForName(mission)
        .then((uuid) => {
          if (!uuid) return;
          wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN || !client.mmgisViewer) return;
            client
              .mmgisViewer()
              .then((p) => {
                if (
                  client.readyState === WebSocket.OPEN &&
                  policy.can(p, "mission.view", { mission: uuid })
                )
                  client.send(data, { binary: isBinary });
              })
              .catch(() => {});
          });
        })
        .catch((err) =>
          logger("error", "Failed to broadcast websocket update.", "websocket", null, err)
        );
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
        if (!isOriginAllowed(origin, getRequestHost(request))) {
          reject("origin not allowed");
          return;
        }

        // Header-based login providers (e.g. CSSO) identify the upgrade request itself
        const providerIdentity = () =>
          require("./permissions/providers")
            .identify({
              headers: request.headers,
              get: (name) => request.headers[String(name).toLowerCase()],
            })
            .catch(() => null);

        const completeUpgrade = async () => {
          const identity = await providerIdentity();
          // The session as stored now, so logouts and ended sessions apply to open sockets
          const currentSession = () =>
            new Promise((resolve) => {
              const store = request.sessionStore;
              if (!request.session || !store || !request.sessionID) {
                resolve(request.session || {});
                return;
              }
              store.get(request.sessionID, (err, s) => resolve(err || !s ? {} : s));
            });
          // Resolved again on every broadcast, so removed access and deleted accounts apply at once
          const viewer = async () =>
            require("./permissions/principal").resolvePrincipal({
              headers: request.headers,
              session: await currentSession(),
              identity: identity || undefined,
            });
          const p = await viewer();

          // Guests are allowed unless SITE_ACCESS=required; a deleted account's session is a guest
          if (p.kind === "invalid_token" || !(p.authenticated || siteAccess.guestsAllowed())) {
            reject("unauthenticated session");
            return;
          }

          wss.handleUpgrade(request, socket, head, function done(ws) {
            ws.mmgisViewer = viewer;
            wss.emit("connection", ws, request);
          });
        };

        if (typeof sessionMiddleware === "function") {
          sessionMiddleware(request, {}, (err) => {
            if (err) {
              reject("session middleware error");
              return;
            }
            completeUpgrade().catch(() => reject("upgrade error"));
          });
        } else {
          completeUpgrade().catch(() => reject("upgrade error"));
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
