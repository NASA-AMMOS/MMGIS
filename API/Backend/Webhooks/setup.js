const routeWebhooks = require("./routes/webhooks");
const routerWebhooks = routeWebhooks.router;
const fetch = require("node-fetch");
const routerTestWebhooks = require("./routes/testwebhooks");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use("/API/webhooks", s.checkHeadersCodeInjection, routerWebhooks);
    s.app.use(
      "/API/testwebhooks",
      s.checkHeadersCodeInjection,
      routerTestWebhooks
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
