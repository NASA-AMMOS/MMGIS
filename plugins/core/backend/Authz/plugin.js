const router = require("./routes/authz");
const authzModels = require("./models/authz");
const legacyImport = require("../../../../API/authz/legacyImport");
const missions = require("../../../../API/authz/missions");
const logger = require("../../../../API/logger");

let setup = {
  onceInit: (s) => {
    // Every mission gets a stable UUID as soon as its first config row exists
    const Config = require("../Config/models/config");
    Config.addHook("afterCreate", "authzEnsureMission", (row) =>
      missions.ensureMission(row.mission).catch((err) =>
        logger("error", "Failed to register mission UUID.", "authz", null, err)
      )
    );
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
