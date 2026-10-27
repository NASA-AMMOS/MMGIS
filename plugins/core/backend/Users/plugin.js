const router = require("./routes/users");

const userModel = require("./models/user");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(s.ROOT_PATH + "/api/users", s.checkHeadersCodeInjection, router);
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    if (typeof userModel.up === "function") {
      userModel.up();
    }
  },
};

module.exports = setup;
