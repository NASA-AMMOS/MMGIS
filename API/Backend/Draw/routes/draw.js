const express = require("express");
const logger = require("../../../logger");
const database = require("../../../database");
const Sequelize = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const fhistories = require("../models/filehistories");
const Filehistories = fhistories.Filehistories;
const FilehistoriesTEST = fhistories.FilehistoriesTEST;
const ufiles = require("../models/userfiles");
const Userfiles = ufiles.Userfiles;
const UserfilesTEST = ufiles.UserfilesTEST;
const uf = require("../models/userfeatures");
const Userfeatures = uf.Userfeatures;
const UserfeaturesTEST = uf.UserfeaturesTEST;

const filesutils = require("./filesutils");
const getfile = filesutils.getfile;

const { sequelize } = require("../../../connection");

const router = express.Router();
const db = database.db;
const triggerWebhooks = require("../../Webhooks/processes/triggerwebhooks");

router.post("/", function (req, res, next) {
  res.send("test draw");
});

/**
 * Crops out duplicate array elements between arrays
 * Ex.
 *  arr1=['a','b'], arr2=['b'] -> ['a']
 *
 * @param {[]} arr1
 * @param {[]} arr2
 * @return {[]} arr1 without any elements of arr2
 */
const uniqueAcrossArrays = (arr1, arr2) => {
  let uniqueArr = Object.assign([], arr1);
  for (let i = uniqueArr.length - 1; i >= 0; i--) {
    if (arr2.indexOf(arr1[i]) != -1) uniqueArr.splice(i, 1);
  }

  return uniqueArr;
};

const pushToHistory = (
  Table,
  res,
  file_id,
  feature_id,
  feature_idRemove,
  time,
  undoToTime,
  action_index,
  user,
  successCallback,
  failureCallback
) => {
  Table.findAll({
    limit: 1,
    where: {
      file_id: file_id,
    },
    order: [["history_id", "DESC"]],
  })
    .then((lastHistory) => {
      let maxHistoryId = -Infinity;
      let bestI = -1;
      if (lastHistory && lastHistory.length > 0) {
        return {
          historyIndex: lastHistory[0].history_id + 1,
          history: lastHistory[0].history,
        };
      } else return { historyIndex: 0, history: [] };
    })
    .then((historyObj) => {
      getNextHistory(
        Table,
        historyObj.history,
        action_index,
        feature_id,
        feature_idRemove,
        file_id,
        undoToTime,
        (h) => {
          let newHistoryEntry = {
            file_id: file_id,
            history_id: historyObj.historyIndex,
            time: time,
            action_index: action_index,
            history: h,
            author: user,
          };
          // Insert new entry into the history table
          Table.create(newHistoryEntry)
            .then((created) => {
              successCallback();
              triggerWebhooks("drawFileChange", {
                id: file_id,
                res,
              });
              return null;
            })
            .catch((err) => {
              failureCallback(err);
            });
        },
        (err) => {
          failureCallback(err);
        }
      );
      return null;
    });
};

const getNextHistory = (
  Table,
  history,
  action_index,
  feature_idAdd,
  feature_idRemove,
  file_id,
  undoToTime,
  successCallback,
  failureCallback
) => {
  switch (action_index) {
    case 0: //add
      history.push(feature_idAdd);
      if (Array.isArray(feature_idAdd)) history = feature_idAdd;
      successCallback(history);
      return;
    case 1: //edit
      history.splice(history.indexOf(parseInt(feature_idRemove)), 1);
      history.push(feature_idAdd);
      successCallback(history);
      return;
    case 2: //delete
      history.splice(history.indexOf(parseInt(feature_idRemove)), 1);
      successCallback(history);
      return;
    case 3: //undo
      //Here we do want to use the last history, we want to use the history at undo to time
      Table.findOne({
        where: {
          file_id: file_id,
          time: undoToTime,
        },
      })
        .then((history) => {
          successCallback(history.history);
          return null;
        })
        .catch((err) => {
          failureCallback(err);
          return null;
        });
      break;
    case 5: //Clip add over
    case 6: //Merge add array of add ids and remove array of remove ids
    case 7: //Clip add under
    case 8: //Split
      //add
      history = history.concat(feature_idAdd);
      //remove
      history = uniqueAcrossArrays(history, feature_idRemove);
      successCallback(history);
      return;
    default:
      failureCallback("Unknown action_index: " + action_index);
  }
};

/**
 *
 * @param {number} file_id
 * @param {number} added_id
 */
