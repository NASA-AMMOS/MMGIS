const router = require("./routes/stac");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/stac",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/stac", router)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
