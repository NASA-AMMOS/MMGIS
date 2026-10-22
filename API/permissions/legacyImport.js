// One-time conversion of legacy users.permission / missions_managing /
// missions_viewing into role bindings. Never reads or writes passwords.
const { Op } = require("sequelize");
const logger = require("../logger");
const { sequelize } = require("../connection");
const siteAccess = require("./siteAccess");
const missions = require("./missions");
const { LEGACY_SUPERADMIN, LEGACY_ADMIN } = require("./legacyPermissions");

const IMPORT_KEY = "legacy_import_v1";
// Last legacy column values this release saw, one row per account, to spot
// changes made on the previous release after a rollback
const COLUMNS_KEY = "legacy_columns_v1";
const COLUMNS_PREFIX = "legacy_columns:";
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
  await recordColumns(null, transaction);
  await AuthMeta.upsert({ key: COLUMNS_KEY, value: { at: new Date().toISOString() } }, { transaction });
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

const COLUMNS = ["permission", "missions_managing", "missions_viewing"];
const columnsOf = (u) => ({
  permission: u.permission,
  missions_managing: u.missions_managing == null ? null : [...u.missions_managing].sort(),
  missions_viewing: u.missions_viewing == null ? null : [...u.missions_viewing].sort(),
});
const sameColumns = (a, b) => JSON.stringify(columnsOf(a)) === JSON.stringify(columnsOf(b));

// Saves the current legacy columns of these accounts (all when ids is null)
async function recordColumns(ids, transaction) {
  const { AuthMeta, User } = models();
  const users = await User.findAll({
    ...(ids ? { where: { id: ids } } : {}),
    attributes: ["id", ...COLUMNS],
    raw: true,
    transaction,
  });
  for (const u of users)
    await AuthMeta.upsert({ key: COLUMNS_PREFIX + u.id, value: columnsOf(u) }, { transaction });
}

const minus = (a, b) => (a || []).filter((m) => !(b || []).includes(m));
const canSignIn = (p) => p === LEGACY_SUPERADMIN || SIGNED_IN_PERMISSIONS.includes(p);

// What a change to an account's legacy columns, made while rolled back, took away.
// Returns removals (and the narrower grants that replace a removed global one);
// anything that was raised is only reported.
function rollbackChanges(before, now, legacyLocal) {
  const out = { removeSuperAdmin: false, removeManaging: [], removeAllViewing: false,
    removeGlobalViewer: false, viewOnly: null, removeViewing: [], raised: [] };
  // A former SuperAdmin is then imported again with its new value
  if (before.permission === LEGACY_SUPERADMIN && now.permission !== LEGACY_SUPERADMIN) {
    out.removeSuperAdmin = true;
    return out;
  } else if (now.permission === LEGACY_SUPERADMIN && before.permission !== LEGACY_SUPERADMIN)
    out.raised.push("SuperAdmin");
  const managedBefore = before.permission === LEGACY_ADMIN ? before.missions_managing : [];
  const managedNow = now.permission === LEGACY_ADMIN ? now.missions_managing : [];
  out.removeManaging = minus(managedBefore, managedNow);
  if (before.permission !== LEGACY_SUPERADMIN && minus(managedNow, managedBefore).length)
    out.raised.push(`Mission Admin of ${minus(managedNow, managedBefore).join(", ")}`);
  if (legacyLocal) {
    if (canSignIn(before.permission) && !canSignIn(now.permission)) out.removeAllViewing = true;
    else if (canSignIn(now.permission)) {
      const vb = before.missions_viewing;
      const vn = now.missions_viewing;
      if (!canSignIn(before.permission)) out.raised.push("sign-in");
      else if (vb == null && vn != null) {
        out.removeGlobalViewer = true;
        out.viewOnly = vn;
      } else if (vb != null && vn == null) out.raised.push("view all missions");
      else if (vb != null && vn != null) {
        out.removeViewing = minus(vb, vn);
        if (minus(vn, vb).length) out.raised.push(`view ${minus(vn, vb).join(", ")}`);
      }
    }
  }
  return out;
}

