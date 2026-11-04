/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

// Cookie-authenticated changes must come from MMGIS's own pages
const { sameOriginOnly } = require("../../../../../API/connections/routes");
router.use((req, res, next) => (req.method === "GET" || req.method === "HEAD" ? next() : sameOriginOnly(req, res, next)));
const { authorize, resolvers } = require("../../../../../API/permissions/authorize");
const crypto = require("crypto");
const { Op } = require("sequelize");

const logger = require("../../../../../API/logger");
const userModel = require("../../Users/models/user");
const { clearViewableFoldersCache } = require("../../Config/routes/configs");
const bindings = require("../../../../../API/permissions/bindings");
const policy = require("../../../../../API/permissions/policy");
const missions = require("../../../../../API/permissions/missions");
const { ensurePrincipal } = require("../../../../../API/permissions/authorize");
const { RoleBinding, AuthIdentity, AuthMeta } = require("../../../../../API/permissions/models");
const providers = require("../../../../../API/permissions/providers");
const { LongTermTokens } = require("../../LongTermToken/models/longtermtokens");
const connections = require("../../../../../API/connections");
const { apilimiter, resetFailedLogins } = require("../../../../../scripts/rateLimiters");
const User = userModel.User;
const {
  UserDefaults,
  getDefaultMissionsViewing,
} = require("../../Users/models/userdefaults");

router.get("/entries", authorize("accounts.manage"), function (req, res) {
  User.findAll({
    attributes: [
      "id",
      "username",
      "email",
      "createdAt",
      "updatedAt",
    ],
    order: [["id", "ASC"]],
    raw: true,
  })
    .then(async (users) => {
      const userBindings = await RoleBinding.findAll({
        where: { subject_type: "user" },
        attributes: ["subject_id", "role", "scope_type"],
        raw: true,
      });
      const signIns = {};
      for (const l of await AuthIdentity.findAll({
        attributes: ["user_id", "provider", "username", "last_login_at"],
        raw: true,
      }))
        (signIns[l.user_id] = signIns[l.user_id] || []).push({
          provider: l.provider,
          username: l.username,
          last_login_at: l.last_login_at,
        });
      const missing = {};
      for (const r of await AuthMeta.findAll({ where: { key: { [Op.like]: "missing:%" } }, raw: true }))
        missing[r.key.slice("missing:".length)] = r.value && r.value.since;
      for (const [userId, list] of Object.entries(signIns))
        list.forEach((l) => (l.missing_since = missing[`${l.provider}:${userId}`] || null));
      const relinks = {};
      for (const r of await AuthMeta.findAll({ where: { key: { [Op.like]: "relink:%" } }, raw: true })) {
        const [, provider, userId] = r.key.split(":");
        if (r.value && Date.parse(r.value.expires_at) > Date.now())
          relinks[userId] = { provider, username: r.value.username, dn: r.value.dn, expires_at: r.value.expires_at, stale: r.value.stale || null };
      }
      const byUser = {};
      for (const b of userBindings)
        (byUser[b.subject_id] = byUser[b.subject_id] || []).push({
          role: b.role,
          scope: b.scope_type === "global" ? "global" : b.scope_type,
        });
      res.send({
        status: "success",
        body: {
          entries: users.map((u) => ({
            ...u,
            role: policy.accountRole(byUser[String(u.id)] || []),
            sign_ins: signIns[u.id] || [],
            relink: relinks[u.id] || null,
          })),
        },
      });
    })
    .catch((err) => {
      logger("error", "Failed to get user entries.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: `Failed to get user entries.`,
      });
    });
});

