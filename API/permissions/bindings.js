// Role binding management shared by the Access and Accounts routes
const { Op } = require("sequelize");
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

// Users whose effective superadmin comes from a direct global binding
async function superAdminUserIds() {
  const { RoleBinding } = models();
  const rows = await RoleBinding.findAll({
    where: { subject_type: "user", role: "superadmin", scope_type: "global" },
    attributes: ["subject_id"],
    raw: true,
  });
  return rows.map((r) => parseInt(r.subject_id));
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
        ...groups.map((g) => ({ subject_type: "group", subject_id: String(g.group_id) })),
      ],
    },
    raw: true,
  });
  const bindings = rows.map((r) => ({
    role: r.role,
    scope: policy.scopeKey(r.scope_type, r.mission_uuid, r.layer_uuid),
  }));
  const managing = await missions.namesForUUIDs(
    rows
      .filter((r) => r.role === "mission_admin" && r.mission_uuid)
      .map((r) => r.mission_uuid)
  );
  // Only the derived columns; never password/username
  await User.update(
    {
      missions_managing: managing.length ? managing : null,
    },
    { where: { id: userId }, hooks: false }
  );
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
  if (scope_type === "layer") {
    layer_uuid = input.layer_uuid != null ? String(input.layer_uuid) : null;
    const config = await missions.latestConfig(input.mission);
    if (!layer_uuid || !config || !missions.layerChain(config.layers, layer_uuid))
      throw new BindingError("Layer not found in mission.");
  }
  // Nobody grants more than they hold
  const resource = mission_uuid
    ? { mission: mission_uuid, layers: layer_uuid ? [layer_uuid] : [] }
    : null;
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
  if (row.role === "superadmin" && row.subject_type === "user" && row.scope_type === "global") {
    const ids = await superAdminUserIds();
    if (ids.length <= 1) throw new BindingError("There must always be at least one SuperAdmin.");
  }
  const { subject_type, subject_id } = row;
  await row.destroy();
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
  afterChange,
};
