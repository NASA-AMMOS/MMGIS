/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const Utils = require("../../../utils.js");
const geodatasets = require("../models/geodatasets");
const Geodatasets = geodatasets.Geodatasets;
const makeNewGeodatasetTable = geodatasets.makeNewGeodatasetTable;

//Returns a geodataset table as a geojson
router.get("/get/:layer", function (req, res, next) {
  req.query.layer = req.params.layer;
  get("get", req, res, next);
});
router.get("/get", function (req, res, next) {
  get("get", req, res, next);
});

function get(reqtype, req, res, next) {
  let layer = null;
  let type = "geojson";
  let xyz = {};
  if (reqtype == "post") {
    layer = req.body.layer;
    type = req.body.type || type;
    if (type == "mvt") {
      xyz = {
        x: parseInt(req.body.x),
        y: parseInt(req.body.y),
        z: parseInt(req.body.z),
      };
    }
  } else if (reqtype == "get") {
    layer = req.query.layer;
    type = req.query.type || type;
    if (type == "mvt") {
      xyz = {
        x: parseInt(req.query.x),
        y: parseInt(req.query.y),
        z: parseInt(req.query.z),
      };
    }
  }
  //First Find the table name
  Geodatasets.findOne({ where: { name: layer } })
    .then((result) => {
      if (result) {
        let table = result.dataValues.table;
        if (type == "geojson") {
          let q = `SELECT properties, ST_AsGeoJSON(geom), id FROM ${Utils.forceAlphaNumUnder(
            table
          )}`;

          if (req.query?.limited) {
            q += ` ORDER BY id DESC LIMIT 3`;
          }

          let hasBounds = false;
          let minx = req.query?.minx;
          let miny = req.query?.miny;
          let maxx = req.query?.maxx;
          let maxy = req.query?.maxy;
          if (minx != null && miny != null && maxx != null && maxy != null) {
            // ST_MakeEnvelope is (xmin, ymin, xmax, ymax, srid)
            q += ` WHERE ST_Intersects(ST_MakeEnvelope(${Utils.forceAlphaNumUnder(
              parseFloat(minx)
            )}, ${Utils.forceAlphaNumUnder(
              parseFloat(miny)
            )}, ${Utils.forceAlphaNumUnder(
              parseFloat(maxx)
            )}, ${Utils.forceAlphaNumUnder(parseFloat(maxy))}, 4326), geom)`;
            hasBounds = true;
          }
          let startProp = "start_time";
          let start_time = "";
          let endProp = "end_time";
          let end_time = "";
          if (req.query?.endtime != null) {
            const format = req.query?.format || "YYYY-MM-DDTHH:MI:SSZ";
            let t = ` `;
            if (!hasBounds) t += `WHERE `;
            else t += `AND `;

            if (
              req.query?.starttime == null ||
              req.query?.starttime.indexOf(`'`) != -1 ||
              req.query?.endtime == null ||
              req.query?.endtime.indexOf(`'`) != -1 ||
              format.indexOf(`'`) != -1
            ) {
              res.send({
                status: "failure",
                message: "Missing inner or malformed time parameters.",
              });
              return;
            }

            start_time = new Date(
              req.query.starttime || "1970-01-01T00:00:00Z"
            ).getTime();
            end_time = new Date(req.query.endtime).getTime();

            startProp = Utils.forceAlphaNumUnder(
              req.query.startProp || startProp
            );
            endProp = Utils.forceAlphaNumUnder(req.query.endProp || endProp);
            // prettier-ignore
            t += [
              `(`,
                `${startProp} IS NOT NULL AND ${endProp} IS NOT NULL AND`, 
                  ` ${startProp} >= ${start_time}`,
                  ` AND ${endProp} <= ${end_time}`,
              `)`,
              ` OR `,
              `(`,
                `${startProp} IS NULL AND ${endProp} IS NOT NULL AND`,
                  ` ${endProp} >= ${start_time}`,
                  ` AND ${endProp} <= ${end_time}`,
              `)`
          ].join('')
            q += t;
          }
          q += `;`;

          sequelize
            .query(q, {
              replacements: {
                startProp: startProp,
                start_time: start_time,
                endProp: endProp,
                end_time: end_time,
              },
            })
            .then(([results]) => {
              let geojson = { type: "FeatureCollection", features: [] };
              for (let i = 0; i < results.length; i++) {
                let properties = results[i].properties;
                properties._ = properties._ || {};
                properties._.idx = results[i].id;
                let feature = {};
                feature.type = "Feature";
                feature.properties = properties;
                feature.geometry = JSON.parse(results[i].st_asgeojson);
                geojson.features.push(feature);
              }

              res.setHeader("Access-Control-Allow-Origin", "*");

              if (reqtype == "post") {
                res.send({
                  status: "success",
                  body: geojson,
                });
              } else {
                res.send(geojson);
              }
              return null;
            })
            .catch((err) => {
              logger(
                "error",
                "Geodataset query SQL error.",
                req.originalUrl,
                req,
                err
              );
              res.send({
                status: "failure",
                message: "Failed to query Geodataset.",
              });
            });
        } else if (
          type == "mvt" &&
          xyz.x != null &&
          xyz.y != null &&
          xyz.z != null
        ) {
          let ne = {
            lat: tile2Lat(xyz.y, xyz.z),
            lng: tile2Lng(xyz.x + 1, xyz.z),
          };
          let sw = {
            lat: tile2Lat(xyz.y + 1, xyz.z),
            lng: tile2Lng(xyz.x, xyz.z),
          };

          //We make these slightly large bounds for our initial bounds of data,
          //This lets ST_AsMvtGeom properly use its bounds ability
          let oLat = Math.abs(ne.lat - sw.lat) / (4096 / 256);
          let oLng = Math.abs(ne.lng - sw.lng) / (4096 / 256);
          let ne2 = { lat: ne.lat + oLat, lng: ne.lng + oLng };
          let sw2 = { lat: sw.lat - oLat, lng: sw.lng - oLng };

          sequelize
            .query(
              "SELECT ST_AsMVT(q, " +
                ":layer" +
                ", 4096, 'geommvt') " +
                "FROM (" +
                "SELECT " +
                "id, " +
                "properties, " +
                "ST_AsMvtGeom(" +
                "geom," +
                "ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne.lat)) +
                ", 4326)," +
                "4096," +
                "256," +
                "true" +
                ") AS geommvt " +
                "FROM " +
                Utils.forceAlphaNumUnder(table) +
                " " +
                "WHERE geom && ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lat)) +
                ", 4326) " +
                "AND ST_Intersects(geom, ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lat)) +
                ", 4326))" +
                ") AS q;",
              {
                replacements: {
                  layer: layer,
                },
              }
            )
            .then(([results]) => {
              res.setHeader("Content-Type", "application/x-protobuf");
              res.setHeader("Access-Control-Allow-Origin", "*");

              if (reqtype == "post") {
                res.send({
                  status: "success",
                  body: results,
                });
              } else {
                res.send(Buffer.from(results[0].st_asmvt, "binary"));
              }
              return null;
            })
            .catch((err) => {
              logger(
                "error",
                "Geodataset SQL error.",
                req.originalUrl,
                req,
                err
              );
              res.send({ status: "failure", message: "SQL error" });
            });
        } else {
          res.send({
            status: "failure",
            message: "Unknown type or missing xyz.",
          });
        }
      } else {
        res.send({ status: "failure", message: "Not Found" });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "d" });
    });
}

