const logger = require("../../../logger");
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const fhistories = require("../models/filehistories");
const Filehistories = fhistories.Filehistories;
const FilehistoriesTEST = fhistories.FilehistoriesTEST;
const ufiles = require("../models/userfiles");
const Userfiles = ufiles.Userfiles;
const UserfilesTEST = ufiles.UserfilesTEST;

function getfile(req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  if (req.session.user == "guest" && req.body.quick_published !== "true") {
    res.send({
      status: "failure",
      message: "Permission denied.",
      body: {},
    });
  }

  let published = false;
  if (req.body.published === "true") published = true;
  if (req.body.quick_published === "true") {
    sequelize
      .query(
        "SELECT " +
          "id, intent, parent, children, level, properties, ST_AsGeoJSON(geom)" +
          " " +
          "FROM " +
          (req.body.test === "true" ? "publisheds_test" : "publisheds") +
          "" +
          (req.body.intent && req.body.intent.length > 0
            ? req.body.intent === "all"
              ? " WHERE intent IN ('polygon', 'line', 'point', 'text', 'arrow')"
              : " WHERE intent=:intent"
            : ""),
        {
          replacements: {
            intent: req.body.intent || "",
          },
        }
      )
      .then(([results]) => {
        let geojson = { type: "FeatureCollection", features: [] };
        for (let i = 0; i < results.length; i++) {
          let properties = results[i].properties;
          let feature = {};
          properties._ = {
            id: results[i].id,
            intent: results[i].intent,
            parent: results[i].parent,
            children: results[i].children,
            level: results[i].level,
          };
          feature.type = "Feature";
          feature.properties = properties;
          feature.geometry = JSON.parse(results[i].st_asgeojson);
          geojson.features.push(feature);
        }

        //Sort features by level
        geojson.features.sort((a, b) =>
          a.properties._.level > b.properties._.level
            ? 1
            : b.properties._.level > a.properties._.level
            ? -1
            : 0
        );

        if (req.body.test !== "true") {
          //Sort features by geometry type
          geojson.features.sort((a, b) => {
            if (a.geometry.type == "Point" && b.geometry.type == "Polygon")
              return 1;
            if (a.geometry.type == "LineString" && b.geometry.type == "Polygon")
              return 1;
            if (a.geometry.type == "Polygon" && b.geometry.type == "LineString")
              return -1;
            if (a.geometry.type == "Polygon" && b.geometry.type == "Point")
              return -1;
            if (a.geometry.type == "LineString" && b.geometry.type == "Point")
              return -1;
            if (a.geometry.type == b.geometry.type) return 0;
            return 0;
          });
        }

        res.send({
          status: "success",
          message: "Successfully got file.",
          body: geojson,
        });
      });
  } else {
    let idArray = false;
    req.body.id = JSON.parse(req.body.id);
    if (typeof req.body.id !== "number") idArray = true;

    let ids = req.body.id;

    if (idArray) {
      if (ids == null) ids = null;
      if (!Array.isArray(ids)) ids = [ids];
      if (ids.length === 0) ids = null;
    } else {
      if (ids == null) ids = null;
    }

    let atThisTime = published
      ? Math.floor(Date.now())
      : req.body.time || Math.floor(Date.now());

    Table.findAll({
      where: {
        id: req.body.id,
        //file_owner is req.user or public is '1'
        [Sequelize.Op.or]: {
          file_owner: req.user,
          public: "1",
        },
      },
    })
      .then((file) => {
        if (!file) {
          res.send({
            status: "failure",
            message: "Failed to access file.",
            body: {},
          });
        } else {
          sequelize
            .query(
              "SELECT history" +
                " " +
                "FROM file_histories" +
                (req.body.test === "true" ? "_tests" : "") +
                " " +
                "WHERE" +
                " " +
                (idArray ? "file_id IN (:id)" : "file_id=:id") +
                " " +
                "AND time<=:time" +
                " " +
                (published ? "AND action_index=4 " : "") +
                "ORDER BY time DESC" +
                " " +
                "FETCH first " +
                (published ? req.body.id.length : "1") +
                " rows only",
              {
                replacements: {
                  id: ids,
                  time: atThisTime,
                },
              }
            )
            .then(([results]) => {
              let bestHistory = [];
              for (let i = 0; i < results.length; i++) {
                bestHistory = bestHistory.concat(results[i].history);
              }

              //Find best history
              sequelize
                .query(
                  "SELECT " +
                    "id, file_id, level, intent, properties, ST_AsGeoJSON(geom)" +
                    " " +
                    "FROM user_features" +
                    (req.body.test === "true" ? "_tests" : "") +
                    " " +
                    "WHERE" +
                    " " +
                    (idArray ? "file_id IN (:id)" : "file_id=:id") +
                    " " +
                    "AND id IN (" +
                    ":bestHistory" +
                    ")",
                  {
                    replacements: {
                      id: ids,
                      bestHistory:
                        bestHistory != null && bestHistory.length > 0
                          ? bestHistory
                          : null,
                    },
                  }
                )
                .then(([results]) => {
                  let geojson = { type: "FeatureCollection", features: [] };
                  for (let i = 0; i < results.length; i++) {
                    let properties = JSON.parse(results[i].properties);
                    let feature = {};
                    properties._ = {
                      id: results[i].id,
                      file_id: results[i].file_id,
                      level: results[i].level,
                      intent: results[i].intent,
                    };
                    feature.type = "Feature";
                    feature.properties = properties;
                    feature.geometry = JSON.parse(results[i].st_asgeojson);
                    geojson.features.push(feature);
                  }

                  //Sort features by level
                  geojson.features.sort((a, b) =>
                    a.properties._.level > b.properties._.level
                      ? 1
                      : b.properties._.level > a.properties._.level
                      ? -1
                      : 0
                  );

                  if (req.body.test !== "true") {
                    //Sort features by geometry type
                    geojson.features.sort((a, b) => {
                      if (
                        a.geometry.type == "Point" &&
                        b.geometry.type == "Polygon"
                      )
                        return 1;
                      if (
                        a.geometry.type == "LineString" &&
                        b.geometry.type == "Polygon"
                      )
                        return 1;
                      if (
                        a.geometry.type == "Polygon" &&
                        b.geometry.type == "LineString"
                      )
                        return -1;
                      if (
                        a.geometry.type == "Polygon" &&
                        b.geometry.type == "Point"
                      )
                        return -1;
                      if (
                        a.geometry.type == "LineString" &&
                        b.geometry.type == "Point"
                      )
                        return -1;
                      if (a.geometry.type == b.geometry.type) return 0;
                      return 0;
                    });
                  }

                  res.send({
                    status: "success",
                    message: "Successfully got file.",
                    body: {
                      file: file,
                      geojson: geojson,
                    },
                  });
                });
            });
        }

        return null;
      })
      .catch((err) => {
        logger("error", "Failed to get file.", req.originalUrl, req, err);
        res.send({
          status: "failure",
          message: "Failed to get file.",
          body: {},
        });
      });
  }
}

module.exports = { getfile };