router.delete("/remove/:id", authorize("accounts.manage"), function (req, res, next) {
  const id = parseInt(req.params.id);
  let grants = [];

  if (isNaN(id)) {
    logger(
      "error",
      `Failed to delete user. User Id is null.`,
      "accounts",
      null
    );
    res.send({
      status: "failure",
      message: `Failed to delete user. User Id is null.`,
    });
    return null;
  }
  bindings
    .withSuperAdminLock(async ({ transaction, superAdmins }) => {
      if (superAdmins.includes(id) && superAdmins.length <= 1) {
        res.send({
          status: "failure",
          message: "There must always be at least one SuperAdmin.",
        });
        return null;
      }
      const actor = await ensurePrincipal(req);
      if (superAdmins.includes(id) && !policy.isSuperAdmin(actor)) {
        res.send({
          status: "failure",
          message: "Only SuperAdmins may delete SuperAdmin accounts.",
        });
        return null;
      }
      await RoleBinding.destroy({
        where: { subject_type: "user", subject_id: String(id) },
        transaction,
      });
      // A user's tokens act with that user's authority, so they go with the account
      await LongTermTokens.destroy({ where: { created_by_user_id: id }, transaction });
      await AuthMeta.destroy({
        where: { [Op.or]: [{ key: { [Op.like]: `relink:%:${id}` } }, { key: { [Op.like]: `missing:%:${id}` } }] },
        transaction,
      });
      // Its connections go with it (cascade); read them first to revoke them at each service
      grants = await connections.accountGrants(id, { transaction }).catch(() => []);
      // Inside the lock, so a SuperAdmin grant can't be added for the account meanwhile
      await User.destroy({ where: { id: id }, transaction });
      return true;
    })
    .then((deleted) => {
      if (!deleted) return;
      connections.revokeGrants(grants);
      bindings.afterChange("user", id).catch(() => {});
      logger("info", `Successfully deleted user with id: '${id}'.`);
      res.send({
        status: "success",
        message: `Successfully deleted user with id: '${id}'.`,
        body: {
          deleted_id: id,
        },
      });
    })
    .catch((err) => {
      logger("error", `Failed to delete user with id: '${id}'.`, "accounts", null, err);
      res.send({ status: "failure", message: `Failed to delete user with id: '${id}'.` });
    });
  return null;
});

router.post("/update", authorize("accounts.manage"), function (req, res, next) {
  let id = null;
  if (req.body.hasOwnProperty("id") && req.body.id != null) {
    id = parseInt(req.body.id);
  }

  if (isNaN(id) || id == null) {
    logger(
      "error",
      `Failed to update user. User Id is null.`,
      "accounts",
      null
    );
    res.send({
      status: "failure",
      message: `Failed to update user. User Id is null.`,
    });
    return null;
  }

  updateUser(req, id)
    .then(() => {
      clearViewableFoldersCache(id);
      res.send({
        status: "success",
        message: `Successfully updated user with id: '${id}'.`,
        body: {
          updated_id: id,
        },
      });
    })
    .catch((err) => {
      if (err instanceof bindings.BindingError) {
        res.send({ status: "failure", message: err.message, body: {} });
        return;
      }
      logger(
        "error",
        `Failed to update user with id: '${id}'. Email may already exist.`,
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: `Failed updated user with id: '${id}'. Email may already exist.`,
        body: {},
      });
    });
});

// Fields of the pre-role-binding API. Refused rather than ignored, so an old client learns its change didn't happen.
const LEGACY_FIELDS = ["role", "missions_managing", "missions_viewing"];

