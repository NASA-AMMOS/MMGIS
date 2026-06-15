const sightmapRouter = require("./routes/sightmap");
const horizonprofileRouter = require("./routes/horizonprofile");

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
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