const clipOver = function (
  req,
  res,
  file_id,
  added_id,
  time,
  successCallback,
  failureCallback
) {
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  //CLIP OVER
  Histories.findAll({
    limit: 1,
    where: {
      file_id: file_id,
    },
    order: [["history_id", "DESC"]],
  })
    .then((lastHistory) => {
      let maxHistoryId = -Infinity;
      let bestI = -1;
      if (lastHistory && lastHistory.length > 0) {
        return {
          historyIndex: lastHistory[0].history_id + 1,
          history: lastHistory[0].history,
        };
      } else return { historyIndex: 0, history: [] };
    })
    .then((historyObj) => {
      let history = historyObj.history;
      //RETURN ALL THE CHANGED SHAPE IDs AND GEOMETRIES
      let q = [
        "SELECT clipped.id, ST_AsGeoJSON( (ST_Dump(clipped.newgeom)).geom ) AS newgeom FROM",
        "(",
        "SELECT data.id, data.newgeom",
        "FROM (",
        "SELECT r.id, ST_DIFFERENCE(ST_MakeValid(r.geom),",
        "ST_MakeValid((",
        "SELECT a.geom",
        "FROM user_features" +
          (req.body.test === "true" ? "_tests" : "") +
          " AS a",
        "WHERE a.id = :added_id AND ST_INTERSECTS(a.geom, r.geom)",
        "))",
        ") AS newgeom",
        "FROM user_features" +
          (req.body.test === "true" ? "_tests" : "") +
          " AS r",
        "WHERE r.file_id = :file_id AND r.id != :added_id AND r.id IN (" +
          ":history" +
          ")",
        ") data",
        "WHERE data.newgeom IS NOT NULL",
        ") AS clipped",
      ].join(" ");
      sequelize
        .query(q, {
          replacements: {
            file_id: file_id,
            added_id: added_id,
            history: history,
          },
        })
        .then(([results]) => {
          let oldIds = [];
          let newIds = [added_id];

          editLoop(0);
          function editLoop(i) {
            if (i >= results.length) {
              pushToHistory(
                Histories,
                res,
                req.body.file_id,
                newIds,
                oldIds,
                time,
                null,
                5,
                req.user,
                () => {
                  if (typeof successCallback === "function") successCallback();
                },
                (err) => {
                  if (typeof failureCallback === "function")
                    failureCallback(err);
                },
                "addandremove"
              );
              return;
            }
            let newReq = Object.assign({}, req);
            results[i].newgeom.crs = {
              type: "name",
              properties: { name: "EPSG:4326" },
            };
            newReq.body = {
              file_id: file_id,
              feature_id: results[i].id,
              geometry: results[i].newgeom,
              to_history: false,
              test: req.body.test,
            };

            if (oldIds.indexOf(results[i].id) == -1) oldIds.push(results[i].id);
            edit(
              newReq,
              res,
              (newId) => {
                newIds.push(newId);
                editLoop(i + 1);
              },
              () => {
                editLoop(i + 1);
              }
            );
          }

          return null;
        })
        .catch((err) => {
          failureCallback(err);
        });

      return null;
    })
    .catch((err) => {
      failureCallback(err);
    });
};

const clipUnder = function (
  req,
  res,
  newFeature,
  time,
  successCallback,
  failureCallback
) {
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  Histories.findAll({
    limit: 1,
    where: {
      file_id: newFeature.file_id,
    },
    order: [["history_id", "DESC"]],
  })
    .then((lastHistory) => {
      let maxHistoryId = -Infinity;
      let bestI = -1;
      if (lastHistory && lastHistory.length > 0) {
        return {
          historyIndex: lastHistory[0].history_id + 1,
          history: lastHistory[0].history,
        };
      } else return { historyIndex: 0, history: [] };
    })
    .then((historyObj) => {
      let history = historyObj.history;

      //Continually clip the added feature with the other features of the file
      let q = [
        "WITH RECURSIVE clipper (n, clippedgeom) AS (",
        "SELECT 0 n, ST_MakeValid(ST_GeomFromGeoJSON(:geom)) clippedgeom",
        "UNION ALL",
        "SELECT n+1, ST_DIFFERENCE(",
        "clippedgeom,",
        "(",
        "SELECT ST_BUFFER(",
        "ST_UNION(",
        "ARRAY((",
        "SELECT ST_BUFFER(a.geom, 0.000001, 'join=mitre')",
        "FROM user_features" +
          (req.body.test === "true" ? "_tests" : "") +
          " AS a",
        "WHERE a.id IN (" +
          ":history" +
          ") AND ST_INTERSECTS(a.geom, clippedgeom)",
        "))",
        "),",
        "-0.000001,'join=mitre')",
        ")",
        ")",
        "FROM clipper",
        "WHERE n < 1",
        ")",
        "SELECT ST_AsGeoJSON( (ST_Dump(clipped.clippedgeom)).geom ) as geom FROM",
        "(",
        "SELECT c.n, c.clippedgeom as clippedgeom FROM clipper c",
        "WHERE c.clippedgeom IS NOT NULL",
        "ORDER by c.n DESC LIMIT 1",
        ") AS clipped",
      ].join(" ");

      sequelize
        .query(q, {
          replacements: {
            geom: JSON.stringify(newFeature.geom),
            history: history,
          },
        })
        .then(([results]) => {
          let oldIds = [];
          let newIds = [];

          addLoop(0);
          function addLoop(i) {
            if (i >= results.length) {
              pushToHistory(
                Histories,
                res,
                req.body.file_id,
                newIds,
                oldIds,
                time,
                null,
                7,
                req.user,
                () => {
                  if (typeof successCallback === "function") successCallback();
                },
                (err) => {
                  if (typeof failureCallback === "function")
                    failureCallback(err);
                }
              );
              return null;
            }
            let clippedFeature = Object.assign({}, newFeature);
            clippedFeature.properties = JSON.parse(newFeature.properties);
            clippedFeature.geom = JSON.parse(results[i].geom);
            clippedFeature.geom.crs = {
              type: "name",
              properties: { name: "EPSG:4326" },
            };
            clippedFeature.properties.uuid = uuidv4();
            clippedFeature.properties = JSON.stringify(
              clippedFeature.properties
            );

            Features.create(clippedFeature)
              .then((created) => {
                newIds.push(created.id);
                //now update the
                addLoop(i + 1);
                return null;
              })
              .catch((err) => {
                addLoop(i + 1);
                return null;
                //failureCallback();
              });
          }

          return null;
        })
        .catch((err) => {
          failureCallback(err);
        });

      return null;
    })
    .catch((err) => {
      failureCallback(err);
    });
};

