const router = require("./routes/utils");
let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/utils",
      s.ensureUser({ forbid: true }),
      s.setContentType,
      s.registerRouter("/api/utils", router)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