//Returns a list of entries in the geodatasets table
router.post("/entries", function (req, res, next) {
  Geodatasets.findAll()
    .then((sets) => {
      if (sets && sets.length > 0) {
        let entries = [];
        for (let i = 0; i < sets.length; i++) {
          entries.push({
            name: sets[i].name,
            updated: sets[i].updatedAt,
            filename: sets[i].filename,
            num_features: sets[i].num_features,
            start_time_field: sets[i].start_time_field,
            end_time_field: sets[i].end_time_field,
          });
        }
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
                entries.forEach((entry) => {
                  entry.occurrences = entry.occurrences || {};
                  entry.occurrences[m.mission] =
                    entry.occurrences[m.mission] || [];
                  if (layer.url === `geodatasets:${entry.name}`) {
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
              body: { entries: entries },
            });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to find missions.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "Failed to find missions.",
            });
            return null;
          });
      } else {
        res.send({
          status: "failure",
        });
      }
    })
    .catch((err) => {
      logger(
        "error",
        "Failure finding geodatasets.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
      });
    });
});

/*
 * req.body.layer
 * req.body.key
 * req.body.value
 * req.body.id (specific feature id instead of key:value)
 * req.body.orderBy
 * req.body.restrictToGeometryType
 * req.body.offset (i.e. if -1, then return feature previous to key:val) (can also be 'first' or 'last')
 */
