const express = require("express");
const logger = require("../../../logger");
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const fhistories = require("../models/filehistories");
const Filehistories = fhistories.Filehistories;
const FilehistoriesTEST = fhistories.FilehistoriesTEST;
const ufiles = require("../models/userfiles");
const Userfiles = ufiles.Userfiles;
const UserfilesTEST = ufiles.UserfilesTEST;

const router = express.Router();

/**
 * POST /api/draw/aggregations
 * Returns property aggregations from sampled features in the specified file(s)
 *
 * Request body:
 * - id: number|array - File ID(s) to aggregate
 * - test: "true"|"false" - Test mode
 * - limit: number - Sample size (default: 500)
 * - time: timestamp - Optional: historical point-in-time
 * - minx, miny, maxx, maxy: Optional spatial bounds filter
 * - startTime, endTime: Optional temporal filter
 * - timeProp: Optional time property name
 */
router.post("/aggregations", function (req, res, next) {
  const test = req.body.test === "true";
  const Table = test ? UserfilesTEST : Userfiles;
  const Histories = test ? FilehistoriesTEST : Filehistories;

  // Parse file IDs
  let fileIds = req.body.id;
  try {
    fileIds = JSON.parse(fileIds);
  } catch (e) {
    // Already parsed or invalid
  }

  // Ensure array format
  if (!Array.isArray(fileIds)) {
    fileIds = [fileIds];
  }

  // Validate file IDs
  if (!fileIds || fileIds.length === 0) {
    return res.send({
      status: "failure",
      message: "No file IDs provided.",
    });
  }

  const limit = req.body.limit != null ? parseInt(req.body.limit) : 500;
  const atThisTime = req.body.time || Math.floor(Date.now());

  // First verify user has access to these files
  Table.findAll({
    where: {
      id: fileIds,
      [Sequelize.Op.or]: {
        file_owner: req.user,
        public: "1",
      },
    },
  })
    .then((files) => {
      if (!files || files.length === 0) {
        return res.send({
          status: "failure",
          message: "No accessible files found.",
        });
      }

      // Get the history of features that exist at this time
      sequelize
        .query(
          "SELECT history" +
            " FROM file_histories" +
            (test ? "_tests" : "") +
            " WHERE file_id IN (:ids)" +
            " AND time <= :time" +
            " ORDER BY time DESC" +
            " FETCH first :first rows only",
          {
            replacements: {
              ids: fileIds,
              time: atThisTime,
              first: fileIds.length,
            },
          }
        )
        .then(([historyResults]) => {
          // Merge all histories
          let bestHistory = [];
          for (let i = 0; i < historyResults.length; i++) {
            bestHistory = bestHistory.concat(historyResults[i].history);
          }

          if (bestHistory.length === 0) {
            return res.send({
              status: "success",
              aggregations: {},
            });
          }

          // Build query for sampling features
          // NOTE: properties is double-encoded JSON, use #>>'{}'  to unwrap it
          let query = "SELECT properties#>>'{}' as properties, ST_GeometryType(geom) as geom_type" +
            " FROM user_features" +
            (test ? "_tests" : "") +
            " WHERE id IN (:history)";

          // Optional: Add spatial bounds filter
          const minx = req.body.minx;
          const miny = req.body.miny;
          const maxx = req.body.maxx;
          const maxy = req.body.maxy;

          if (minx != null && miny != null && maxx != null && maxy != null) {
            query += ` AND ST_Intersects(ST_MakeEnvelope(${parseFloat(minx)}, ${parseFloat(miny)}, ${parseFloat(maxx)}, ${parseFloat(maxy)}, 4326), geom)`;
          }

          // Optional: Add temporal filter
          const startTime = req.body.startTime;
          const endTime = req.body.endTime;
          const timeProp = req.body.timeProp || "time";

          if (startTime != null && endTime != null) {
            // Note: This is a simplified temporal filter
            // For more complex time handling, we'd need to parse the properties JSON in SQL
            query += ` AND properties->>'${timeProp}' IS NOT NULL`;
          }

          // Sample randomly and limit
          query += " ORDER BY RANDOM() LIMIT :limit";

          return sequelize.query(query, {
            replacements: {
              history: bestHistory,
              limit: limit,
            },
          });
        })
        .then(([features]) => {
          // Build aggregations from sampled features
          const aggregations = {
            "geometry.type": {
              type: "string",
              aggs: {},
            },
          };

          features.forEach((feature) => {
            // Add geometry.type aggregation
            if (feature.geom_type) {
              // Remove 'ST_' prefix (e.g., 'ST_Point' -> 'Point')
              const geomType = feature.geom_type.replace("ST_", "");
              aggregations["geometry.type"].aggs[geomType] =
                (aggregations["geometry.type"].aggs[geomType] || 0) + 1;
            }

            // Parse properties JSON (double-encoded: stored as JSON string)
            let props = {};
            try {
              // If properties is a string, parse it
              if (typeof feature.properties === 'string') {
                props = JSON.parse(feature.properties);
              } else {
                props = feature.properties || {};
              }
            } catch (e) {
              console.error('Error parsing properties:', e);
              props = {};
            }

            // Iterate through all properties
            Object.keys(props).forEach((key) => {
              // Skip internal properties
              if (key === "_") return;

              const value = props[key];

              // Initialize aggregation for this property if not exists
              if (!aggregations[key]) {
                aggregations[key] = {
                  type: detectType(value),
                  aggs: {},
                };
              }

              // Count occurrences of this value
              if (value != null) {
                // Handle type detection (strings can usurp numbers)
                const currentType = detectType(value);
                if (aggregations[key].type === "number" && currentType === "string") {
                  aggregations[key].type = currentType;
                }

                // Increment count for this value
                aggregations[key].aggs[value] =
                  (aggregations[key].aggs[value] || 0) + 1;
              }
            });
          });

          // Sort aggregations (reverse alphabetical order, matching geodatasets pattern)
          Object.keys(aggregations).forEach((key) => {
            const sortedAggs = {};
            Object.keys(aggregations[key].aggs)
              .sort()
              .reverse()
              .forEach((value) => {
                sortedAggs[value] = aggregations[key].aggs[value];
              });
            aggregations[key].aggs = sortedAggs;
          });

          res.send({
            status: "success",
            aggregations: aggregations,
          });
        })
        .catch((err) => {
          logger(
            "error",
            "Failure querying draw aggregations.",
            req.originalUrl,
            req,
            err
          );
          res.send({
            status: "failure",
            message: "Failure querying draw aggregations.",
          });
        });
    })
    .catch((err) => {
      logger("error", "Failure finding user files.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failure finding user files.",
      });
    });
});

/**
 * Detect the type of a value
 * @param {*} value - The value to detect type for
 * @returns {string} - "number", "boolean", or "string"
 */
function detectType(value) {
  if (value == null) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (!isNaN(value) && !isNaN(parseFloat(value))) return "number";
  return "string";
}

module.exports = router;
