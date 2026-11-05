const router = require("./routes/access");
const permissionModels = require("../../../../API/permissions/models");
const legacyImport = require("../../../../API/permissions/legacyImport");
const missions = require("../../../../API/permissions/missions");
const logger = require("../../../../API/logger");

let setup = {
  onceInit: (s) => {
    // Every mission gets a stable UUID as soon as its first config row exists
    const Config = require("../Config/models/config");
    Config.addHook("afterCreate", "permissionsEnsureMission", (row) =>
      missions.ensureMission(row.mission).catch((err) =>
        logger("error", "Failed to register mission UUID.", "permissions", null, err)
      )
    );
    s.app.use(
      s.ROOT_PATH + "/api/access",
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/access", router)
    );
  },
  onceStarted: (s) => {
    require("../../../../API/permissions/providers").startSettingBeat();
  },
  onceSynced: async (s) => {
    try {
      await permissionModels.up();
      // Needs the columns up() adds, e.g. on the first start after an upgrade
      await require("../../../../API/permissions/providers")
        .warnUnfitSubjects()
        .catch((err) => logger("error", "Couldn't check the login providers' linked accounts.", "AuthProviders", null, err));
      await missions.backfill();
      await legacyImport.run();
      await legacyImport.dropRollbackTracking();
      await legacyImport.warnIfSiteAccessChanged();
      await require("../../../../API/permissions/principal").scrubLegacyTokenColumn();
    } catch (err) {
      logger("error", "Failed to initialize roles and permissions.", "permissions", null, err);
    }
  },
};

module.exports = setup;