// Applies email, and `viewing` (null: every mission; a list: only those) as the user's own viewer grants.
// Other roles are granted in Users & Access (/api/access).
async function updateUser(req, id) {
  const actor = await ensurePrincipal(req);
  const body = req.body || {};
  const legacy = LEGACY_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(body, f));
  if (legacy.length)
    throw new bindings.BindingError(
      `${legacy.join(", ")} ${legacy.length > 1 ? "are" : "is"} no longer accepted: send viewing, and grant roles with /api/access/bindings/add.`
    );
  const user = await User.findOne({ where: { id }, attributes: ["id"] });
  if (!user) throw new bindings.BindingError("User not found.");

  // Validate everything up front so a rejected update changes nothing
  const changesViewing =
    Object.prototype.hasOwnProperty.call(body, "viewing") &&
    (body.viewing === null || Array.isArray(body.viewing));
  const viewing = changesViewing && Array.isArray(body.viewing) ? body.viewing.filter((m) => typeof m === "string") : null;
  if (changesViewing && !policy.isSuperAdmin(actor))
    throw new bindings.BindingError("Only SuperAdmins may change what a user can view.");
  if (body.email === "") body.email = null;
  const clearEmail = Object.prototype.hasOwnProperty.call(body, "email") && body.email === null;
  if (body.email != null) {
    await User.build({ email: body.email }).validate({ fields: ["email"] }).catch(() => {
      throw new bindings.BindingError("Invalid email.");
    });
    if (await User.findOne({ where: { email: body.email, id: { [Op.ne]: id } }, attributes: ["id"] }))
      throw new bindings.BindingError("Email already in use.");
  }
  for (const name of viewing || [])
    if (!(await missions.uuidForName(name))) throw new bindings.BindingError(`Mission not found: ${name}`);

  if (changesViewing) {
    const existing = await RoleBinding.findAll({ where: { subject_type: "user", subject_id: String(id) } });
    if (viewing == null)
      await bindings.addBinding(actor, { subject_type: "user", subject_id: id, role: "viewer", scope_type: "global" });
    else {
      const globalViewer = existing.filter((b) => b.role === "viewer" && b.scope_type === "global");
      await bindings.assertCanRemoveIds(actor, globalViewer.map((b) => b.id));
      for (const b of globalViewer) await bindings.removeBinding(actor, b.id);
    }
    await bindings.setUserMissionRole(actor, id, "viewer", viewing || []);
  }
  if (body.email != null || clearEmail)
    // Only the email column; never password/username
    await User.update({ email: body.email }, { where: { id }, hooks: false });
  await bindings.afterChange("user", id);
}

// Site-wide default missions_viewing stamped onto new accounts (applies in every SITE_ACCESS mode)
router.get("/defaults", authorize("accounts.manage"), function (req, res) {
  getDefaultMissionsViewing()
    .then((missions_viewing) => {
      res.send({
        status: "success",
        body: { missions_viewing },
      });
    })
    .catch((err) => {
      logger("error", "Failed to get account defaults.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to get account defaults.",
      });
    });
});

router.post("/updateDefaults", authorize("accounts.manage"), function (req, res) {
  if (
    req.body.missions_viewing !== null &&
    !Array.isArray(req.body.missions_viewing)
  ) {
    res.send({
      status: "failure",
      message: "missions_viewing must be null or an array of mission names.",
    });
    return;
  }
  const missions_viewing =
    req.body.missions_viewing == null
      ? null
      : req.body.missions_viewing.filter((m) => typeof m === "string");

  UserDefaults.upsert({ id: 1, missions_viewing })
    .then(() => {
      logger("info", "Updated account defaults.", req.originalUrl, req);
      res.send({
        status: "success",
        body: { missions_viewing },
      });
    })
    .catch((err) => {
      logger("error", "Failed to update account defaults.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to update account defaults.",
      });
    });
});

// Lets the next login through a provider with this account's username take the account over,
// once, within RELINK_HOURS. For accounts whose provider identity changed (directory rebuild) or
// local accounts moving to a provider. Both take { id, provider }.
const relinkFail = (res, message, status = 200) => res.status(status).send({ status: "failure", message });

// The account and provider a relink request is about, or undefined after answering with the problem
async function relinkRequest(req, res) {
  if (req.principal && req.principal.kind === "token")
    return void relinkFail(res, "Relinking can only be changed from a signed-in session.", 403);
  const id = parseInt(req.body.id);
  const provider = String(req.body.provider || "");
  if (isNaN(id)) return void relinkFail(res, "Account id is missing.");
  if (provider === "local" || !providers.enabledProviders().some((p) => p.id === provider))
    return void relinkFail(res, `'${provider}' isn't an enabled login provider.`);
  const user = await User.findOne({ where: { id }, attributes: ["id", "username"], raw: true });
  if (!user) return void relinkFail(res, "User not found.");
  return { id, provider, user, key: providers.relinkKey(provider, id), actor: await ensurePrincipal(req) };
}

