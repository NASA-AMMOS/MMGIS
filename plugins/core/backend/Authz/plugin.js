const router = require("./routes/authz");
const authzModels = require("./models/authz");
const legacyImport = require("../../../../API/authz/legacyImport");
const missions = require("../../../../API/authz/missions");
const logger = require("../../../../API/logger");

let setup = {
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/authz",
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/authz", router)
    );
  },
  onceStarted: (s) => {},
  onceSynced: async (s) => {
    try {
      await authzModels.up();
      await missions.backfill();
      await legacyImport.run();
    } catch (err) {
      logger("error", "Failed to initialize roles and permissions.", "authz", null, err);
    }
  },
};

module.exports = setup;