router.post("/search", function (req, res, next) {
  //First Find the table name
  Geodatasets.findOne({ where: { name: req.body.layer } })
    .then((result) => {
      if (result) {
        let table = result.dataValues.table;

        let offset = req.body.offset;
        const origOffset = offset;
        if (offset === "first") offset = -1;
        else if (offset === "last") offset = 1;

        let featureId = req.body.id;

        if (offset != null && featureId == null) {
          res.send({
            status: "failure",
            message: "If 'offset' is set, 'id' must also be set.",
          });
          return;
        }
        offset = parseInt(offset);
        featureId = parseInt(featureId);

        let orderBy = "id";
        if (req.body.orderBy != null) orderBy = `properties->>:orderBy`;

        let minx = req.body?.minx;
        let miny = req.body?.miny;
        let maxx = req.body?.maxx;
        let maxy = req.body?.maxy;
        let where = "";
        if (minx != null && miny != null && maxx != null && maxy != null) {
          // ST_MakeEnvelope is (xmin, ymin, xmax, ymax, srid)
          where = ` WHERE ST_Intersects(ST_MakeEnvelope(${Utils.forceAlphaNumUnder(
            parseFloat(minx)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(miny)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(maxx)
          )}, ${Utils.forceAlphaNumUnder(parseFloat(maxy))}, 4326), geom)`;
        }

        const geometryTypes = [
          "Point",
          "LineString",
          "Polygon",
          "MultiPoint",
          "MultiLineString",
          "MultiPolygon",
        ];

        const geomTypeWhere =
          geometryTypes.indexOf(req.body.restrictToGeometryType) != -1
            ? " AND geometry_type = :geomtype"
            : "";

        let q =
          `SELECT properties, ST_AsGeoJSON(geom), id FROM ${Utils.forceAlphaNumUnder(
            table
          )}` +
          (req.body.last || offset != null
            ? `${where}${geomTypeWhere} ORDER BY id ${
                offset != null && !req.body.last ? "ASC" : "DESC LIMIT 1"
              }`
            : ` WHERE properties ->> :key = :value${geomTypeWhere}`);

        sequelize
          .query(q + ";", {
            replacements: {
              orderBy: orderBy || "id",
              key: req.body.key,
              geomType: req.body.restrictToGeometryType,
              value:
                typeof req.body.value === "string"
                  ? req.body.value.replace(/[`;'"]/gi, "")
                  : null,
            },
          })
          .then(([results]) => {
            let r = [];
            for (let i = 0; i < results.length; i++) {
              let properties = results[i].properties;
              properties._ = properties._ || {};
              properties._.idx = results[i].id;
              let feature = {};
              feature.type = "Feature";
              feature.properties = properties;
              feature.geometry = JSON.parse(results[i].st_asgeojson);
              r.push(feature);
            }

            if (offset != null) {
              if (orderBy != "id") {
                r.sort((a, b) => {
                  let sign = 1;
                  if (offset > 0) sign = -1;
                  const af = Utils.getIn(a, `properties.${orderBy}`, 0);
                  const bf = Utils.getIn(b, `properties.${orderBy}`, 1);
                  if (typeof af === "string" || typeof bf === "string") {
                    return af.localeCompare(bf) * sign;
                  } else return (af - bf) * sign;
                });
              }

              const rLen = r.length;
              if (origOffset === "first" || origOffset === "last") {
                r = [r[rLen - 1]];
              } else {
                for (let i = 0; i < rLen; i++) {
                  if (r[i].properties._.idx === featureId) {
                    r = [
                      r[Math.min(Math.max(0, i + Math.abs(offset)), rLen - 1)],
                    ]; //abs because we already sort differently by it
                    break;
                  }
                }
              }
            }

            res.send({
              status: "success",
              body: r,
            });

            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "SQL error search through geodataset.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "SQL error.",
            });
          });
      } else {
        res.send({
          status: "failure",
          message: "Layer not found.",
        });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({
        status: "failure",
      });
    });
});

router.post("/append/:name", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.query.start_prop || null,
    endProp: req.query.end_prop || null,
    filename: req.query.filename || null,
    geojson: typeof req.body === "string" ? JSON.parse(req.body) : req.body,
    action: "append",
  };
  recreate(req, res, next);
});

router.post("/append/:name/:start_end_prop", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.params.start_end_prop.split(",")[0] || null,
    endProp: req.params.start_end_prop.split(",")[1] || null,
    geojson: req.body,
    action: "append",
  };
  recreate(req, res, next);
});

router.post("/recreate/:name", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: null,
    endProp: null,
    geojson: req.body,
    action: "recreate",
  };
  recreate(req, res, next);
});

router.post("/recreate/:name/:start_end_prop", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.params.start_end_prop.split(",")[0] || null,
    endProp: req.params.start_end_prop.split(",")[1] || null,
    geojson: req.body,
    action: "recreate",
  };
  recreate(req, res, next);
});

router.post("/recreate", function (req, res, next) {
  recreate(req, res, next);
});

function recreate(req, res, next) {
  let startProp = req.body.startProp;
  let endProp = req.body.endProp;
  let filename = req.body.filename;

  let features = null;
  try {
    features =
      typeof req.body.geojson === "string"
        ? JSON.parse(req.body.geojson).features
        : req.body.geojson.features;
  } catch (err) {
    logger("error", "Failure: Malformed file.", req.originalUrl, req, err);
    res.send({
      status: "failure",
      message: "Failure: Malformed file.",
      body: {},
    });
  }
  if (!features) {
    //Must be a single feature from an append.  Make an array
    features = [JSON.parse(req.body.geojson)];
  } else {
    startProp = req?.body?.geojson?.startProp || startProp;
    endProp = req?.body?.geojson?.endProp || endProp;
  }

  makeNewGeodatasetTable(
    req.body.name,
    filename,
    features.length,
    startProp,
    endProp,
    res?.body?.action || null,
    function (result) {
      let checkEnding = result.table.split("_");
      if (checkEnding[checkEnding.length - 1] !== "geodatasets") {
        logger("error", "Malformed table name.", req.originalUrl, req);
        res.send({
          status: "failed",
          message: "Malformed table name",
        });
        return;
      }

      let drop_qry = `TRUNCATE TABLE ${Utils.forceAlphaNumUnder(
        result.table
      )} RESTART IDENTITY`;
      if (req.body.hasOwnProperty("action") && req.body.action == "append") {
        drop_qry = "";
      }

      sequelize
        .query(drop_qry, {
          replacements: {},
        })
        .then(() => {
          populateGeodatasetTable(
            result.tableObj,
            features,
            startProp,
            endProp,
            function (success) {
              res.send({
                status: success == true ? "success" : "failure",
                message: "",
                body: {},
              });
            }
          );

          return null;
        })
        .catch((err) => {
          logger("error", "Recreation error.", req.originalUrl, req, err.stack);
          res.send(result);
        });
    },
    function (result) {
      res.send(result);
    }
  );
}

function populateGeodatasetTable(Table, features, startProp, endProp, cb) {
  let rows = [];

  for (var i = 0; i < features.length; i++) {
    let start_time =
      startProp != null
        ? Utils.getIn(features[i].properties, startProp, null)
        : null;
    if (start_time != null) {
      start_time = new Date(start_time).getTime();
      start_time = isNaN(start_time) ? null : start_time;
    }
    let end_time =
      endProp != null
        ? Utils.getIn(features[i].properties, endProp, null)
        : null;
    if (end_time != null) {
      end_time = new Date(end_time).getTime();
      end_time = isNaN(end_time) ? null : end_time;
    }
    const row = {
      properties: features[i].properties,
      geometry_type: features[i].geometry.type,
      geom: {
        crs: { type: "name", properties: { name: "EPSG:4326" } },
        type: features[i].geometry.type,
        coordinates: features[i].geometry.coordinates,
      },
    };
    if (startProp) row.start_time = start_time;
    if (endProp) row.end_time = end_time;
    rows.push(row);
  }

  Table.bulkCreate(rows, { returning: true })
    .then(function (response) {
      sequelize
        .query(`VACUUM ANALYZE ${Utils.forceAlphaNumUnder(Table.tableName)};`, {
          replacements: {},
        })
        .then(() => {
          cb(true);
          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Geodatasets: Failed to vacuum a geodataset spatial index!",
            null,
            null,
            err
          );
          cb(false);
          return null;
        });
    })
    .catch(function (err) {
      logger(
        "error",
        "Geodatasets: Failed to populate a geodataset table!",
        null,
        null,
        err
      );
      cb(false);
      return null;
    });
}

router.delete("/remove/:name", function (req, res, next) {
  Geodatasets.findOne({ where: { name: req.params.name } })
    .then((result) => {
      if (result) {
        sequelize
          .query(
            `DROP TABLE IF EXISTS ${Utils.forceAlphaNumUnder(
              result.dataValues.table
            )};`,
            {
              replacements: {},
            }
          )
          .then(() => {
            Geodatasets.destroy({ where: { name: req.params.name } })
              .then(() => {
                logger(
                  "info",
                  `Successfully deleted geodataset '${req.params.name}'.`
                );
                res.send({
                  status: "success",
                  message: `Successfully deleted geodataset '${req.params.name}'.`,
                });
              })
              .catch((err) => {
                logger(
                  "error",
                  `Failed to delete geodataset table entry '${req.params.name}'.`,
                  "geodatasets",
                  null,
                  err
                );
                res.send({
                  status: "failure",
                  message: `Failed to delete geodataset entry '${req.params.name}'.`,
                });
                return null;
              });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              `Failed to delete geodataset table '${req.params.name}'.`,
              "geodatasets",
              null,
              err
            );
            res.send({
              status: "failure",
              message: `Failed to delete geodataset '${req.params.name}'.`,
            });
            return null;
          });
      } else {
        logger(
          "info",
          `Tried to delete nonexistent geodataset table: ${req.params.name}`,
          "geodatasets",
          null,
          err
        );
        res.send({
          status: "failure",
          message: `No geodataset named '${req.params.name}' to delete.`,
        });
        return null;
      }
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find existing geodatasets.",
        "geodatasets",
        null,
        err
      );
      res.send({
        status: "failure",
        message: "Failed to find existing geodatasets",
        error: err,
        name: req.params.name,
      });
      return null;
    });
});

function tile2Lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2Lat(y, z) {
  let n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

module.exports = router;