router.post("/cancelRelink", apilimiter, authorize("accounts.manage"), async function (req, res) {
  try {
    const r = await relinkRequest(req, res);
    if (!r) return;
    await AuthMeta.destroy({ where: { key: r.key } });
    logger("info", `'${r.actor.username}' cancelled the ${r.provider} relink for account ${r.id} '${r.user.username}'.`, "accounts", req);
    res.send({ status: "success", message: "Relink cancelled." });
  } catch (err) {
    logger("error", "Failed to cancel relinking.", req.originalUrl, req, err);
    relinkFail(res, "Failed to cancel relinking.");
  }
});

router.post("/allowRelink", apilimiter, authorize("accounts.manage"), async function (req, res) {
  const fail = (message, status = 200) => relinkFail(res, message, status);
  try {
    const r = await relinkRequest(req, res);
    if (!r) return;
    const { id, provider, user, key, actor } = r;
    // The person's username at the provider, when it differs from their MMGIS username
    const known = await AuthIdentity.findOne({ where: { user_id: id, provider }, attributes: ["username"], raw: true });
    const fallback = (known && known.username) || user.username;
    const username = String(req.body.username == null || req.body.username === "" ? fallback : req.body.username)
      .normalize("NFKC")
      .trim();
    if (username === "" || username.length > 256 || /[\u0000-\u001f\u007f]/.test(username))
      return fail("Enter the person's username at the login provider.");
    // The account's grants carry over, so a SuperAdmin account can only be handed over by a SuperAdmin
    const superAdmins = (
      await RoleBinding.findAll({
        where: { subject_type: "user", role: "superadmin", scope_type: "global" },
        attributes: ["subject_id"],
        raw: true,
      })
    ).map((b) => parseInt(b.subject_id));
    if (superAdmins.includes(id) && !policy.isSuperAdmin(actor))
      return fail("Only SuperAdmins may allow relinking a SuperAdmin account.");
    // Pin the claim to the entry that has this username now, so a look-alike entry made later can't take it
    let target;
    try {
      target = await providers.relinkTarget(provider, username);
    } catch (err) {
      logger("error", `Couldn't look up '${username}' at ${provider} to allow a relink.`, "accounts", req, err);
      return fail(`Couldn't reach ${provider} to look up '${username}'. Try again later.`);
    }
    if (target === null) return fail(`${provider} has no single entry with the username '${username}'.`);
    const expires_at = new Date(Date.now() + providers.RELINK_HOURS * 3600000).toISOString();
    // Checked and saved under the SuperAdmin lock, so two relinks allowed at once can't move every local SuperAdmin
    const refusal = await bindings.withSuperAdminLock(async ({ transaction, superAdmins: current }) => {
      const pending = (await AuthMeta.findAll({ where: { key: { [Op.like]: "relink:%" } }, raw: true, transaction })).filter(
        (r) => r.key !== key && r.value && Date.parse(r.value.expires_at) > Date.now()
      );
      // Keep a SuperAdmin who signs in with an MMGIS password, for when the provider is down
      if (current.includes(id)) {
        const linked = new Set(
          (await AuthIdentity.findAll({ where: { user_id: current }, attributes: ["user_id"], raw: true, transaction })).map((l) => l.user_id)
        );
        // Another SuperAdmin's pending relink counts as linked, so two relinks can't move every one
        for (const r of pending) linked.add(parseInt(r.key.split(":").pop(), 10));
        const local = current.filter((u) => !linked.has(u));
        if (local.length === 1 && local[0] === id)
          return "This is the only SuperAdmin that signs in with an MMGIS password. Make another one first, so someone can still sign in if the login provider is down.";
      }
      const sameProvider = pending.filter((r) => r.key.startsWith(`relink:${provider}:`));
      if (sameProvider.some((r) => providers.sameUsername(r.value.username, username)))
        return `Another account is already waiting for the ${provider} login '${username}'. Cancel that relink first.`;
      // A login of an entry already linked elsewhere goes to that account, so this claim would never happen
      if (target) {
        const other = await AuthIdentity.findOne({ where: { provider, subject: target.subject }, attributes: ["user_id"], raw: true, transaction });
        if (other && other.user_id === id) return `'${user.username}' already signs in with ${target.dn}, so there is nothing to relink.`;
        if (other) {
          const owner = await User.findOne({ where: { id: other.user_id }, attributes: ["username"], raw: true, transaction });
          return `${target.dn} already signs in to account ${other.user_id}${owner ? ` '${owner.username}'` : ""}. Delete that account first if this one should take it over.`;
        }
        if (sameProvider.some((r) => r.value.subject === target.subject))
          return `Another account is already waiting for ${target.dn}. Cancel that relink first.`;
      }
      await AuthMeta.upsert(
        { key, value: { username, subject: target ? target.subject : undefined, dn: target ? target.dn : undefined, expires_at, by: actor.username } },
        { transaction }
      );
      return null;
    });
    if (refusal) return fail(refusal);
    // Attempts refused before the admin got to this account no longer block the person
    resetFailedLogins(username);
    resetFailedLogins(user.username);
    logger(
      "warn",
      `'${actor.username}' allowed the next ${provider} login as '${username}'${target ? ` (${target.dn}, subject '${target.subject}')` : ""} to claim account ${id} '${user.username}' until ${expires_at}.`,
      "accounts",
      req
    );
    res.send({ status: "success", message: "Relink allowed.", body: { provider, username, dn: target ? target.dn : null, expires_at } });
  } catch (err) {
    logger("error", "Failed to allow relinking.", req.originalUrl, req, err);
    fail("Failed to allow relinking.");
  }
});

