const router = require("./routes/longtermtokens");
let setup = {
  //Once the app initializes
  onceInit: s => {
    s.app.use(
      "/API/longtermtoken",
      s.ensureAdmin(false, true),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  //Once the server starts
  onceStarted: s => {},
  //Once all tables sync
  onceSynced: s => {}
};

module.exports = setup;
