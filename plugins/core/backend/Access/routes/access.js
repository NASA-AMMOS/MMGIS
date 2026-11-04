const express = require("express");
const router = express.Router();

// Cookie-authenticated changes must come from MMGIS's own pages
const { sameOriginOnly } = require("../../../../../API/connections/routes");
router.use((req, res, next) => (req.method === "GET" || req.method === "HEAD" ? next() : sameOriginOnly(req, res, next)));
const logger = require("../../../../../API/logger");
const policy = require("../../../../../API/permissions/policy");
const missions = require("../../../../../API/permissions/missions");
const bindings = require("../../../../../API/permissions/bindings");
const { authorize, ensurePrincipal } = require("../../../../../API/permissions/authorize");
const { invalidate, userPrincipal, externalPrincipal } = require("../../../../../API/permissions/principal");
const { AuthGroup, AuthGroupMember, AuthIdentity, AuthMeta } = require("../../../../../API/permissions/models");
const Sequelize = require("sequelize");
const { User } = require("../../Users/models/user");
const providers = require("../../../../../API/permissions/providers");
const siteAccess = require("../../../../../API/permissions/siteAccess");

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
    const external = source !== "local" ? providers.groupName(source, req.body.external_name || name) : null;
    if (external && external.length > 255) throw new bindings.BindingError("The provider group name can be at most 255 characters.");
    const group = await AuthGroup.create({
      name,
      description: req.body.description || null,
      source,
      external_name: external,
    });
    invalidate();
    const note = source !== "local" ? await fillProviderGroups(group).catch(noteFailed) : undefined;
    res.send({ status: "success", body: group, note });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError")
      return res.send({ status: "failure", message: "A group with that name already exists." });
    fail(res, err, "Failed to create group.");
  }
});

// A new or renamed provider group gets its members from the people already signed in, not only at their next sign-in.
// Resolves to a note for the admin when that can't happen now, or another group already maps the same provider group.
// The group is saved by then, so a failed note mustn't report the save as failed
const noteFailed = (err) => {
  logger("warn", "Couldn't check a provider group's members from its directory.", "access", null, err);
  return undefined;
};

