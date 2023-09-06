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
        s.ROOT_PATH + "/configure",
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
                : process.env.ROOT_PATH || "",
            WEBSOCKET_ROOT_PATH:
              process.env.NODE_ENV === "development"
                ? ""
                : process.env.WEBSOCKET_ROOT_PATH || "",
          });
        }
      );
    }

    s.app.use(
      s.ROOT_PATH + "/API/configure",
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
