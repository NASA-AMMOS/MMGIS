const router = require("./routes/users");

const userModel = require("./models/user");
const setupCode = require("../../../../API/permissions/setupCode");
const bindings = require("../../../../API/permissions/bindings");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/users",
      s.checkHeadersCodeInjection,
      s.registerRouter("/api/users", router)
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    if (typeof userModel.up === "function") {
      userModel.up();
    }
    bindings
      .superAdminUserIds()
      .then((ids) => {
        if (ids.length === 0) setupCode.ensure();
      })
      .catch(() => {});
  },
};

module.exports = setup;