const _templateConform = (req, from) => {
  return new Promise((resolve, reject) => {
    req.body.id = req.body.file_id;

    getfile(req, {
      send: (r) => {
        if (r.status === "success") {
          const geojson = r.body.geojson;
          const template =
            r.body.file?.[0]?.dataValues?.template?.template || [];
          const existingProperties = JSON.parse(req.body.properties || "{}");
          const templaterProperties = {};

          template.forEach((t, idx) => {
            switch (t.type) {
              case "incrementer":
                const nextIncrement = _getNextIncrement(
                  existingProperties[t.field],
                  t,
                  geojson.features,
                  existingProperties,
                  from
                );
                if (nextIncrement.error != null) {
                  reject(nextIncrement.error);
                  return;
                } else templaterProperties[t.field] = nextIncrement.newValue;
                break;
              default:
            }
          });

          req.body.properties = JSON.stringify({
            ...existingProperties,
            ...templaterProperties,
          });
        }
        resolve();
        return;
      },
    });

    function _getNextIncrement(value, t, layer, existingProperties) {
      if (value == null) return 0;

      const response = {
        newValue: value,
        error: null,
      };

      let usedValues = [];
      const split = (t._default || t.default).split("#");
      const start = split[0];
      const end = split[1];

      for (let i = 0; i < layer.length; i++) {
        if (layer[i] == null) continue;
        let geojson = layer[i];
        if (geojson?.properties?.[t.field] != null) {
          let featuresVal = geojson?.properties?.[t.field];

          featuresVal = featuresVal.replace(start, "").replace(end, "");

          if (featuresVal !== "#") {
            featuresVal = parseInt(featuresVal);
            usedValues.push(featuresVal);
          }
        }
      }

      if ((response.newValue || "").indexOf("#") !== -1) {
        // Actually increment the incrementer for the first time
        let bestVal = 0;
        usedValues.sort(function (a, b) {
          return a - b;
        });
        usedValues = [...new Set(usedValues)]; // makes it unique
        usedValues.forEach((v) => {
          if (bestVal === v) bestVal++;
        });
        response.newValue = response.newValue.replace("#", bestVal);
      } else if (existingProperties) {
        let numVal = response.newValue.replace(start, "").replace(end, "");
        if (numVal != "#") {
          numVal = parseInt(numVal);
          if (existingProperties[t.field] === response.newValue) {
            // In case of a resave, make sure the id exists only once
            let count = 0;
            usedValues.forEach((v) => {
              if (numVal === v) count++;
            });
            if (count > 1)
              response.error = `Incrementing field: '${t.field}' is not unique`;
          } else {
            // In case a manual change, make sure the id is unique
            if (usedValues.indexOf(numVal) !== -1)
              response.error = `Incrementing field: '${t.field}' is not unique`;
          }
        }
      }

      // Check that the field still matches the surrounding string
      const incRegex = new RegExp(`^${start}\\d+${end}$`);
      if (incRegex.test(response.newValue) == false) {
        response.error = `Incrementing field: '${t.field}' must follow syntax: '${start}{#}${end}'`;
      }

      // Check that incrementer is unique
      let numMatches = 0;
      for (let i = 0; i < layer.length; i++) {
        if (layer[i] == null) continue;
        let geojson = layer[i];
        if (geojson?.properties?.[t.field] != null) {
          let featuresVal = geojson?.properties?.[t.field];
          if (
            (value || "").indexOf("#") == -1 &&
            response.newValue === featuresVal &&
            geojson?.properties?.uuid != existingProperties.uuid
          ) {
            numMatches++;
          }
        }
      }
      // If we're are editing and the value did not change, allow a single match
      if (numMatches > 0) {
        response.error = `Incrementing field: '${t.field}' is not unique`;
      }

      return response;
    }
  });
};
/**
 * Adds a feature
 * {
 * 	file_id: <number> (required)
 * 	parent: <number> (optional)
 *  order: <'min' || 'max' || int> (optional)
 * 		'min' and < 0 adds behind all features
 *  keywords: <string array> (optional)
 *  intent: <string> (optional)
 *  properties: <object> (optional)
 * 	geometry: <geometry> (required)
 * }
 */
