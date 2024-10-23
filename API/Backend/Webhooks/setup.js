const routeWebhooks = require("./routes/webhooks");
const routerWebhooks = routeWebhooks.router;
const routerTestWebhooks = require("./routes/testwebhooks");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/API/webhooks",
      s.checkHeadersCodeInjection,
      routerWebhooks
    );
    if (process.env.NODE_ENV === "development") {
      s.app.use(
        s.ROOT_PATH + "/API/testwebhooks",
        s.checkHeadersCodeInjection,
        routerTestWebhooks
      );
    }
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