// After a rollback to a release that reads the legacy columns and a re-upgrade,
// access removed there is removed here too. Accounts created there are imported.
async function reconcileRollback() {
  if (!(await alreadyImported())) return null;
  const { AuthMeta, RoleBinding, User } = models();
  const bindings = require("./bindings");
  const legacyLocal = isLegacyLocal();
  const report = [];
  const changedIds = [];
  await bindings.withSuperAdminLock(async ({ transaction, superAdmins }) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", {
      replacements: { key: `mmgis:${COLUMNS_KEY}` },
      transaction,
    });
    const tracked = (await AuthMeta.findOne({ where: { key: COLUMNS_KEY }, transaction })) != null;
    if (tracked) {
      const rows = await AuthMeta.findAll({
        where: { key: { [Op.like]: `${COLUMNS_PREFIX}%` } },
        raw: true,
        transaction,
      });
      const before = new Map(rows.map((r) => [r.key.slice(COLUMNS_PREFIX.length), r.value]));
      const users = await User.findAll({ attributes: ["id", "username", ...COLUMNS], raw: true, transaction });
      const remaining = new Set(superAdmins.map(String));
      const userWhere = (id, extra) => ({ subject_type: "user", subject_id: String(id), ...extra });
      const destroy = (where) => RoleBinding.destroy({ where, transaction });
      const grant = (id, role, scope_type, mission_uuid) =>
        RoleBinding.findOrCreate({
          where: userWhere(id, { role, scope_type, mission_uuid: mission_uuid || null, layer_uuid: null }),
          defaults: { source: "import" },
          transaction,
        });
      const uuidsOf = async (names) =>
        (await Promise.all((names || []).map((n) => missions.uuidForName(n)))).filter(Boolean);

      for (const u of users) {
        const id = String(u.id);
        const was = before.get(id);
        before.delete(id);
        if (was && sameColumns(was, u)) continue;
        changedIds.push(u.id);
        const done = [];
        if (!was) {
          // Created on the previous release: import it like the first upgrade did
          const add = [];
          await userBindings(u, legacyLocal, (n) => missions.uuidForName(n), (b) => add.push(b));
          for (const b of add) await grant(u.id, b.role, b.scope_type, b.mission_uuid);
          report.push(`${u.username}: new account, imported ${add.length} grant(s)`);
          continue;
        }
        const c = rollbackChanges(was, u, legacyLocal);
        if (c.removeSuperAdmin && remaining.has(id)) {
          if (remaining.size === 1) {
            report.push(`${u.username}: kept SuperAdmin (it is the last one)`);
            continue;
          } else {
            remaining.delete(id);
            await destroy(userWhere(id, { role: "superadmin", scope_type: "global" }));
            done.push("removed SuperAdmin");
          }
          const add = [];
          await userBindings(u, legacyLocal, (n) => missions.uuidForName(n), (b) => add.push(b));
          for (const b of add) await grant(u.id, b.role, b.scope_type, b.mission_uuid);
          if (add.length) done.push(`imported ${add.length} grant(s) for permission ${u.permission}`);
          report.push(`${u.username}: ${done.join("; ")}`);
          continue;
        }
        const managing = await uuidsOf(c.removeManaging);
        if (managing.length && (await destroy(userWhere(id, { role: "mission_admin", scope_type: "mission", mission_uuid: managing }))))
          done.push(`removed Mission Admin of ${c.removeManaging.join(", ")}`);
        if (c.removeAllViewing && (await destroy(userWhere(id, { role: "viewer" }))))
          done.push("removed viewing (account can no longer sign in there)");
        if (c.removeGlobalViewer && (await destroy(userWhere(id, { role: "viewer", scope_type: "global" })))) {
          for (const uuid of await uuidsOf(c.viewOnly)) await grant(u.id, "viewer", "mission", uuid);
          done.push(`limited viewing to ${c.viewOnly.length ? c.viewOnly.join(", ") : "no missions"}`);
        }
        const viewing = await uuidsOf(c.removeViewing);
        if (viewing.length && (await destroy(userWhere(id, { role: "viewer", scope_type: "mission", mission_uuid: viewing }))))
          done.push(`removed viewing of ${c.removeViewing.join(", ")}`);
        if (c.raised.length)
          done.push(`not raised (grant in Users & Access if intended): ${c.raised.join("; ")}`);
        if (done.length) report.push(`${u.username}: ${done.join("; ")}`);
      }
      // Accounts deleted on the previous release
      for (const id of before.keys()) {
        const n = await destroy({ subject_type: "user", subject_id: id });
        await AuthMeta.destroy({ where: { key: COLUMNS_PREFIX + id }, transaction });
        if (n) report.push(`deleted account #${id}: removed ${n} grant(s)`);
      }
    }
    await recordColumns(null, transaction);
    await AuthMeta.upsert({ key: COLUMNS_KEY, value: { at: new Date().toISOString() } }, { transaction });
  });
  if (report.length) {
    require("./principal").invalidate();
    for (const id of changedIds) await bindings.syncLegacyPermission(id);
    logger(
      "warn",
      `Accounts changed on the previous release since the last start; grants updated to match: ${report.join(" | ")}`,
      "permissions"
    );
  }
  return report;
}

module.exports = {
  plan,
  run,
  alreadyImported,
  warnIfSiteAccessChanged,
  reconcileRollback,
  rollbackChanges,
  recordColumns,
  IMPORT_KEY,
};