const add = async function (
  req,
  res,
  successCallback,
  failureCallback1,
  failureCallback2
) {
  let failedTemplate = false;
  await _templateConform(req, "add").catch((err) => {
    failedTemplate = err;
  });
  if (failedTemplate !== false) {
    if (typeof failureCallback2 === "function")
      failureCallback2(failedTemplate);
    return;
  }

  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  if (req.body.to_history == null) req.body.to_history = true;

  //Check that the provided file_id is an id that belongs to the current user
  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  }).then((file) => {
    if (!file) {
      if (typeof failureCallback1 === "function") failureCallback1();
    } else {
      //Find the next level
      let order = "max";
      if (req.body.order == "min" || req.body.order < 0) order = "min";

      Features.findAll({
        where: {
          file_id: req.body.file_id,
        },
      })
        .then((features) => {
          let maxLevel = -Infinity;
          let minLevel = Infinity;
          if (features && features.length > 0) {
            for (let i = 0; i < features.length; i++) {
              maxLevel = Math.max(features[i].level, maxLevel);
              minLevel = Math.min(features[i].level, minLevel);
            }
            if (order === "max") return maxLevel + 1;
            else return minLevel - 1;
          } else return 0;
        })
        .then((level) => {
          let properties = req.body.properties || {};
          //Remove _ from properties if it has it. This is because the server returns metadata
          // under _ and we don't want it to potentially nest
          delete properties["_"];

          let geom = JSON.parse(req.body.geometry);
          //Geometry needs this for the spatialiness to work
          geom.crs = { type: "name", properties: { name: "EPSG:4326" } };

          let newFeature = {
            file_id: req.body.file_id,
            level: level,
            intent: req.body.intent,
            elevated: "0",
            properties: properties,
            geom: geom,
          };

          if (req.body.clip === "under") {
            clipUnder(
              req,
              res,
              newFeature,
              time,
              (createdId, createdIntent) => {
                if (typeof successCallback === "function")
                  successCallback(createdId, createdIntent);
              },
              (err) => {
                if (typeof failureCallback2 === "function")
                  failureCallback2(err);
              }
            );
          } else {
            newFeature.properties = JSON.parse(newFeature.properties);
            newFeature.properties.uuid = uuidv4();
            newFeature.properties = JSON.stringify(newFeature.properties);
            // Insert new feature into the feature table
            Features.create(newFeature)
              .then((created) => {
                if (req.body.to_history) {
                  let id = created.id;
                  if (req.body.bulk_ids != null) {
                    id = req.body.bulk_ids;
                    id.push(created.id);
                  }
                  if (req.body.clip === "over") {
                    clipOver(
                      req,
                      res,
                      newFeature.file_id,
                      id,
                      time,
                      () => {
                        if (typeof successCallback === "function")
                          successCallback(created.id, created.intent);
                      },
                      (err) => {
                        if (typeof failureCallback2 === "function")
                          failureCallback2(err);
                      }
                    );
                  } else {
                    pushToHistory(
                      Histories,
                      res,
                      req.body.file_id,
                      id,
                      null,
                      time,
                      null,
                      0,
                      req.user,
                      () => {
                        if (typeof successCallback === "function")
                          successCallback(created.id, created.intent);
                      },
                      (err) => {
                        if (typeof failureCallback2 === "function")
                          failureCallback2(err);
                      }
                    );
                  }
                } else {
                  if (typeof successCallback === "function")
                    successCallback(created.id, created.intent);
                }
                return null;
              })
              .catch((err) => {
                if (typeof failureCallback2 === "function")
                  failureCallback2(err);
              });
          }
        });
      return null;
    }
  });
};
router.post("/add", function (req, res, next) {
  add(
    req,
    res,
    (id, intent) => {
      logger("info", "Successfully added a new feature.", req.originalUrl, req);
      res.send({
        status: "success",
        message: "Successfully added a new feature.",
        body: { id: id, intent: intent },
      });
    },
    (err) => {
      logger("error", "Failed to access file.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to access file.",
        body: {},
      });
    },
    (err) => {
      logger("error", "Failed to add new feature.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to add new feature.",
        body: {},
      });
    }
  );
});

