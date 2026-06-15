/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const logger = require("../../../logger");
const Webhooks = require("../models/webhooks");

function entries(req, res, next) {
  logger("success", "Called /webhooks/entries API", req.originalUrl, req);
  Webhooks.findAll({
    order: [["updatedAt", "DESC"]],
  })
    .then((sets) => {
      if (sets && sets.length > 0) {
        let entries = [];
        for (let i = 0; i < sets.length; i++) {
          entries.push({ config: sets[i].config, updated: sets[i].updatedAt });
        }

        res.send({
          status: "success",
          body: { entries: entries },
        });
      }
    })
    .catch((err) => {
      logger("error", "Failure finding webhooks.", req.originalUrl, req, err);
      res.send({
        status: "failure",
      });
    });
}

module.exports = { entries };
