/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const geodatasets = require("../models/geodatasets");
const Geodatasets = geodatasets.Geodatasets;
const makeNewGeodatasetTable = geodatasets.makeNewGeodatasetTable;

//Returns a geodataset table as a geojson
router.post("/get", function (req, res, next) {
  get("post", req, res, next);
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
          sequelize
            .query(
              "SELECT properties, ST_AsGeoJSON(geom)" + " " + "FROM " + table
            )
            .then(([results]) => {
              let geojson = { type: "FeatureCollection", features: [] };
              for (let i = 0; i < results.length; i++) {
                let properties = results[i].properties;
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
            .catch((error) => {
              res.send({ status: "failure", message: "a" });
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
              "SELECT ST_AsMVT(q, '" +
                layer +
                "', 4096, 'geommvt') " +
                "FROM (" +
                "SELECT " +
                "id, " +
                "properties, " +
                "ST_AsMvtGeom(" +
                "geom," +
                "ST_MakeEnvelope(" +
                sw.lng +
                "," +
                sw.lat +
                "," +
                ne.lng +
                "," +
                ne.lat +
                ", 4326)," +
                "4096," +
                "256," +
                "true" +
                ") AS geommvt " +
                "FROM " +
                table +
                " " +
                "WHERE geom && ST_MakeEnvelope(" +
                sw2.lng +
                "," +
                sw2.lat +
                "," +
                ne2.lng +
                "," +
                ne2.lat +
                ", 4326) " +
                "AND ST_Intersects(geom, ST_MakeEnvelope(" +
                sw2.lng +
                "," +
                sw2.lat +
                "," +
                ne2.lng +
                "," +
                ne2.lat +
                ", 4326))" +
                ") AS q;",
              {
                replacements: {
                  table: table,
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
          entries.push({ name: sets[i].name, updated: sets[i].updatedAt });
        }
        res.send({
          status: "success",
          body: { entries: entries },
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
 */
router.post("/search", function (req, res, next) {
  //First Find the table name
  Geodatasets.findOne({ where: { name: req.body.layer } })
    .then((result) => {
      if (result) {
        let table = result.dataValues.table;

        sequelize
          .query(
            "SELECT properties, ST_AsGeoJSON(geom) FROM " +
              table +
              " WHERE properties ->> :key = :value;",
            {
              replacements: {
                key: req.body.key,
                value: req.body.value.replace(/[`;'"]/gi, ""),
              },
            }
          )
          .then(([results]) => {
            let r = [];
            for (let i = 0; i < results.length; i++) {
              let feature = JSON.parse(results[i].st_asgeojson);
              feature.properties = results[i].properties;
              r.push(feature);
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

router.post("/recreate", function (req, res, next) {
  let features = null;
  try {
    features = JSON.parse(req.body.geojson).features;
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
  }

  makeNewGeodatasetTable(
    req.body.name,
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

      let drop_qry = "TRUNCATE TABLE " + result.table + " RESTART IDENTITY";
      if (req.body.hasOwnProperty("action") && req.body.action=="append") {
        drop_qry = "";
      }

      sequelize
        .query(drop_qry)
        .then(() => {
          populateGeodatasetTable(
            result.tableObj,
            features,
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

  function populateGeodatasetTable(Table, features, cb) {
    let rows = [];

    for (var i = 0; i < features.length; i++) {
      rows.push({
        properties: features[i].properties,
        geometry_type: features[i].geometry.type,
        geom: {
          crs: { type: "name", properties: { name: "EPSG:4326" } },
          type: features[i].geometry.type,
          coordinates: features[i].geometry.coordinates,
        },
      });
    }

    Table.bulkCreate(rows, { returning: true })
      .then(function (response) {
        cb(true);
        return null;
      })
      .catch(function (err) {
        logger(
          "error",
          "Geodatasets: Failed to populate a geodataset table!",
          req.originalUrl,
          req,
          err
        );
        cb(false);
        return null;
      });
  }
});

function tile2Lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2Lat(y, z) {
  let n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

module.exports = router;