/**
 * Edits a feature
 * {
 * 	file_id: <number> (required)
 *  feature_id: <number> (required)
 * 	parent: <number> (optional)
 *  keywords: <string array> (optional)
 *  intent: <string> (optional)
 *  properties: <object> (optional)
 * 	geometry: <geometry> (optional)
 * }
 */
const edit = async function (req, res, successCallback, failureCallback) {
  let failedTemplate = false;
  await _templateConform(req, "edit").catch((err) => {
    failedTemplate = err;
  });
  if (failedTemplate !== false) {
    if (typeof failureCallback === "function") failureCallback(failedTemplate);
    return;
  }

  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  if (req.body.to_history == null) req.body.to_history = true;

  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  })
    .then((file) => {
      if (!file) {
        failureCallback();
      } else {
        Features.findOne({
          where: {
            id: req.body.feature_id,
            file_id: req.body.file_id,
          },
          attributes: {
            include: [
              [
                Sequelize.fn("ST_AsGeoJSON", Sequelize.col("geom")),
                "geojson_geom",
              ],
            ],
          },
        })
          .then((feature) => {
            if (!feature && !req.body.addIfNotFound) {
              failureCallback();
            } else {
              var newAttributes = feature.dataValues;

              delete newAttributes["id"];
              delete newAttributes.properties["_"];
              newAttributes.extant_start = time;

              if (req.body.hasOwnProperty("parent"))
                newAttributes.parent = req.body.parent;
              if (req.body.hasOwnProperty("keywords"))
                newAttributes.keywords = req.body.keywords;
              if (req.body.hasOwnProperty("intent"))
                newAttributes.intent = req.body.intent;
              if (req.body.hasOwnProperty("properties"))
                newAttributes.properties = req.body.properties;
              if (req.body.hasOwnProperty("geometry")) {
                newAttributes.geom = JSON.parse(req.body.geometry);
              } else {
                newAttributes.geom = JSON.parse(
                  feature.dataValues.geojson_geom
                );
              }
              if (
                req.body.hasOwnProperty("reassignUUID") &&
                req.body.reassignUUID == "true"
              ) {
                newAttributes.properties = JSON.parse(newAttributes.properties);
                newAttributes.properties.uuid = uuidv4();
                newAttributes.properties = JSON.stringify(
                  newAttributes.properties
                );
              }

              newAttributes.geom.crs = {
                type: "name",
                properties: { name: "EPSG:4326" },
              };

              Features.create(newAttributes)
                .then((created) => {
                  let createdId = created.id;
                  let createdUUID = JSON.parse(created.properties).uuid;
                  let createdIntent = created.intent;

                  if (req.body.to_history) {
                    pushToHistory(
                      Histories,
                      res,
                      req.body.file_id,
                      created.id,
                      req.body.feature_id,
                      time,
                      null,
                      1,
                      req.user,
                      () => {
                        successCallback(createdId, createdUUID, createdIntent);
                      },
                      (err) => {
                        failureCallback(err);
                      }
                    );
                  } else {
                    successCallback(createdId, createdUUID, createdIntent);
                  }
                  return null;
                })
                .catch((err) => {
                  failureCallback(err);
                });
            }
            return null;
          })
          .catch((err) => {
            failureCallback(err);
          });
      }

      return null;
    })
    .catch((err) => {
      failureCallback(err);
    });
};

router.post("/edit", function (req, res) {
  edit(
    req,
    res,
    (createdId, createdUUID, createdIntent) => {
      logger("info", "Successfully edited feature.", req.originalUrl, req);
      res.send({
        status: "success",
        message: "Successfully edited feature.",
        body: { id: createdId, uuid: createdUUID, intent: createdIntent },
      });
    },
    (err) => {
      logger("error", "Failed to edit feature.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to edit feature.",
        body: {
          error: err,
        },
      });
    }
  );
});

/**
 * Hides a feature
 * {
 * 	file_id: <number> (required)
 *  feature_id: <number> (required)
 * }
 */
