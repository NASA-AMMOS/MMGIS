const express = require("express");
const router = express.Router();
const logger = require("../../../../../API/logger");
const policy = require("../../../../../API/permissions/policy");
const missions = require("../../../../../API/permissions/missions");
const bindings = require("../../../../../API/permissions/bindings");
const { authorize, ensurePrincipal } = require("../../../../../API/permissions/authorize");
const { invalidate, userPrincipal } = require("../../../../../API/permissions/principal");
const { AuthGroup, AuthGroupMember } = require("../../../../../API/permissions/models");
const { User } = require("../../Users/models/user");
const providers = require("../../../../../API/permissions/providers");

const manage = authorize("groups.manage");

function fail(res, err, message) {
  if (err instanceof bindings.BindingError)
    return res.send({ status: "failure", message: err.message });
  logger("error", message, "permissions", null, err);
  res.send({ status: "failure", message });
}

async function summarize(principal) {
  const scoped = {};
  for (const cap of policy.MISSION_SCOPED) {
    const uuids = policy.missionsWith(principal, cap);
    scoped[cap] = uuids == null ? null : await missions.namesForUUIDs(uuids);
  }
  const layerScoped = {};
  for (const b of principal.bindings || [])
    if (b.scope.startsWith("layer:")) {
      const [, m, l] = b.scope.split(":");
      const name = await missions.nameForUUID(m);
      if (name) (layerScoped[name] = layerScoped[name] || []).push(l);
    }
  return {
    kind: principal.kind,
    username: principal.username || null,
    authenticated: !!principal.authenticated,
    superadmin: policy.isSuperAdmin(principal),
    role: policy.accountRole(principal.bindings || []),
    capabilities: policy.capabilitiesOf(principal),
    missions: scoped,
    layers: layerScoped,
    token: principal.token || null,
  };
}

router.get("/me", authorize.public("returns the caller's own permissions"), async (req, res) => {
  try {
    res.send({ status: "success", body: await summarize(await ensurePrincipal(req)) });
  } catch (err) {
    fail(res, err, "Failed to get permissions.");
  }
});

router.get("/roles", authorize("site.view"), (req, res) => {
  res.send({
    status: "success",
    body: {
      capabilities: policy.CAPABILITIES,
      readCapabilities: policy.READ_CAPABILITIES,
      roles: policy.ROLES,
      audiences: policy.AUDIENCES,
    },
  });
});

router.get("/groups", manage, async (req, res) => {
  try {
    const groups = await AuthGroup.findAll({ order: [["name", "ASC"]], raw: true });
    const members = await AuthGroupMember.findAll({ raw: true });
    const users = await User.findAll({ attributes: ["id", "username"], raw: true });
    const names = Object.fromEntries(users.map((u) => [u.id, u.username]));
    res.send({
      status: "success",
      body: groups.map((g) => ({
        ...g,
        members: members
          .filter((m) => m.group_id === g.id)
          .map((m) => ({ id: m.user_id, username: names[m.user_id] })),
      })),
    });
  } catch (err) {
    fail(res, err, "Failed to get groups.");
  }
});

router.post("/groups/create", manage, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) throw new bindings.BindingError("A group name is required.");
    // Non-local groups get their members from a login provider's group claims
    const source =
      req.body.source !== "local" &&
      providers.availableProviders().includes(req.body.source)
        ? req.body.source
        : "local";
    const group = await AuthGroup.create({
      name,
      description: req.body.description || null,
      source,
      external_name: source !== "local" ? req.body.external_name || name : null,
    });
    invalidate();
    res.send({ status: "success", body: group });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError")
      return res.send({ status: "failure", message: "A group with that name already exists." });
    fail(res, err, "Failed to create group.");
  }
});

async function assertHoldsGroupRoles(actor, groupId) {
  const groupBindings = await bindings.listBindings({ subject_type: "group", subject_id: String(groupId) });
  for (const b of groupBindings)
    for (const cap of policy.ROLES[b.role].capabilities)
      if (!policy.can(actor, cap, b.mission_uuid ? { mission: b.mission_uuid, layers: b.layer_uuid ? [b.layer_uuid] : [] } : null))
        throw new bindings.BindingError("You cannot grant a role with more access than your own.");
}

