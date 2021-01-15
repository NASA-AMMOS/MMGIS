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

//Returns dataset rows based on search
router.post("/generate", function(req, res, next) {
  crypto.randomBytes(48, function(err, buffer) {
    const token = buffer.toString("hex");
    let newLongTermToken = {
      token: token,
      period: req.body.period
    };

    clearLongTermToken(function(pass) {
      if (pass) {
        LongTermTokens.create(newLongTermToken)
          .then(created => {
            res.send({
              status: "success",
              message: "Successfully created long term token.",
              body: newLongTermToken
            });
          })
          .catch(err => {
            res.send({
              status: "failure",
              message: "Failed to create long term token!",
              body: { err }
            });
          });
      } else {
        res.send({
          status: "failure",
          message: "Failed to clear long term token!",
          body: {}
        });
      }
    });
  });
});

function clearLongTermToken(cb) {
  sequelize
    .query('TRUNCATE TABLE "long_term_tokens" RESTART IDENTITY')
    .then(() => {
      cb(true);
      return null;
    })
    .catch(err => {
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
