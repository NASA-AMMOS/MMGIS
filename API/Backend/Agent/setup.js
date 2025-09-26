const router = require("./routes/agent");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/agent",
      s.checkHeadersCodeInjection,
      s.setContentType,
      router,
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