router.post("/remove", function (req, res, next) {
  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  }).then((file) => {
    if (!file) {
      logger("error", "Failed to access file.", req.originalUrl, req);
      res.send({
        status: "failure",
        message: "Failed to access file.",
        body: {},
      });
    } else {
      Features.update(
        {
          extant_end: time,
        },
        {
          where: {
            file_id: req.body.file_id,
            id: req.body.id,
          },
        }
      )
        .then(() => {
          //Table, file_id, feature_id, feature_idRemove, time, undoToTime, action_index
          pushToHistory(
            Histories,
            res,
            req.body.file_id,
            null,
            req.body.id,
            time,
            null,
            2,
            req.user,
            () => {
              logger("info", "Feature removed.", req.originalUrl, req);
              res.send({
                status: "success",
                message: "Feature removed.",
                body: {},
              });
            },
            (err) => {
              logger(
                "error",
                "Failed to remove feature.",
                req.originalUrl,
                req,
                err
              );
              res.send({
                status: "failure",
                message: "Failed to remove feature.",
                body: {},
              });
            }
          );

          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Failed to find and remove feature.",
            req.originalUrl,
            req,
            err
          );
          res.send({
            status: "failure",
            message: "Failed to find and remove feature.",
            body: {},
          });
        });
    }

    return null;
  });
});

/**
 * Undoes drawings
 * {
 * 	file_id: <number> (required)
 *  undo_time: <number> (required)
 * }
 */
router.post("/undo", function (req, res, next) {
  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  }).then((file) => {
    if (!file) {
      logger("error", "Failed to access file.", req.originalUrl, req);
      res.send({
        status: "failure",
        message: "Failed to access file.",
        body: {},
      });
    } else {
      Features.update(
        {
          trimmed_start: Sequelize.fn(
            "array_append",
            Sequelize.col("trimmed_start"),
            req.body.undo_time
          ),
          trimmed_at: Sequelize.fn(
            "array_append",
            Sequelize.col("trimmed_at"),
            String(time)
          ),
          trimmed_at_final: time,
        },
        {
          where: {
            file_id: req.body.file_id,

            [Sequelize.Op.or]: {
              [Sequelize.Op.and]: {
                extant_start: {
                  [Sequelize.Op.gt]: req.body.undo_time,
                },
                [Sequelize.Op.or]: {
                  extant_end: {
                    [Sequelize.Op.gt]: req.body.undo_time,
                  },
                  extant_end: null,
                },
              },
              trimmed_at_final: {
                //undo time less than any trimmed end value
                [Sequelize.Op.lte]: time,
              },
            },
          },
        }
      )
        .then((r) => {
          pushToHistory(
            Histories,
            res,
            req.body.file_id,
            null,
            null,
            time,
            req.body.undo_time,
            3,
            req.user,
            () => {
              logger("info", "Undo successful.", req.originalUrl, req);
              res.send({
                status: "success",
                message: "Undo successful.",
                body: {},
              });
            },
            (err) => {
              logger("error", "Failed to undo.", req.originalUrl, req, err);
              res.send({
                status: "failure",
                message: "Failed to undo.",
                body: {},
              });
            }
          );

          return null;
        })
        .catch((err) => {
          logger("error", "Failed to undo file.", req.originalUrl, req, err);
          res.send({
            status: "failure",
            message: "Failed to undo file.",
            body: {},
          });
        });
    }

    return null;
  });
});

/**
 * Merge features
 * {
 * 	file_id: <number> (required)
 * 	prop_id: <number> - feature id whose properties will be copied (required)
 *  ids: <int array> - of all the ids to merge together
 * }
 */
