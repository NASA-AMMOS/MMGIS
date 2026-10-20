// One-time conversion of legacy users.permission / missions_managing /
// missions_viewing into role bindings. Never reads or writes passwords.
const logger = require("../logger");
const siteAccess = require("./siteAccess");
const missions = require("./missions");

const IMPORT_KEY = "legacy_import_v1";

function models() {
  const authz = require("../../plugins/core/backend/Authz/models/authz");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  return { ...authz, User };
}

// Returns the bindings the import would create (no writes)
async function plan() {
  const { User } = models();
  await missions.backfill();
  const users = await User.findAll({
    attributes: ["id", "username", "permission", "missions_managing", "missions_viewing"],
    order: [["id", "ASC"]],
    raw: true,
  });
  const bindings = [];
  const unknownMissions = new Set();
  const add = (b) => bindings.push({ source: "import", ...b });
  const missionScope = async (name) => {
    const uuid = await missions.uuidForName(name);
    if (!uuid) unknownMissions.add(name);
    return uuid;
  };
  const legacyLocal = siteAccess.isRequired() && !siteAccess.hasProvider("csso");

  for (const u of users) {
    const subject = { subject_type: "user", subject_id: String(u.id) };
    if (u.permission === "111") {
      add({ ...subject, role: "superadmin", scope_type: "global" });
      continue;
    }
    if (u.permission === "110")
      for (const m of u.missions_managing || []) {
        const uuid = await missionScope(m);
        if (uuid) add({ ...subject, role: "mission_admin", scope_type: "mission", mission_uuid: uuid });
      }
    // Viewing limits were only enforced for local-login sites that require login
    if (legacyLocal) {
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
  return (await AuthMeta.findOne({ where: { key: IMPORT_KEY } })) != null;
}

// Idempotent: runs once per database
async function run({ force = false } = {}) {
  const { AuthMeta, RoleBinding } = models();
  if (!force && (await alreadyImported())) return { skipped: true };
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
    "authz"
  );
  if (result.unknownMissions.length)
    logger("warn", `Legacy mission names without a mission: ${result.unknownMissions.join(", ")}`, "authz");
  return result;
}

module.exports = { plan, run, alreadyImported, IMPORT_KEY };
