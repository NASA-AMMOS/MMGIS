// One-time conversion of legacy users.permission / missions_managing /
// missions_viewing into role bindings. Never reads or writes passwords.
const logger = require("../logger");
const siteAccess = require("./siteAccess");
const missions = require("./missions");
const { LEGACY_SUPERADMIN, LEGACY_ADMIN } = require("./legacyPermissions");

const IMPORT_KEY = "legacy_import_v1";
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
  const legacyLocal = siteAccess.isRequired() && !siteAccess.hasProvider("csso");

  for (const u of users) {
    const subject = { subject_type: "user", subject_id: String(u.id) };
    if (u.permission === LEGACY_SUPERADMIN) {
      add({ ...subject, role: "superadmin", scope_type: "global" });
      continue;
    }
    if (u.permission === LEGACY_ADMIN)
      for (const m of u.missions_managing || []) {
        const uuid = await missionScope(m);
        if (uuid) add({ ...subject, role: "mission_admin", scope_type: "mission", mission_uuid: uuid });
      }
    // Viewing limits were only enforced for local-login sites that require login,
    // and there only these permissions could get past the login page
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
  if (!siteAccess.isRequired())
    add({ subject_type: "audience", subject_id: "everyone", role: "viewer", scope_type: "global" });
  else if (!legacyLocal)
    add({ subject_type: "audience", subject_id: "authenticated", role: "viewer", scope_type: "global" });

  return { users: users.length, bindings, unknownMissions: Array.from(unknownMissions) };
}

async function alreadyImported() {
  const { AuthMeta } = models();
  try {
    return (await AuthMeta.findOne({ where: { key: IMPORT_KEY } })) != null;
  } catch (err) {
    // auth_meta does not exist yet
    return false;
  }
}

// Runs once per database; later grant changes are never undone by re-importing
async function run() {
  const { AuthMeta, RoleBinding } = models();
  if (await alreadyImported()) return { skipped: true };
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
    });
  await AuthMeta.upsert({
    key: IMPORT_KEY,
    value: {
      at: new Date().toISOString(),
      siteAccess: siteAccess.getSiteAccess(),
      providers: siteAccess.getProviders(),
      bindings: result.bindings.length,
    },
  });
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

module.exports = { plan, run, alreadyImported, warnIfSiteAccessChanged, IMPORT_KEY };