router.post("/merge", function (req, res, next) {
  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  //Add prop_ids to ids if it's not already there
  if (req.body.ids.indexOf(req.body.prop_id) == -1)
    req.body.ids.push(req.body.prop_id);

  ///Check that the provided file_id is an id that belongs to the current user
  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  })
    .then((file) => {
      if (!file) {
        logger("error", "Failed to access file.", req.originalUrl, req);
        res.send({
          status: "failure",
          message: "Failed to access file.",
          body: {},
        });
      } else {
        Features.findOne({
          where: {
            id: req.body.prop_id,
          },
        }).then((feature) => {
          let ids = req.body.ids;
          if (ids == null) ids = null;
          if (!Array.isArray(ids)) ids = [ids];
          if (ids.length === 0) ids = null;

          let q;
          if (feature.geom.type == "LineString") {
            q = [
              "SELECT ST_AsGeoJSON( (ST_Dump(mergedgeom.geom)).geom ) AS merged FROM",
              "(",
              "SELECT ST_LineMerge(ST_Union(geom)) AS geom",
              "FROM user_features" +
                (req.body.test === "true" ? "_tests" : "") +
                " AS a",
              "WHERE a.id IN (:ids) AND a.file_id = :file_id",
              ") AS mergedgeom",
            ].join(" ");
          } else {
            q = [
              "SELECT ST_AsGeoJSON( (ST_Dump(mergedgeom.geom)).geom ) as merged FROM",
              "(",
              "SELECT ST_BUFFER(ST_UNION(",
              "ARRAY((",
              "SELECT ST_BUFFER(geom, 0.000001, 'join=mitre')",
              "FROM user_features" +
                (req.body.test === "true" ? "_tests" : "") +
                " AS a",
              "WHERE a.id IN (:ids)",
              "))",
              "), -0.000001,'join=mitre') AS geom",
              ") AS mergedgeom",
            ].join(" ");
          }
          sequelize
            .query(q, {
              replacements: {
                file_id: req.body.file_id,
                ids: ids,
              },
            })
            .then(([results]) => {
              let oldIds = req.body.ids.map(function (id) {
                return parseInt(id, 10);
              });

              let newIds = [];

              addLoop(0);
              function addLoop(i) {
                if (i >= results.length) {
                  pushToHistory(
                    Histories,
                    res,
                    req.body.file_id,
                    newIds,
                    oldIds,
                    time,
                    null,
                    6,
                    req.user,
                    () => {
                      logger(
                        "info",
                        "Successfully merged " +
                          req.body.ids.length +
                          " features.",
                        req.originalUrl,
                        req
                      );
                      res.send({
                        status: "success",
                        message:
                          "Successfully merged " +
                          req.body.ids.length +
                          " features.",
                        body: { ids: newIds },
                      });
                    },
                    (err) => {
                      logger(
                        "error",
                        "Merge failure.",
                        req.originalUrl,
                        req,
                        err
                      );
                      res.send({
                        status: "failure",
                        message: "Merge failure.",
                        body: {},
                      });
                    }
                  );
                  return null;
                }
                let mergedFeature = JSON.parse(JSON.stringify(feature));
                mergedFeature.geom = JSON.parse(results[i].merged);
                mergedFeature.geom.crs = {
                  type: "name",
                  properties: { name: "EPSG:4326" },
                };
                delete mergedFeature.id;

                Features.create(mergedFeature)
                  .then((created) => {
                    newIds.push(created.id);
                    addLoop(i + 1);
                    return null;
                  })
                  .catch((err) => {
                    addLoop(i + 1);
                    return null;
                    //failureCallback();
                  });
              }
            })
            .catch((err) => {
              logger("error", "Failed to merge.", req.originalUrl, req, err);
              res.send({
                status: "failure",
                message: "Failed to merge.",
                body: {},
              });

              return null;
            });
        });
      }
    })
    .catch((err) => {
      logger("error", "Failed to merge.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to merge.",
        body: {},
      });

      return null;
    });
});

/**
 * split features
 * {
 * 	file_id: <number> (required)
 * 	split: <line feature> - feature to split against (required)
 *  ids: <int array> - of all the ids to perform the split against
 * }
 */
router.post("/split", function (req, res, next) {
  let Files = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Features = req.body.test === "true" ? UserfeaturesTEST : Userfeatures;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  let splitFeature = JSON.parse(req.body.split);

  ///Check that the provided file_id is an id that belongs to the current user
  Files.findOne({
    where: {
      id: req.body.file_id,
      [Sequelize.Op.or]: [
        { file_owner: req.user },
        {
          [Sequelize.Op.and]: {
            file_owner: "group",
            file_owner_group: { [Sequelize.Op.overlap]: groups },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "list_edit",
            public_editors: { [Sequelize.Op.contains]: [req.user] },
          },
        },
        {
          [Sequelize.Op.and]: {
            public: "1",
            publicity_type: "all_edit",
          },
        },
      ],
    },
  })
    .then((file) => {
      if (!file) {
        logger("error", "Failed to access file.", req.originalUrl, req);
        res.send({
          status: "failure",
          message: "Failed to access file.",
          body: {},
        });
      } else {
        let ids = req.body.ids;

        if (ids == null) ids = null;
        if (!Array.isArray(ids)) ids = [ids];
        if (ids.length === 0) ids = null;

        let geom = splitFeature.geometry;
        geom.crs = { type: "name", properties: { name: "EPSG:4326" } };

        let q = [
          "SELECT g.id, g.file_id, g.level, g.intent, g.properties, ST_SPLIT(ST_SetSRID(g.geom, 4326), ST_GeomFromGeoJSON(:geom)) FROM",
          "(",
          "SELECT id, file_id, level, intent, properties, geom",
          "FROM user_features AS a",
          "WHERE a.id IN (:ids) AND a.file_id = :file_id",
          ") AS g",
        ].join(" ");
        sequelize
          .query(q, {
            replacements: {
              file_id: parseInt(req.body.file_id),
              geom: JSON.stringify(geom),
              ids: ids,
            },
          })
          .then(([results]) => {
            //reformat results
            let r = [];
            for (var i = 0; i < results.length; i++) {
              for (var j = 0; j < results[i].st_split.geometries.length; j++) {
                //If the length is 1, then no split occurred
                if (results[i].st_split.geometries.length > 1)
                  r.push({
                    file_id: results[i].file_id,
                    intent: results[i].intent,
                    level: results[i].level,
                    properties: results[i].properties,
                    geom: results[i].st_split.geometries[j],
                  });
              }
            }

            let oldIds = req.body.ids.map(function (id) {
              return parseInt(id, 10);
            });

            let newIds = [];
            addLoop(0);
            function addLoop(i) {
              if (i >= r.length) {
                pushToHistory(
                  Histories,
                  res,
                  req.body.file_id,
                  newIds,
                  oldIds,
                  time,
                  null,
                  8,
                  req.user,
                  () => {
                    res.send({
                      status: "success",
                      message:
                        "Successfully split " +
                        req.body.ids.length +
                        " features.",
                      body: { ids: newIds },
                    });
                  },
                  (err) => {
                    logger(
                      "error",
                      "Split failure.",
                      req.originalUrl,
                      req,
                      err
                    );
                    res.send({
                      status: "failure",
                      message: "Split failure.",
                      body: {},
                    });
                  }
                );
                return null;
              }

              Features.create(r[i])
                .then((created) => {
                  newIds.push(created.id);
                  addLoop(i + 1);
                  return null;
                })
                .catch((err) => {
                  addLoop(i + 1);
                  return null;
                });
            }

            return null;
          })
          .catch((err) => {
            logger("error", "Failed to split.", req.originalUrl, req, err);
            res.send({
              status: "failure",
              message: "Failed to split.",
              body: {},
            });

            return null;
          });
      }
      return null;
    })
    .catch((err) => {
      logger("error", "Failed to split.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to split.",
        body: {},
      });

      return null;
    });
});

