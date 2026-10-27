const router = require("./routes/geodatasets");

const geodatasets = require("./models/geodatasets");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/geodatasets",
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
    if (typeof geodatasets.up === "function") {
      geodatasets.up();
    }
  },
};

module.exports = setup;
