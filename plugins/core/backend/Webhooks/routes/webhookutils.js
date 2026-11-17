/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const logger = require("../../../../../API/logger");
const Webhooks = require("../models/webhooks");
const buildEntriesResponse = require("./buildEntriesResponse");

function entries(req, res, next) {
  logger("success", "Called /webhooks/entries API", req.originalUrl, req);
  Webhooks.findAll({
    order: [["updatedAt", "DESC"]],
  })
    .then((sets) => {
      res.send(buildEntriesResponse(sets));
    })
    .catch((err) => {
      logger("error", "Failure finding webhooks.", req.originalUrl, req, err);
      res.send({
        status: "failure",
      });
    });
}

module.exports = { entries };
