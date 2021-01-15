const route = require("./routes/tools");
const router = route.router;

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      "/API/tools",
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
    route.updateToolDefinitions();
  },
};

module.exports = setup;
