const router = require("./routes/longtermtokens");

const longTermTokenModel = require("./models/longtermtokens");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/longtermtoken",
      s.ensureAdmin(false, true),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    if (typeof longTermTokenModel.up === "function") {
      longTermTokenModel.up();
    }
  },
};

module.exports = setup;