// Asks each login provider about every account linked to it, e.g. after a directory migration
router.post("/recheckLinked", apilimiter, authorize("accounts.manage"), async function (req, res) {
  try {
    const result = await providers.recheckLinked();
    logger(
      result.failed ? "warn" : "info",
      `Rechecked ${result.checked} provider-linked accounts; ${result.missing} not found${result.failed ? `, ${result.failed} couldn't be checked (see the earlier warnings)` : ""}.`,
      "accounts",
      req
    );
    res.send({ status: "success", body: result });
  } catch (err) {
    logger("error", "Failed to recheck provider-linked accounts.", req.originalUrl, req, err);
    res.send({ status: "failure", message: "Failed to check the linked accounts." });
  }
});

router.post("/generateResetPasswordLink", authorize("accounts.manage"), function (req, res, next) {
  // A reset link can sign in as its account, so it needs more than a token's scopes
  if (req.principal && req.principal.kind === "token") {
    res.status(403).send({ status: "failure", message: "Unauthorized!" });
    return;
  }
  let id = null;
  if (req.body.hasOwnProperty("id") && req.body.id != null) {
    id = parseInt(req.body.id);
  }

  if (isNaN(id) || id == null) {
    logger(
      "error",
      `Failed to generate a password reset link for user. User Id is null.`,
      "accounts",
      null
    );
    res.send({
      status: "failure",
      message: `Failed to generate a password reset link for user. User Id is null.`,
    });
    return null;
  }

  let expires = 3600000;
  if (req.body.hasOwnProperty("expires") && req.body.expires != null) {
    expires = parseInt(req.body.expires);
  }

  if (isNaN(expires) || expires == null) {
    expires = 3600000;
  }

  //Form update object
  let toUpdateTo = {
    reset_token: crypto.randomBytes(32).toString("hex"),
    reset_token_expiration: Date.now() + expires,
  };

  let updateObj = {
    where: {
      id: id,
    },
  };

  // Accounts created by a login provider sign in through it; a local password would get around it
  AuthIdentity.findOne({ where: { user_id: id }, attributes: ["provider"], raw: true })
    .then((link) => {
      if (link) {
        res.send({
          status: "failure",
          message: `This account signs in with ${providers.providerLabel(link.provider) || link.provider}, so it has no MMGIS password to reset.`,
        });
        return null;
      }
      return User.update(toUpdateTo, updateObj).then(() => true);
    })
    .then((updated) => {
      if (!updated) return null;
      res.send({
        status: "success",
        message: `Successfully generated a password reset token for user with id: '${id}'.`,
        body: {
          resetToken: toUpdateTo.reset_token,
          resetTokenExpiration: toUpdateTo.reset_token_expiration,
        },
      });
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to generate a password reset token for user with id: '${id}'.`,
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: `Failed to generate a password reset token for user with id: '${id}'.`,
        body: {},
      });
    });
});

module.exports = router;
