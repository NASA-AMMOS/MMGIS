/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const logger = require("../../../logger");
const Webhooks = require("../models/webhooks");

const webhookutils = require("./webhookutils.js");
const entries = webhookutils.entries;

const triggerWebhooks = require("../processes/triggerwebhooks.js");

router.post("/save", function (req, res, next) {
  let webhookConfig = {
    config: req.body.config,
  };

  Webhooks.create(webhookConfig)
    .then((created) => {
      res.send({
        status: "success",
        message: "Successfully saved webhooks config.",
      });
    })
    .catch((err) => {
      res.send({
        status: "failure",
        message: "Failed to save webhooks config!",
        body: { err },
      });
    });
});

router.get("/entries", entries);

router.post("/config", function (req, res, next) {
  logger("success", "Called /webhooks/config API", req.originalUrl, req);

  triggerWebhooks("getConfiguration", {});
  // FIXME how do we check the above function ran
  res.send({
    status: "success",
    message: "Successfully updated webhooks config.",
  });
});

module.exports = { router };
