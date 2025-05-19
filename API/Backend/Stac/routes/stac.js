/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const fetch = require("node-fetch");
const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const Utils = require("../../../utils.js");

// Wraps /stac/collections to include occurrences
router.get("/collections", function (req, res, next) {
  // Pass a query parameters along
  const queryString = req.originalUrl.split("?")[1] || "";
  const fullQueryString = queryString ? `?${queryString}` : "";

  fetch(
    `http://${
      process.env.IS_DOCKER === "true" ? "stac-fastapi" : "localhost"
    }:${process.env.STAC_PORT || 8881}/collections${fullQueryString}`,
    {
      method: "GET",
      headers: { "content-type": "application/json" },
    }
  )
    .then((res) => {
      if (!res.ok) {
        return res.text().then((text) => {
          throw new Error(text);
        });
      } else {
        return res.json();
      }
    })
    .then((json) => {
      // For each entry, list all occurrences in latest configuration objects
      sequelize
        .query(
          `
                SELECT t1.*
                FROM configs AS t1
                INNER JOIN (
                    SELECT mission, MAX(version) AS max_version
                    FROM configs
                    GROUP BY mission
                ) AS t2
                ON t1.mission = t2.mission AND t1.version = t2.max_version ORDER BY mission ASC;
                `
        )
        .then(([results]) => {
          // Populate occurrences
          results.forEach((m) => {
            Utils.traverseLayers(m.config.layers, (layer, path) => {
              json.collections.forEach((entry) => {
                entry.occurrences = entry.occurrences || {};
                entry.occurrences[m.mission] =
                  entry.occurrences[m.mission] || [];
                if (layer?.url != null) {
                  const split = layer.url.split(":");
                  if (
                    split[0] === "stac-collection" &&
                    split[1].split("?")[0] === entry.id
                  )
                    entry.occurrences[m.mission].push({
                      name: layer.name,
                      uuid: layer.uuid,
                      path: path,
                    });
                }
              });
            });
          });

          res.send({
            status: "success",
            body: { collections: json.collections, links: json.links },
          });
          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Failed to find missions for STAC Collections.",
            req.originalUrl,
            req,
            err
          );
          res.send({
            status: "failure",
            message: "Failed to find missions for STAC Collections.",
          });
          return null;
        });
    })
    .catch(function (err) {
      logger(
        "error",
        "Failed to query for STAC Collections",
        "stac",
        null,
        err
      );
      return null;
    });
});

module.exports = router;
