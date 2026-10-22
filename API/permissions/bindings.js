// Role binding management shared by the Access and Accounts routes
const { Op } = require("sequelize");
const { sequelize } = require("../connection");
const policy = require("./policy");
const missions = require("./missions");
const { invalidate } = require("./principal");

function models() {
  const permissionModels = require("./models");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  return { ...permissionModels, User };
}

class BindingError extends Error {}

async function describe(row) {
  const b = row.get ? row.get({ plain: true }) : row;
  return {
    ...b,
    mission: b.mission_uuid ? await missions.nameForUUID(b.mission_uuid) : null,
  };
}

const SUPERADMIN_WHERE = { subject_type: "user", role: "superadmin", scope_type: "global" };

// Serializes changes that can remove a direct SuperAdmin: the SuperAdmin rows stay
// locked until fn's transaction commits, so concurrent removals see each other
function withSuperAdminLock(fn) {
  const { RoleBinding } = models();
  return sequelize.transaction(async (transaction) => {
    const rows = await RoleBinding.findAll({
      where: SUPERADMIN_WHERE,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const superAdmins = Array.from(new Set(rows.map((r) => parseInt(r.subject_id))));
    return fn({ transaction, rows, superAdmins });
  });
}

// Users whose effective superadmin comes from a direct global binding
async function superAdminUserIds() {
  const { RoleBinding } = models();
  const rows = await RoleBinding.findAll({
    where: SUPERADMIN_WHERE,
    attributes: ["subject_id"],
    raw: true,
  });
  return Array.from(new Set(rows.map((r) => parseInt(r.subject_id))));
}

// Keeps the derived, read-only users.missions_managing column in step with bindings
async function syncLegacyPermission(userId) {
  const { RoleBinding, User, AuthGroupMember } = models();
  const groups = await AuthGroupMember.findAll({
    where: { user_id: userId },
    attributes: ["group_id"],
    raw: true,
  });
  const rows = await RoleBinding.findAll({
    where: {
      [Op.or]: [
        { subject_type: "user", subject_id: String(userId) },
        { subject_type: "audience", subject_id: ["authenticated", "everyone"] },
        ...groups.map((g) => ({ subject_type: "group", subject_id: String(g.group_id) })),
      ],
    },
    raw: true,
  });
  const bindings = rows
    .filter((r) => r.role !== "superadmin" || r.subject_type === "user")
    .map((r) => ({
      role: r.role,
      scope: policy.scopeKey(r.scope_type, r.mission_uuid, r.layer_uuid),
    }));
  const managing = await missions.namesForUUIDs(
    rows
      .filter((r) => r.role === "mission_admin" && r.mission_uuid)
      .map((r) => r.mission_uuid)
  );
  const update = { missions_managing: managing.length ? managing : null };

  // The legacy permission and missions_viewing columns are only ever lowered to match
  // the grants, so rolling back to a release that reads them never gives more access
  const user = await User.findOne({
    where: { id: userId },
    attributes: ["permission", "missions_viewing"],
    raw: true,
  });
  if (user) {
    const superAdmin = bindings.some((b) => b.role === "superadmin" && b.scope === "global");
    // "110" was broadly authorized on older releases, so a demoted SuperAdmin drops to "001"
    if (user.permission === "111" && !superAdmin) update.permission = "001";
    else if (user.permission === "110" && managing.length === 0) update.permission = "001";
    const viewable = policy.missionsWith({ authenticated: true, bindings }, "mission.view");
    if (viewable != null) {
      const names = await missions.namesForUUIDs(viewable);
      const current = user.missions_viewing;
      const lowered = current == null ? names : current.filter((m) => names.includes(m));
      if (current == null || lowered.length !== current.length) update.missions_viewing = lowered;
    }
  }
  // Only the derived columns; never password/username
  await User.update(update, { where: { id: userId }, hooks: false });
}

async function affectedUserIds(subject_type, subject_id) {
  if (subject_type === "user") return [parseInt(subject_id)];
  if (subject_type === "group") {
    const { AuthGroupMember } = models();
    const rows = await AuthGroupMember.findAll({
      where: { group_id: parseInt(subject_id) },
      attributes: ["user_id"],
      raw: true,
    });
    return rows.map((r) => r.user_id);
  }
  if (subject_type === "audience") {
    const { User } = models();
    return (await User.findAll({ attributes: ["id"], raw: true })).map((u) => u.id);
  }
  return [];
}

async function afterChange(subject_type, subject_id) {
  invalidate();
  for (const id of await affectedUserIds(subject_type, subject_id))
    await syncLegacyPermission(id);
}

// actor: principal performing the change
async function addBinding(actor, input) {
  const { RoleBinding, AuthGroup, User } = models();
  const { subject_type, role, scope_type } = input;
  const subject_id = String(input.subject_id);
  if (!policy.SUBJECT_TYPES.includes(subject_type)) throw new BindingError("Invalid subject type.");
  if (!policy.ROLES[role]) throw new BindingError("Invalid role.");
  if (!policy.ROLES[role].scopes.includes(scope_type))
    throw new BindingError(`Role '${role}' cannot be bound at '${scope_type}' scope.`);
  if (subject_type === "audience" && !policy.AUDIENCES.includes(subject_id))
    throw new BindingError("Invalid audience.");
  if (subject_type === "audience" && role !== "viewer")
    throw new BindingError("Audiences may only be granted the viewer role.");
  if (subject_type === "audience" && subject_id === "anonymous")
    throw new BindingError("New grants to 'anonymous' are not allowed. Grant 'everyone' instead.");
  if (role === "superadmin" && subject_type !== "user")
    throw new BindingError("SuperAdmin can only be granted to individual users.");
  if (subject_type === "user" && !(await User.findOne({ where: { id: parseInt(subject_id) }, attributes: ["id"] })))
    throw new BindingError("User not found.");
  if (subject_type === "group" && !(await AuthGroup.findOne({ where: { id: parseInt(subject_id) } })))
    throw new BindingError("Group not found.");

  let mission_uuid = null;
  let layer_uuid = null;
  if (scope_type !== "global") {
    mission_uuid = await missions.uuidForName(input.mission);
    if (!mission_uuid) throw new BindingError("Mission not found.");
  }
  let layerChain = [];
  if (scope_type === "layer") {
    layer_uuid = input.layer_uuid != null ? String(input.layer_uuid) : null;
    const config = await missions.latestConfig(input.mission);
    layerChain = layer_uuid && config ? missions.layerChain(config.layers, layer_uuid) : null;
    if (!layerChain) throw new BindingError("Layer not found in mission.");
  }
  // Nobody grants more than they hold; a grant on a folder covers its children
  const resource = mission_uuid ? { mission: mission_uuid, layers: layerChain } : null;
  for (const cap of policy.ROLES[role].capabilities)
    if (!policy.can(actor, cap, policy.MISSION_SCOPED.has(cap) ? resource : null))
      throw new BindingError("You cannot grant a role with more access than your own.");

  const [row] = await RoleBinding.findOrCreate({
    where: { subject_type, subject_id, role, scope_type, mission_uuid, layer_uuid },
    defaults: { source: "local", created_by_user_id: actor.userId || null },
  });
  await afterChange(subject_type, subject_id);
  return describe(row);
}

async function removeBinding(actor, id) {
  const { RoleBinding } = models();
  const row = await RoleBinding.findOne({ where: { id: parseInt(id) } });
  if (!row) throw new BindingError("Binding not found.");
  if (row.role === "superadmin" && !policy.isSuperAdmin(actor))
    throw new BindingError("Only SuperAdmins may remove SuperAdmin access.");
  const { subject_type, subject_id } = row;
  if (row.role === "superadmin" && row.subject_type === "user" && row.scope_type === "global") {
    await withSuperAdminLock(async ({ transaction, rows, superAdmins }) => {
      const locked = rows.find((r) => r.id === row.id);
      if (!locked) throw new BindingError("Binding not found.");
      const others = superAdmins.filter((u) => u !== parseInt(subject_id));
      const rowsForUser = rows.filter((r) => String(r.subject_id) === String(subject_id)).length;
      if (others.length === 0 && rowsForUser <= 1)
        throw new BindingError("There must always be at least one SuperAdmin.");
      await locked.destroy({ transaction });
    });
  } else await row.destroy();
  await afterChange(subject_type, subject_id);
}

async function listBindings(where = {}) {
  const { RoleBinding } = models();
  const rows = await RoleBinding.findAll({ where, order: [["id", "ASC"]] });
  return Promise.all(rows.map(describe));
}

// Replaces a user's mission-scoped bindings of one role (Users page helper)
async function setUserMissionRole(actor, userId, role, missionNames) {
  const { RoleBinding } = models();
  const existing = await RoleBinding.findAll({
    where: { subject_type: "user", subject_id: String(userId), role, scope_type: "mission" },
  });
  const wanted = new Set(missionNames || []);
  for (const row of existing) {
    const name = await missions.nameForUUID(row.mission_uuid);
    if (wanted.has(name)) wanted.delete(name);
    else await removeBinding(actor, row.id);
  }
  for (const m of wanted)
    await addBinding(actor, { subject_type: "user", subject_id: userId, role, scope_type: "mission", mission: m });
}

// Initial bindings for a newly created local account. Not actor-checked:
// callers have already authorized account creation.
async function seedNewUser(userId, { superadmin = false, missionsViewing = null } = {}) {
  const { RoleBinding } = models();
  const base = { subject_type: "user", subject_id: String(userId), source: "local" };
  const rows = [];
  if (superadmin) rows.push({ ...base, role: "superadmin", scope_type: "global" });
  else if (missionsViewing == null) rows.push({ ...base, role: "viewer", scope_type: "global" });
  else
    for (const name of missionsViewing) {
      const uuid = await missions.uuidForName(name);
      if (uuid) rows.push({ ...base, role: "viewer", scope_type: "mission", mission_uuid: uuid });
    }
  if (rows.length) await RoleBinding.bulkCreate(rows);
  await afterChange("user", userId);
}

module.exports = {
  BindingError,
  seedNewUser,
  addBinding,
  removeBinding,
  listBindings,
  setUserMissionRole,
  syncLegacyPermission,
  superAdminUserIds,
  withSuperAdminLock,
  afterChange,
};
