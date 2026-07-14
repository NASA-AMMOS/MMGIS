const sightmapRouter = require("./routes/sightmap");
const horizonprofileRouter = require("./routes/horizonprofile");
const visibilityRouter = require("./routes/visibility");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/sightline",
      s.ensureUser(),
      s.setContentType,
      sightmapRouter
    );
    s.app.use(
      s.ROOT_PATH + "/api/sightline",
      s.ensureUser(),
      s.setContentType,
      horizonprofileRouter
    );
    s.app.use(
      s.ROOT_PATH + "/api/sightline",
      s.ensureUser(),
      s.setContentType,
      visibilityRouter
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
