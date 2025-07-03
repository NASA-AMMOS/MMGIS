/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const logger = require("../../../logger");
const userModel = require("../../Users/models/user");
const User = userModel.User;

router.get("/entries", function (req, res) {
  User.findAll({
    attributes: [
      "id",
      "username",
      "email",
      "permission",
      "createdAt",
      "updatedAt",
    ],
    order: [["id", "ASC"]],
  })
    .then((users) => {
      res.send({
        status: "success",
        body: {
          entries: users,
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

router.delete("/remove/:id", function (req, res, next) {
  const id = parseInt(req.params.id);

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
  if (id === 1) {
    logger(
      "error",
      `Cannot delete the original Administrator account.`,
      "accounts",
      null
    );
    res.send({
      status: "failure",
      message: `Cannot delete the original Administrator account.`,
    });
    return null;
  }

  User.destroy({ where: { id: id } })
    .then(() => {
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
      logger(
        "error",
        `Failed to delete user with id: '${id}'.`,
        "accounts",
        null,
        err
      );
      res.send({
        status: "failure",
        message: `Failed to delete user with id: '${id}'.`,
      });
      return null;
    });
  return null;
});

router.post("/update", function (req, res, next) {
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

  //Form update object
  let toUpdateTo = {};
  if (req.body.hasOwnProperty("email") && req.body.email != null) {
    toUpdateTo.email = req.body.email;
  }
  if (
    req.body.hasOwnProperty("permission") &&
    req.body.permission != null &&
    (req.body.permission === "111" || req.body.permission === "001")
  ) {
    toUpdateTo.permission = req.body.permission;
  }
  // Don't allow changing the main admin account's permissions
  if (id === 1) {
    delete toUpdateTo.permission;
  }

  let updateObj = {
    where: {
      id: id,
    },
  };

  User.update(toUpdateTo, updateObj)
    .then(() => {
      res.send({
        status: "success",
        message: `Successfully updated user with id: '${id}'.`,
        body: {
          updated_id: id,
        },
      });
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to update user with id: '${id}'.`,
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: `Failed updated user with id: '${id}'.`,
        body: {},
      });
    });
});

router.post("/generateResetPasswordLink", function (req, res, next) {
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