router.post("/groups/update", manage, async (req, res) => {
  try {
    const group = await AuthGroup.findOne({ where: { id: parseInt(req.body.id) } });
    if (!group) throw new bindings.BindingError("Group not found.");
    const set = {};
    ["name", "description", "external_name"].forEach((k) => {
      if (req.body[k] !== undefined) set[k] = req.body[k];
    });
    // Pointing a provider group elsewhere grants its roles to new people
    if (set.external_name !== undefined && set.external_name !== group.external_name)
      await assertHoldsGroupRoles(await ensurePrincipal(req), group.id);
    await group.update(set);
    invalidate();
    res.send({ status: "success", body: group });
  } catch (err) {
    fail(res, err, "Failed to update group.");
  }
});

router.post("/groups/delete", manage, async (req, res) => {
  try {
    const actor = await ensurePrincipal(req);
    const id = parseInt(req.body.id);
    const group = await AuthGroup.findOne({ where: { id } });
    if (!group) throw new bindings.BindingError("Group not found.");
    for (const b of await bindings.listBindings({ subject_type: "group", subject_id: String(id) }))
      await bindings.removeBinding(actor, b.id);
    const members = await AuthGroupMember.findAll({ where: { group_id: id }, raw: true });
    await group.destroy();
    for (const m of members) await bindings.syncLegacyPermission(m.user_id);
    invalidate();
    res.send({ status: "success" });
  } catch (err) {
    fail(res, err, "Failed to delete group.");
  }
});

async function changeMember(req, res, add) {
  try {
    const actor = await ensurePrincipal(req);
    const group_id = parseInt(req.body.group_id);
    const user_id = parseInt(req.body.user_id);
    const group = await AuthGroup.findOne({ where: { id: group_id } });
    if (!group) throw new bindings.BindingError("Group not found.");
    if (group.source !== "local")
      throw new bindings.BindingError("Membership of this group comes from the login provider.");
    if (!(await User.findOne({ where: { id: user_id }, attributes: ["id"] })))
      throw new bindings.BindingError("User not found.");
    // Adding someone to a group grants its roles, so the actor must hold them
    if (add) await assertHoldsGroupRoles(actor, group_id);
    if (add) await AuthGroupMember.findOrCreate({ where: { group_id, user_id } });
    else await AuthGroupMember.destroy({ where: { group_id, user_id } });
    await bindings.syncLegacyPermission(user_id);
    invalidate();
    res.send({ status: "success" });
  } catch (err) {
    fail(res, err, "Failed to change group membership.");
  }
}
router.post("/groups/members/add", manage, (req, res) => changeMember(req, res, true));
router.post("/groups/members/remove", manage, (req, res) => changeMember(req, res, false));

router.get("/bindings", manage, async (req, res) => {
  try {
    const where = {};
    if (req.query.subject_type) where.subject_type = String(req.query.subject_type);
    if (req.query.subject_id != null) where.subject_id = String(req.query.subject_id);
    res.send({ status: "success", body: await bindings.listBindings(where) });
  } catch (err) {
    fail(res, err, "Failed to get role bindings.");
  }
});

router.post("/bindings/add", manage, async (req, res) => {
  try {
    const body = await bindings.addBinding(await ensurePrincipal(req), req.body || {});
    res.send({ status: "success", body });
  } catch (err) {
    fail(res, err, "Failed to add role binding.");
  }
});

router.post("/bindings/remove", manage, async (req, res) => {
  try {
    await bindings.removeBinding(await ensurePrincipal(req), req.body.id);
    res.send({ status: "success" });
  } catch (err) {
    fail(res, err, "Failed to remove role binding.");
  }
});

// Effective access for a user and where each binding comes from
router.get("/effective", manage, async (req, res) => {
  try {
    const principal = await userPrincipal(parseInt(req.query.user_id));
    if (!principal) throw new bindings.BindingError("User not found.");
    const detailed = [];
    for (const b of principal.bindings) {
      const [row] = await bindings.listBindings({ id: b.id });
      if (row) detailed.push(row);
    }
    const groups = principal.groupIds.length
      ? await AuthGroup.findAll({ where: { id: principal.groupIds }, attributes: ["id", "name"], raw: true })
      : [];
    res.send({
      status: "success",
      body: { ...(await summarize(principal)), bindings: detailed, groups },
    });
  } catch (err) {
    fail(res, err, "Failed to get effective access.");
  }
});

router.get("/missions", authorize("groups.manage"), async (req, res) => {
  res.send({ status: "success", body: await missions.all() });
});

module.exports = router;
