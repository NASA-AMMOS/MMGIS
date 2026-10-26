const routeFiles = require("./routes/files");
const routerFiles = routeFiles.router;
const routerDraw = require("./routes/draw").router;
const routerAggregations = require("./routes/aggregations");
const ufiles = require("./models/userfiles");
const file_histories = require("./models/filehistories");

// Draw needs a signed-in account (public sites have none, as with AUTH=off).
// Guests and ended sessions get the message the Draw tool shows as "please log in".
const drawNeedsSignIn = (s) => (req, res, next) => {
  const url = req.originalUrl.split("?")[0].toLowerCase();
  if (url.endsWith("/api/files/getfile") && !s.siteAccess.isPublic()) {
    next();
    return;
  }
  s.ensurePrincipal(req)
    .then((p) => {
      if (s.siteAccess.isPublic() || (!p.authenticated && p.kind !== "invalid_token")) {
        res.send({ status: "failure", message: "User is not logged in." });
        return;
      }
      next();
    })
    .catch(next);
};

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/files",
      drawNeedsSignIn(s),
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/files", routerFiles)
    );

    s.app.use(
      s.ROOT_PATH + "/api/draw",
      drawNeedsSignIn(s),
      s.ensureUser({ forbid: true }),
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/draw", routerDraw)
    );

    s.app.use(
      s.ROOT_PATH + "/api/draw",
      drawNeedsSignIn(s),
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
