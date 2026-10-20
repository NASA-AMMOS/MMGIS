const routeFiles = require("./routes/files");
const routerFiles = routeFiles.router;
const routerDraw = require("./routes/draw").router;
const routerAggregations = require("./routes/aggregations");
const ufiles = require("./models/userfiles");
const file_histories = require("./models/filehistories");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/files",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/files", routerFiles)
    );

    s.app.use(
      s.ROOT_PATH + "/api/draw",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/draw", routerDraw)
    );

    s.app.use(
      s.ROOT_PATH + "/api/draw",
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/draw", routerAggregations)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: async (s) => {
    if (typeof file_histories.up === "function") {
      file_histories.up();
    }
    if (typeof ufiles.up === "function") {
      await ufiles.up();
    }
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
