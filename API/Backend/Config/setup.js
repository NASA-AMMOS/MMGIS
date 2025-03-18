const router = require("./routes/configs");
const triggerWebhooks = require("../Webhooks/processes/triggerwebhooks.js");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    if (
      !process.env.hasOwnProperty("HIDE_CONFIG") ||
      process.env.HIDE_CONFIG != "true"
    ) {
      s.app.get(
        s.ROOT_PATH + "/configure-legacy",
        s.ensureGroup(s.permissions.users),
        s.ensureAdmin(true),
        (req, res) => {
          const user = process.env.AUTH === "csso" ? req.user : null;
          res.render("configure", {
            user: user,
            AUTH: process.env.AUTH,
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT || "8888",
            ENABLE_CONFIG_WEBSOCKETS: process.env.ENABLE_CONFIG_WEBSOCKETS,
            ENABLE_CONFIG_OVERRIDE: process.env.ENABLE_CONFIG_OVERRIDE,
            ROOT_PATH:
              process.env.NODE_ENV === "development"
                ? ""
                : /*(process.env.EXTERNAL_ROOT_PATH || "") +*/
                  process.env.ROOT_PATH || "",
            WEBSOCKET_ROOT_PATH:
              process.env.NODE_ENV === "development"
                ? ""
                : process.env.WEBSOCKET_ROOT_PATH || "",
          });
        }
      );

      s.app.get(
        s.ROOT_PATH + "/configure",
        s.ensureGroup(s.permissions.users),
        s.ensureAdmin(true),
        (req, res) => {
          const user = process.env.AUTH === "csso" ? req.user : null;
          res.render("../configure/build/index.pug", {
            user: user,
            AUTH: process.env.AUTH,
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT || "8888",
            ENABLE_CONFIG_WEBSOCKETS: process.env.ENABLE_CONFIG_WEBSOCKETS,
            ENABLE_CONFIG_OVERRIDE: process.env.ENABLE_CONFIG_OVERRIDE,
            ROOT_PATH:
              process.env.NODE_ENV === "development"
                ? ""
                : /*(process.env.EXTERNAL_ROOT_PATH || "") +*/
                  process.env.ROOT_PATH || "",
            WEBSOCKET_ROOT_PATH:
              process.env.NODE_ENV === "development"
                ? ""
                : process.env.WEBSOCKET_ROOT_PATH || "",
            IS_DOCKER: process.env.IS_DOCKER,
            WITH_STAC: process.env.WITH_STAC,
            WITH_TIPG: process.env.WITH_TIPG,
            WITH_TITILER: process.env.WITH_TITILER,
            WITH_TITILER_PGSTAC: process.env.WITH_TITILER_PGSTAC,
          });
        }
      );
    }

    s.app.use(
      s.ROOT_PATH + "/api/configure",
      s.ensureAdmin(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    triggerWebhooks("getConfiguration", {});
  },
};

module.exports = setup;
