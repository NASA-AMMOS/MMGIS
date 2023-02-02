const routeFiles = require("./routes/files");
const routerFiles = routeFiles.router;
const routerDraw = require("./routes/draw").router;

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/API/files",
      s.ensureUser(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.stopGuests,
      routerFiles
    );

    s.app.use(
      s.ROOT_PATH + "/API/draw",
      s.ensureUser(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.stopGuests,
      routerDraw
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    routeFiles.makeMasterFiles([
      "roi",
      "campaign",
      "campsite",
      "trail",
      "signpost",
      "all",
    ]);
  },
};

module.exports = setup;
