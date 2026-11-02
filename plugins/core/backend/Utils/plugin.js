const router = require("./routes/utils");
const { authorize } = require("../../../../API/permissions/authorize");
let setup = {
  //Once the app initializes
  onceInit: (s) => {
    // Health checks must answer even when the site requires login
    s.app.get(
      s.ROOT_PATH + "/api/utils/healthcheck",
      authorize.public("health check"),
      function (req, res) {
        res.send("Alive and Well!");
      }
    );
    s.app.use(
      s.ROOT_PATH + "/api/utils",
      s.ensureUser({ forbid: true }),
      s.setContentType,
      s.registerRouter("/api/utils", router)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
