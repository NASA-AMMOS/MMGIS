const routerBroadcast = require("./routes/broadcast");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/broadcast",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.registerRouter("/api/broadcast", routerBroadcast)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
