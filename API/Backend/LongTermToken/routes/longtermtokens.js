/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const LongTermTokens = require("../models/longtermtokens");

router.get("/get", function (req, res, next) {
  LongTermTokens.findAll()
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
  LongTermTokens.findOne({ where: { id: parseInt(req.body.id) } })
    .then((token) => {
      if (token) {
        token.destroy();
      }
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