router.post("/replace", function (req, res, next) {
  res.send("test draw replace");
});

router.post("/sendtofront", function (req, res, next) {
  res.send("test draw front");
});

router.post("/sendtoback", function (req, res, next) {
  res.send("test draw back");
});

/**
 * Clears out testing tables
 */
router.post("/clear_test", function (req, res, next) {
  sequelize
    .query('TRUNCATE TABLE "user_features_tests" RESTART IDENTITY')
    .then(() => {
      sequelize
        .query('TRUNCATE TABLE "publisheds_tests" RESTART IDENTITY')
        .then(() => {
          sequelize
            .query('TRUNCATE TABLE "file_histories_tests" RESTART IDENTITY')
            .then(() => {
              sequelize
                .query('TRUNCATE TABLE "user_files_tests" RESTART IDENTITY')
                .then(() => {
                  //Add back sel files
                  makeMasterFilesTEST(req.leadGroupName, () => {
                    logger(
                      "info",
                      "Successfully cleared test tables.",
                      req.originalUrl,
                      req
                    );
                    res.send({
                      status: "success",
                      message: "Successfully cleared tables.",
                      body: {},
                    });

                    return null;
                  });

                  return null;
                })
                .catch((err) => {
                  logger(
                    "error",
                    "Failed to clear 1 test table. (C)",
                    req.originalUrl,
                    req,
                    err
                  );
                  res.send({
                    status: "failure",
                    message: "Failed to clear 1 table.",
                    body: {},
                  });

                  return null;
                });
              return null;
            })
            .catch((err) => {
              logger(
                "error",
                "Failed to clear 1 test table. (B)",
                req.originalUrl,
                req,
                err
              );
              res.send({
                status: "failure",
                message: "Failed to clear 1 table.",
                body: {},
              });
              return null;
            });

          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Failed to clear 1 test table. (A)",
            req.originalUrl,
            req,
            err
          );
          res.send({
            status: "failure",
            message: "Failed to clear 1 table.",
            body: {},
          });
          return null;
        });

      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to clear both test tables.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: "Failed to clear both tables",
        body: {},
      });

      return null;
    });
});

const makeMasterFilesTEST = (leadGroupName, callback) => {
  let intents = ["roi", "campaign", "campsite", "trail", "signpost"];
  makeMasterFileTEST(0, UserfilesTEST);

  function makeMasterFileTEST(i, Table) {
    let intent = intents[i];
    if (intent == null) {
      callback();
      return null;
    }

    Table.findOrCreate({
      where: {
        file_owner: "group",
        file_owner_group: [leadGroupName],
        file_name: intent.toUpperCase(),
        file_description: "Lead composed " + intent.toUpperCase() + "s.",
        is_master: true,
        intent: intent,
        public: "1",
        hidden: "0",
      },
    }).then(function ([userResult, created]) {
      makeMasterFileTEST(i + 1, Table);
      return null;
    });

    return null;
  }
};

module.exports = { router, add };
