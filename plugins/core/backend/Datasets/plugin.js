const router = require("./routes/datasets");
let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/datasets",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/datasets", router)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
