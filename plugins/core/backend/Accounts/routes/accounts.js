/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
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
const { RoleBinding } = require("../../../../../API/permissions/models");
const { LongTermTokens } = require("../../LongTermToken/models/longtermtokens");
const connections = require("../../../../../API/connections");
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

  User.update(toUpdateTo, updateObj)
    .then(() => {
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
