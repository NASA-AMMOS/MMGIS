const router = require("./routes/users");

const userModel = require("./models/user");
const setupCode = require("../../../../API/permissions/setupCode");

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
    userModel.User.count()
      .then((count) => {
        if (count === 0) setupCode.ensure();
      })
      .catch(() => {});
  },
};

module.exports = setup;
