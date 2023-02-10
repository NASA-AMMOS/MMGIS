const router = require("./routes/your_router");

let setup = {
  //Once the app initializes
  onceInit: (s) => {},
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
  envs: [{ name: "ENV_VAR", description: "", required: false, private: false }],
};

module.exports = setup;
