const router = require("./routes/configs");

let setup = {
  //Once the app initializes
  onceInit: s => {
    if (
      !process.env.hasOwnProperty("HIDE_CONFIG") ||
      process.env.HIDE_CONFIG != "true"
    ) {
      s.app.use(
        "/API/configure",
        s.ensureAdmin(),
        s.checkHeadersCodeInjection,
        s.setContentType,
        router
      );

      s.app.get(
        "/configure",
        s.ensureGroup(s.permissions.users),
        s.ensureAdmin(true),
        (req, res) => {
          const user = process.env.AUTH === "csso" ? req.user : null;
          res.render("configure", {
            user: user,
            AUTH: process.env.AUTH,
            NODE_ENV: process.env.NODE_ENV,
            CONFIGCONFIG_PATH: process.env.CONFIGCONFIG_PATH
          });
        }
      );
    }
  },
  //Once the server starts
  onceStarted: s => {},
  //Once all tables sync
  onceSynced: s => {}
};

module.exports = setup;
