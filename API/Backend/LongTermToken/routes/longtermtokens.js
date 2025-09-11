/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const LongTermTokens = require("../models/longtermtokens").LongTermTokens;  

router.get("/get", function (req, res, next) {
  // Get user permission and ID from session
  const userPermission = req.session.permission;
  const userId = req.session.uid;

  // Build WHERE clause based on user permissions
  let whereClause = "";
  let replacements = {};
  
  if (userPermission !== "111") {
    // Regular admins (110) only see their own tokens
    whereClause = userId !== null && userId !== undefined ? "WHERE lt.created_by_user_id = :userId" : "WHERE 1=0";
    replacements.userId = userId;
  }
  // SuperAdmins (111) see all tokens (no WHERE clause)

  // Use raw query to join with users table to get creator info
  sequelize
    .query(
      `SELECT 
        lt.id, 
        lt.token, 
        lt.period, 
        lt.created_by_user_id,
        lt."createdAt", 
        lt."updatedAt",
        u.username as created_by_username,
        u.permission as created_by_permission,
        u.missions_managing as created_by_missions
      FROM long_term_tokens lt 
      LEFT JOIN users u ON lt.created_by_user_id = u.id 
      ${whereClause}
      ORDER BY lt."createdAt" DESC`,
      {
        replacements: replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    )
    .then((tokens) => {
      /*
      tokens.forEach((token) => {
        if (token.token) token.token = token.token.slice(0, 16) + "...";
      });
      */
      res.send({ status: "success", tokens: tokens });
      return null;
    })
    .catch((err) => {
      logger("error", "Failed to get all tokens.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to get tokens." });
      return null;
    });
  return null;
});

//Returns dataset rows based on search
router.post("/generate", function (req, res, next) {
  crypto.randomBytes(16, function (err, buffer) {
    const token =
      (req.body.name
        ? req.body.name.replace(/[^0-9a-zA-Z]/g, "").toLowerCase() + "-"
        : "") + buffer.toString("hex");
    let newLongTermToken = {
      token: token,
      period: req.body.period,
      created_by_user_id: req.session.uid,
    };

    LongTermTokens.create(newLongTermToken)
      .then((created) => {
        res.send({
          status: "success",
          message: "Successfully created long term token.",
          body: newLongTermToken,
        });
      })
      .catch((err) => {
        res.send({
          status: "failure",
          message: "Failed to create long term token!",
          body: { err },
        });
      });
  });
});

router.post("/clear", function (req, res, next) {
  if (req.body.id == null) {
    res.send({
      status: "failure",
      message: `Failed to delete long term token. body.id is undefined.`,
    });
    return null;
  }

  // Get user permission and ID from session
  const userPermission = req.session.permission;
  const userId = req.session.uid;

  LongTermTokens.findOne({ where: { id: parseInt(req.body.id) } })
    .then((token) => {
      if (!token) {
        res.send({
          status: "failure",
          message: `Token with id ${req.body.id} not found.`,
        });
        return null;
      }

      // Check permission: SuperAdmins can delete any token, others can only delete their own
      if (userPermission !== "111" && token.created_by_user_id !== userId) {
        res.send({
          status: "failure",
          message: `You do not have permission to delete this token.`,
        });
        return null;
      }

      // User has permission, proceed with deletion
      token.destroy();
      res.send({
        status: "success",
        message: `Successfully deleted long term token with id ${req.body.id}.`,
      });
    })
    .catch((err) => {
      res.send({
        status: "failure",
        message: `Failed to delete long term token with id ${req.body.id}!`,
        body: { err },
      });
    });
});

function clearLongTermTokens(cb) {
  sequelize
    .query('TRUNCATE TABLE "long_term_tokens" RESTART IDENTITY')
    .then(() => {
      cb(true);
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Long Term Tokens: Failed to clear long term token!",
        "longtermtokens",
        null,
        err
      );
      cb(false);
      return null;
    });
}

module.exports = router;