async function fillProviderGroups(group) {
  const source = group.source;
  const notes = [];
  const same = await AuthGroup.findAll({ where: { source, external_name: group.external_name, id: { [Sequelize.Op.ne]: group.id } }, attributes: ["name"], order: [["name", "ASC"]], raw: true });
  if (same.length)
    notes.push(`${same.length === 1 ? "Group" : "Groups"} ${same.map((g) => `'${g.name}'`).join(", ")} also ${same.length === 1 ? "gets its" : "get their"} members from ${group.external_name}, so the roles of all of them apply to those people.`);
  if (providers.fillsOnlyAtSignIn(source))
    notes.push("Rechecks are off (AUTH_RECHECK_MINUTES=0), so this group fills as its members sign in. To fill it now, click Check linked accounts in People.");
  const warn = (err) => logger("warn", "Couldn't fill a provider group from its directory now; click Check linked accounts in People once it can be reached, or members join at their next sign-in or recheck.", "access", null, err);
  providers
    .fillGroups(source)
    .then((r) => r && r.failed > 0 && warn(new Error(`${r.failed} linked account(s) couldn't be checked`)))
    .catch(warn);
  return notes.length ? notes.join(" ") : undefined;
}

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
    if (set.external_name != null && group.source !== "local") set.external_name = providers.groupName(group.source, set.external_name);
    if (set.external_name != null && String(set.external_name).length > 255)
      throw new bindings.BindingError("The provider group name can be at most 255 characters.");
    // Pointing a provider group elsewhere grants its roles to new people
    if (set.external_name !== undefined && set.external_name !== group.external_name)
      await assertHoldsGroupRoles(await ensurePrincipal(req), group.id);
    const repointed = group.source !== "local" && set.external_name !== undefined && set.external_name !== group.external_name;
    await group.update(set);
    invalidate();
    const note = repointed ? await fillProviderGroups(group).catch(noteFailed) : undefined;
    res.send({ status: "success", body: group, note });
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
    const groupBindings = await bindings.listBindings({ subject_type: "group", subject_id: String(id) });
    await bindings.assertCanRemoveIds(actor, groupBindings.map((b) => b.id));
    for (const b of groupBindings) await bindings.removeBinding(actor, b.id);
    const members = await AuthGroupMember.findAll({ where: { group_id: id }, raw: true });
    await group.destroy();
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
    // Provider users have no account row; check them by provider, username and group claims
    if (req.query.provider) {
      const external = siteAccess.getProviders().filter((p) => p !== "local");
      if (!external.includes(String(req.query.provider)))
        throw new bindings.BindingError("That login provider isn't enabled on this site.");
      if (!String(req.query.username || "").trim())
        throw new bindings.BindingError("Enter a username.");
    }
    // With no groups typed, ask the provider which groups it reports for that person now
    let reported;
    let target;
    if (req.query.provider && !String(req.query.groups || "").trim()) {
      const provider = String(req.query.provider);
      const username = String(req.query.username).trim();
      try {
        target = await providers.reportedGroups(provider, username);
      } catch (err) {
        logger("error", `Couldn't look up '${username}' at ${provider} to check their access.`, "access", req, err);
        throw new bindings.BindingError(`Couldn't look up '${username}' at ${provider}: it's unreachable or refused its service account (see the server log). Enter their groups instead.`);
      }
      if (target) reported = target.groups;
      if (target === null)
        throw new bindings.BindingError(`${provider} has no single entry with the username '${username}', or it's disabled or left out by its user search filter.`);
    }
    // The access shown is a sign-in with no account yet; an account already holding the name changes that
    // Accounts follow the directory entry, not its username: a renamed person keeps their account, and a
    // newcomer given a leaver's username is refused
    let note;
    if (target) {
      const provider = String(req.query.provider);
      const owner = await AuthIdentity.findOne({ where: { provider, subject: target.subject }, attributes: ["user_id"], raw: true });
      const account = owner && (await User.findOne({ where: { id: owner.user_id }, attributes: ["username"], raw: true }));
      if (account) note = `MMGIS account '${account.username}' signs in as this person, and its own grants (see People) add to what's shown here.`;
      else {
        // New accounts are named by the directory, so an alias typed here (mail, UPN) checks the real name
        const name = target.username || providers.relinkUsername(provider, String(req.query.username));
        // As at sign-in: a pending relink (whichever account it's on) comes before a username clash
        const claim = await providers.findClaim({ provider, subject: target.subject, username: name }, { AuthMeta });
        const claimed = claim && (await User.findOne({ where: { id: claim.userId }, attributes: ["username"], raw: true }));
        const taken = !claimed && (await providers.usernameTaken(name));
        const holder = taken && (await User.findOne({ where: { id: taken.id }, attributes: ["id", "username"], raw: true }));
        const linked = holder && (await AuthIdentity.findOne({ where: { user_id: holder.id, provider }, raw: true }));
        if (claimed)
          note = `A relink is pending: this person's next sign-in takes over account '${claimed.username}', and its own grants (see People) add to what's shown here.`;
        else if (linked)
          note = `Account '${holder.username}' is linked to a different ${provider} entry that had this username, so this person's sign-in is refused. Don't relink it to them if that entry still exists (the name was reused); the server log at their sign-in says which. What's shown leaves out that account's own grants.`;
        else if (holder)
          note = `Account '${holder.username}' already has this username, so this person's ${provider} sign-in is refused until that account is relinked (People > Allow relink) or deleted. What's shown leaves out that account's own grants.`;
      }
    }
    if (target && target.groupsLeftOut && target.groupsLeftOut.length) {
      const left = `Left out, having no group name attribute (LDAP_GROUP_NAME_ATTRIBUTE): ${target.groupsLeftOut.join(" | ")}.`;
      note = note ? `${note} ${left}` : left;
    }
    const principal = req.query.provider
      ? await externalPrincipal({
          provider: String(req.query.provider),
          username: String(req.query.username || "").trim(),
          // One group per line; a line with "=" is one DN (which may hold escaped , and ;), other lines may
          // list names separated by commas or semicolons
          groups:
            reported ||
            String(req.query.groups || "")
              .split("\n")
              .flatMap((line) => (line.includes("=") ? [line] : line.split(/[,;]/)))
              .map((g) => g.trim())
              .filter((g) => g)
              .map((g) => providers.groupName(String(req.query.provider), g)),
        })
      : await userPrincipal(parseInt(req.query.user_id));
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
      body: { ...(await summarize(principal)), bindings: detailed, groups, reported, note },
    });
  } catch (err) {
    fail(res, err, "Failed to get effective access.");
  }
});

router.get("/missions", authorize("groups.manage"), async (req, res) => {
  res.send({ status: "success", body: await missions.all() });
});

module.exports = router;
