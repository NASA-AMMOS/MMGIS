// One-time conversion of legacy users.permission / missions_managing /
// missions_viewing into role bindings. Never reads or writes passwords.
const { Op } = require("sequelize");
const logger = require("../logger");
const { sequelize } = require("../connection");
const siteAccess = require("./siteAccess");
const missions = require("./missions");
const { LEGACY_SUPERADMIN, LEGACY_ADMIN } = require("./legacyPermissions");

const IMPORT_KEY = "legacy_import_v1";
// Rollback tracking from earlier builds of this release; no longer kept
const OLD_COLUMNS_KEYS = { [Op.or]: [{ [Op.eq]: "legacy_columns_v1" }, { [Op.like]: "legacy_columns:%" }] };
const SIGNED_IN_PERMISSIONS = [LEGACY_ADMIN, "001"];

function models() {
  const permissionModels = require("./models");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  return { ...permissionModels, User };
}

// Mission name -> UUID without creating anything (for dry runs)
async function readOnlyMissionLookup() {
  const { AuthMission } = models();
  const Config = require("../../plugins/core/backend/Config/models/config");
  let known = new Map();
  try {
    known = new Map((await AuthMission.findAll({ raw: true })).map((r) => [r.name, r.uuid]));
  } catch (err) {
    // Roles tables do not exist yet: every mission would get a new UUID
  }
  const configured = new Set(
    (await Config.aggregate("mission", "DISTINCT", { plain: false })).map((r) => r.DISTINCT)
  );
  return async (name) =>
    known.get(name) || (configured.has(name) ? `(new UUID for ${name})` : null);
}

// Returns the bindings the import would create. With dryRun nothing is written.
async function plan({ dryRun = false } = {}) {
  const { User } = models();
  let lookup = missions.uuidForName;
  if (dryRun) lookup = await readOnlyMissionLookup();
  else await missions.backfill();
  const users = await User.findAll({
    attributes: ["id", "username", "permission", "missions_managing", "missions_viewing"],
    order: [["id", "ASC"]],
    raw: true,
  });
  const bindings = [];
  const unknownMissions = new Set();
  const add = (b) => bindings.push({ source: "import", ...b });
  const missionScope = async (name) => {
    const uuid = await lookup(name);
    if (!uuid) unknownMissions.add(name);
    return uuid;
  };
  const legacyLocal = isLegacyLocal();

  for (const u of users) await userBindings(u, legacyLocal, missionScope, add);
  if (!siteAccess.isRequired())
    add({ subject_type: "audience", subject_id: "everyone", role: "viewer", scope_type: "global" });
  else if (!legacyLocal)
    add({ subject_type: "audience", subject_id: "authenticated", role: "viewer", scope_type: "global" });

  return { users: users.length, bindings, unknownMissions: Array.from(unknownMissions) };
}

// Viewing limits were only enforced for local-login sites that require login
function isLegacyLocal() {
  return siteAccess.isRequired() && !siteAccess.hasProvider("csso");
}

async function userBindings(u, legacyLocal, missionScope, add) {
  const subject = { subject_type: "user", subject_id: String(u.id) };
  if (u.permission === LEGACY_SUPERADMIN) {
    add({ ...subject, role: "superadmin", scope_type: "global" });
    return;
  }
  if (u.permission === LEGACY_ADMIN)
    for (const m of u.missions_managing || []) {
      const uuid = await missionScope(m);
      if (uuid) add({ ...subject, role: "mission_admin", scope_type: "mission", mission_uuid: uuid });
    }
  // There only these permissions could get past the login page
  if (legacyLocal && SIGNED_IN_PERMISSIONS.includes(u.permission)) {
    if (u.missions_viewing == null)
      add({ ...subject, role: "viewer", scope_type: "global" });
    else
      for (const m of u.missions_viewing) {
        const uuid = await missionScope(m);
        if (uuid) add({ ...subject, role: "viewer", scope_type: "mission", mission_uuid: uuid });
      }
  }
}

async function alreadyImported(transaction) {
  const { AuthMeta } = models();
  try {
    return (
      (await AuthMeta.findOne({ where: { key: IMPORT_KEY }, transaction })) !=
      null
    );
  } catch (err) {
    // auth_meta does not exist yet
    return false;
  }
}

// Runs once per database; later grant changes are never undone by re-importing
async function run() {
  if (await alreadyImported()) return { skipped: true };
  // Servers starting together would otherwise each import
  const result = await sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", {
      replacements: { key: `mmgis:${IMPORT_KEY}` },
      transaction,
    });
    if (await alreadyImported(transaction)) return null;
    return importLocked(transaction);
  });
  if (result == null) return { skipped: true };
  require("./principal").invalidate();
  logger(
    "info",
    `Imported ${result.bindings.length} role binding(s) from ${result.users} legacy user(s).`,
    "permissions"
  );
  if (result.unknownMissions.length)
    logger("warn", `Legacy mission names without a mission: ${result.unknownMissions.join(", ")}`, "permissions");
  return result;
}

async function importLocked(transaction) {
  const { AuthMeta, RoleBinding } = models();
  const result = await plan();
  for (const b of result.bindings)
    await RoleBinding.findOrCreate({
      where: {
        subject_type: b.subject_type,
        subject_id: b.subject_id,
        role: b.role,
        scope_type: b.scope_type,
        mission_uuid: b.mission_uuid || null,
        layer_uuid: b.layer_uuid || null,
      },
      defaults: { source: b.source },
      transaction,
    });
  await AuthMeta.upsert({
    key: IMPORT_KEY,
    value: {
      at: new Date().toISOString(),
      siteAccess: siteAccess.getSiteAccess(),
      providers: siteAccess.getProviders(),
      bindings: result.bindings.length,
    },
  }, { transaction });
  return result;
}

// The import used the SITE_ACCESS of the first start; say so if it has changed since
async function warnIfSiteAccessChanged() {
  const { AuthMeta } = models();
  const row = await AuthMeta.findOne({ where: { key: IMPORT_KEY } }).catch(() => null);
  const before = row && row.value && row.value.siteAccess;
  const now = siteAccess.getSiteAccess();
  if (before && before !== now) {
    logger(
      "warn",
      `SITE_ACCESS is '${now}' but accounts were imported under '${before}'. The import does not run again: review the Everyone and Logged-in users grants in Configure → Access.`,
      "permissions"
    );
    return { before, now };
  }
  return null;
}

// The legacy columns are left as they were at the import and no longer read or written.
// Downgrading after this means restoring a database backup taken before the upgrade.
async function dropRollbackTracking() {
  const { AuthMeta } = models();
  await AuthMeta.destroy({ where: { key: OLD_COLUMNS_KEYS } }).catch(() => {});
}

module.exports = {
  plan,
  run,
  alreadyImported,
  warnIfSiteAccessChanged,
  dropRollbackTracking,
  IMPORT_KEY,
};
