/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
require("dotenv").config();
const express = require("express");
const router = express.Router();
const execFile = require("child_process").execFile;
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

const logger = require("../../../logger");
const Config = require("../models/config");
const config_template = require("../../../templates/config_template");
const userModel = require("../../Users/models/user");
const User = userModel.User;

// Sanitize user input to prevent XSS in error messages
function sanitizeInput(input) {
  if (typeof input !== "string") return String(input);
  return input.replace(/[<>'"&]/g, function (match) {
    switch (match) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#x27;";
      case "&":
        return "&amp;";
      default:
        return match;
    }
  });
}

const GeneralOptions = require("../../GeneralOptions/models/generaloptions");

const validate = require("../validate");
const populateUUIDs = require("../uuids");
const Utils = require("../../../utils.js");

const websocket = require("../../../websocket.js");
const WebSocket = require("isomorphic-ws");

const fs = require("fs");
const deepmerge = require("deepmerge");

let fullAccess = false;
if (
  !process.env.hasOwnProperty("HIDE_CONFIG") ||
  process.env.HIDE_CONFIG != "true"
)
  fullAccess = true;

// Middleware to check if admin user has permission to access specific mission
function checkMissionPermission(req, res, next) {
  // Determine if this is a long term token request or regular session
  let userPermission, userMissions, userId;
  
  if (req.isLongTermToken) {
    // Use token creator's permissions for long term tokens
    userPermission = req.tokenUserPermission;
    userMissions = req.tokenUserMissions;
    userId = null; // We don't need to lookup again since we have the data
  } else {
    // Use session permissions for regular requests
    userPermission = req.session.permission;
    userId = req.session.uid;
    userMissions = null; // Will be looked up from database
  }
  
  // SuperAdmins (111) have access to all missions
  if (userPermission === "111") {
    next();
    return;
  }
  
  // Regular users (not 110) should not access config endpoints  
  if (userPermission !== "110") {
    res.send({
      status: "failure", 
      message: "Unauthorized - insufficient permissions."
    });
    return;
  }
  
  // For Admins (110), check mission-specific permissions
  const mission = req.body.mission || req.query.mission;
  if (!mission) {
    next(); // No mission specified, let other validation handle it
    return;
  }
  
  // If we already have missions from token, use them directly
  if (req.isLongTermToken) {
    const managingMissions = userMissions || [];
    if (managingMissions.includes(mission)) {
      next();
    } else {
      res.send({
        status: "failure",
        message: `Unauthorized - no permission to access mission: ${mission}`
      });
    }
    return;
  }
  
  // For regular session users, get user's missions_managing array from database
  User.findOne({
    where: { id: userId },
    attributes: ["missions_managing"]
  })
  .then((user) => {
    if (!user) {
      res.send({
        status: "failure",
        message: "User not found."
      });
      return;
    }
    
    const managingMissions = user.missions_managing || [];
    if (managingMissions.includes(mission)) {
      next();
    } else {
      res.send({
        status: "failure",
        message: `Unauthorized - no permission to access mission: ${mission}`
      });
    }
  })
  .catch((err) => {
    logger("error", "Failed to check mission permissions.", req.originalUrl, req, err);
    res.send({
      status: "failure",
      message: "Failed to verify mission permissions."
    });
  });
}

function get(req, res, next, cb) {
  Config.findAll({
    limit: 1,
    where: {
      mission: req.query.mission,
    },
    order: [["id", "DESC"]],
  })
    .then((missions) => {
      if (missions && missions.length > 0) return missions[0].version;
      return 0;
    })
    .then((version) => {
      if (req.query.version) version = req.query.version;

      if (version < 0) {
        //mission doesn't exist
        if (cb)
          cb({
            status: "failure",
            message: `Mission not found. Bad version: ${version}.`,
          });
        else
          res.send({
            status: "failure",
            message: `Mission not found. Bad version: ${version}.`,
          });
        return null;
      } else {
        Config.findOne({
          where: {
            mission: req.query.mission,
            version: version,
          },
        })
          .then((mission) => {
            if (req.query.full) {
              if (cb)
                cb({
                  status: "success",
                  mission: mission.mission,
                  config: mission.config,
                  version: mission.version,
                });
              else
                res.send({
                  status: "success",
                  mission: mission.mission,
                  config: mission.config,
                  version: mission.version,
                });
            } else {
              if (cb) cb(mission.config);
              else res.send(mission.config);
            }
            return null;
          })
          .catch((err) => {
            if (cb)
              cb({
                status: "failure",
                message: `Mission '${sanitizeInput(
                  req.query.mission
                )} v${version}' not found.`,
              });
            else
              res.send({
                status: "failure",
                message: `Mission '${sanitizeInput(
                  req.query.mission
                )} v${version}' not found.`,
              });
            return null;
          });
      }
      return null;
    })
    .catch((err) => {
      if (cb) cb({ status: "failure", message: "Mission not found." });
      else res.send({ status: "failure", message: "Mission not found." });
      return null;
    });
  return null;
}
router.get("/get", function (req, res, next) {
  get(req, res, next);
});

function add(req, res, next, cb) {
  let configTemplate = JSON.parse(JSON.stringify(config_template));
  configTemplate = req.body.config || configTemplate;
  configTemplate.msv.mission = req.body.mission;

  // Fix validation logic: use OR conditions instead of AND
  if (
    req.body.mission !==
      req.body.mission.replace(
        /[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi,
        ""
      ) ||
    req.body.mission.length === 0 ||
    !isNaN(req.body.mission[0]) ||
    req.body.mission.includes("../") ||
    req.body.mission.includes("..\\")
  ) {
    logger("error", "Attempted to add bad mission name.", req.originalUrl, req);
    res.send({ status: "failure", message: "Bad mission name." });
    return;
  }

  let newConfig = {
    mission: req.body.mission,
    config: configTemplate,
    version: 0,
  };

  //Make sure the mission doesn't already exist
  Config.findOne({
    where: {
      mission: req.body.mission,
    },
  })
    .then((mission) => {
      if (!mission) {
        Config.create(newConfig)
          .then((created) => {
            if (req.body.makedir === "true") {
              let dir = "./Missions/" + created.mission;
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                let dir2 = dir + "/Layers";
                if (!fs.existsSync(dir2)) {
                  fs.mkdirSync(dir2);
                }
                let dir3 = dir + "/Data";
                if (!fs.existsSync(dir3)) {
                  fs.mkdirSync(dir3);
                }
              }
            }

            logger(
              "info",
              "Successfully created mission: " + created.mission,
              req.originalUrl,
              req
            );
            if (cb)
              cb({
                status: "success",
                mission: created.mission,
                version: created.version,
              });
            else
              res.send({
                status: "success",
                mission: created.mission,
                version: created.version,
              });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to create new mission.",
              req.originalUrl,
              req,
              err
            );
            if (cb)
              cb({
                status: "failure",
                message: "Failed to create new mission.",
              });
            else
              res.send({
                status: "failure",
                message: "Failed to create new mission.",
              });
            return null;
          });
      } else {
        logger("error", "Mission already exists.", req.originalUrl, req);
        if (cb) cb({ status: "failure", message: "Mission already exists." });
        else
          res.send({ status: "failure", message: "Mission already exists." });
      }
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to check if mission already exists.",
        req.originalUrl,
        req,
        err
      );
      if (cb)
        cb({
          status: "failure",
          message: "Failed to check if mission already exists.",
        });
      else
        res.send({
          status: "failure",
          message: "Failed to check if mission already exists.",
        });
      return null;
    });
  return null;
}

if (fullAccess)
  router.post("/add", function (req, res, next) {
    if (req.session.permission !== "111") {
      res.send({
        status: "failure",
        message: "Only SuperAdmins can add new missions.",
      });
      return null;
    }
    add(req, res, next);
  });

/**
 * Updates and mission's full config
 * @param req {object}
 * {
 *    mission: '',
 *    version?: 0,
 *    config?: {}
 * }
 */
function upsert(req, res, next, cb, info) {
  let hasVersion = false;
  req.body = req.body || {};

  info = info || {
    type: "upsert",
  };
  info.route = "config";
  info.id = req.body.id;
  info.mission = req.body.mission;

  if (req.body.version != null) hasVersion = true;
  let versionConfig = null;

  const forceClientUpdate = req.body?.forceClientUpdate || false;

  Config.findAll({
    where: {
      mission: req.body.mission,
    },
    order: [["id", "DESC"]],
  })
    .then((missions) => {
      missions.every(function (mission, i) {
        if (hasVersion && missions[i].version == req.body.version) {
          versionConfig = missions[i].config;
          return false;
        }
        return true;
      });

      if (missions && missions.length > 0) return missions[0].version;
      return -1;
    })
    .then((version) => {
      let configJSON;
      if (versionConfig) configJSON = versionConfig;
      else {
        if (typeof req.body.config === "string") {
          try {
            configJSON = JSON.parse(req.body.config);
          } catch (err) {
            if (cb)
              cb({
                status: "failure",
                message: "Stringified configuration object is not JSON.",
              });
            else
              res.send({
                status: "failure",
                message: "Stringified configuration object is not JSON.",
              });
          }
        } else configJSON = req.body.config;
      }

      const { newlyAddedUUIDs, allNewUUIDs } = populateUUIDs(configJSON);

      // Do not update the config if there are duplicate or bad UUIDs
      const badUUIDs = newlyAddedUUIDs
        .filter((i) => {
          return "replacesBadUUID" in i;
        })
        .map((i) => i.replacesBadUUID);

      if (badUUIDs.length > 0) {
        if (cb)
          cb({
            status: "failure",
            message: "There are duplicate or bad UUIDs.",
            badUUIDs,
          });
        else
          res.send({
            status: "failure",
            message: "There are duplicate or bad UUIDs.",
            badUUIDs,
          });
        return;
      }

      const validation = validate(configJSON);

      if (!validation.valid) {
        if (cb)
          cb({
            status: "failure",
            message: "Configuration object is invalid.",
            ...validation,
          });
        else
          res.send({
            status: "failure",
            message: "Configuration object is invalid.",
            ...validation,
          });
        return;
      }

      Config.create({
        mission: req.body.mission,
        config: configJSON,
        version: version + 1,
      })
        .then((created) => {
          logger(
            "info",
            "Successfully updated mission: " +
              created.mission +
              " v" +
              created.version,
            req.originalUrl,
            req
          );
          if (cb)
            cb({
              status: "success",
              mission: created.mission,
              version: created.version,
              newlyAddedUUIDs: newlyAddedUUIDs,
            });
          else
            res.send({
              status: "success",
              mission: created.mission,
              version: created.version,
              newlyAddedUUIDs: newlyAddedUUIDs,
            });

          if (info && info.layerName) {
            // Find the layer UUID instead of passing back the layer's display name
            let isArray = true;
            let infoLayerNames = info.layerName;
            if (!Array.isArray(info.layerName)) {
              infoLayerNames = [];
              infoLayerNames.push(info.layerName);
              isArray = false;
            }

            for (let i in infoLayerNames) {
              const found = allNewUUIDs.findIndex(
                (x) => x.name == infoLayerNames[i]
              );
              if (found > -1) {
                const result = allNewUUIDs[found];
                infoLayerNames[i] = result.uuid;
                allNewUUIDs.splice(found, 1);
              }
            }

            if (!isArray) {
              info.layerName = infoLayerNames[0];
            }
          }

          openWebSocket(
            req.body,
            {
              status: "success",
              mission: created.mission,
              version: created.version,
              newlyAddedUUIDs: newlyAddedUUIDs,
            },
            info,
            forceClientUpdate
          );
          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Failed to update mission.",
            req.originalUrl,
            req,
            err
          );
          if (cb)
            cb({ status: "failure", message: "Failed to update mission." });
          else
            res.send({
              status: "failure",
              message: "Failed to update mission.",
            });
          return null;
        });
      return null;
    })
    .catch((err) => {
      logger("error", "Failed to find mission.", req.originalUrl, req, err);
      if (cb) cb({ status: "failure", message: "Failed to find mission." });
      else res.send({ status: "failure", message: "Failed to find mission." });
      return null;
    });
  return null;
}

if (fullAccess)
  router.post("/upsert", checkMissionPermission, function (req, res, next) {
    upsert(req, res, next);
  });

router.get("/missions", function (req, res, next) {
  if (req.query.full === "true") {
    sequelize
      .query(
        "SELECT DISTINCT ON (mission) mission, version, config FROM configs ORDER BY mission ASC"
      )
      .then(([results]) => {
        res.send({ status: "success", missions: results });
        return null;
      })
      .catch((err) => {
        logger("error", "Failed to find missions.", req.originalUrl, req, err);
        res.send({ status: "failure", message: "Failed to find missions." });
        return null;
      });
  } else {
    Config.aggregate("mission", "DISTINCT", { plain: false })
      .then((missions) => {
        let allMissions = [];
        for (let i = 0; i < missions.length; i++)
          allMissions.push(missions[i].DISTINCT);
        allMissions.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        res.send({ status: "success", missions: allMissions });
        return null;
      })
      .catch((err) => {
        logger("error", "Failed to find missions.", req.originalUrl, req, err);
        res.send({ status: "failure", message: "Failed to find missions." });
        return null;
      });
  }
  return null;
});

// Get current user's mission permissions for the Configure page
router.get("/user-permissions", function (req, res, next) {
  // SuperAdmins can manage all missions
  if (req.session.permission === "111") {
    res.send({ 
      status: "success", 
      permission: "111",
      missions_managing: null  // null means all missions
    });
    return;
  }
  
  // Regular admins get their specific mission list
  if (req.session.permission === "110") {
    User.findOne({
      where: { id: req.session.uid },
      attributes: ["missions_managing"]
    })
    .then((user) => {
      res.send({
        status: "success",
        permission: "110", 
        missions_managing: user ? user.missions_managing || [] : []
      });
    })
    .catch((err) => {
      logger("error", "Failed to get user permissions.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to get user permissions." });
    });
    return;
  }
  
  // Non-admin users
  res.send({
    status: "success",
    permission: req.session.permission || "000",
    missions_managing: []
  });
});

if (fullAccess)
  router.get("/versions", function (req, res, next) {
    Config.findAll({
      where: {
        mission: req.query.mission,
      },
      attributes: ["mission", "version", "createdAt"],
      order: [["id", "ASC"]],
    })
      .then((missions) => {
        res.send({ status: "success", versions: missions });
        return null;
      })
      .catch((err) => {
        logger("error", "Failed to find versions.", req.originalUrl, req, err);
        res.send({ status: "failure", message: "Failed to find versions." });
        return null;
      });
    return null;
  });

function relativizePaths(config, mission) {
  let relConfig = JSON.parse(JSON.stringify(config));

  setAllKeys(relConfig, "../" + mission + "/");

  function setAllKeys(data, prepend) {
    if (typeof data === "object" && data !== null) {
      for (let k in data) {
        if (typeof data[k] === "object" && data[k] !== null)
          setAllKeys(data[k], prepend);
        else if (Array.isArray(data[k])) setAllKeys(data[k], prepend);
        else if (k == "url" || k == "demtileurl" || k == "legend")
          if (data[k].indexOf("://") == -1) data[k] = prepend + "" + data[k];
      }
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === "object" && data[i] !== null)
          setAllKeys(data[i], prepend);
        else if (Array.isArray(data[i])) setAllKeys(data[i], prepend);
      }
    }
  }

  return relConfig;
}

//existingMission
//cloneMission
//hasPaths
if (fullAccess)
  router.post("/clone", function (req, res, next) {
    req.query.full = true;
    req.query.mission = req.body.existingMission;

    get(req, res, next, function (r) {
      if (r.status == "success") {
        r.config.msv.mission = req.body.cloneMission;
        req.body.config =
          req.body.hasPaths == "true"
            ? relativizePaths(r.config, req.body.existingMission)
            : r.config;
        req.body.mission = req.body.cloneMission;
        execFile(
          "python",
          [
            "private/api/create_mission.py",
            encodeURIComponent(req.body.cloneMission),
          ],
          function (error, stdout, stderr) {
            stdout = JSON.parse(stdout);
            if (stdout.status == "success") {
              add(req, res, next, function (r2) {
                if (r2.status == "success") {
                  res.send(r2);
                } else {
                  res.send(r2);
                }
              });
            } else res.send(stdout);
          }
        );
      } else {
        res.send(r);
      }
    });
  });

if (fullAccess) router.post("/rename", function (req, res, next) {});

if (fullAccess)
  router.post("/destroy", function (req, res, next) {
    Config.destroy({
      where: {
        mission: req.body.mission,
      },
    })
      .then((mission) => {
        logger(
          "info",
          "Deleted Mission: " + req.body.mission,
          req.originalUrl,
          req
        );

        const dir = "./Missions/" + req.body.mission;
        if (fs.existsSync(dir)) {
          fs.rename(dir, dir + "_deleted_", (err) => {
            if (err)
              res.send({
                status: "success",
                message:
                  "Successfully Deleted Mission: " +
                  req.body.mission +
                  " but couldn't rename its Missions directory.",
              });
            else
              res.send({
                status: "success",
                message: "Successfully Deleted Mission: " + req.body.mission,
              });
          });
        } else {
          res.send({
            status: "success",
            message: "Successfully Deleted Mission: " + req.body.mission,
          });
        }
      })
      .catch((err) => {
        logger(
          "error",
          "Failed to delete mission: " + req.body.mission,
          req.originalUrl,
          req,
          err
        );
        res.send({
          status: "failure",
          message: "Failed to delete mission " + req.body.mission + ".",
        });
        return null;
      });
    return null;
  });

if (fullAccess)
  router.post("/validate", function (req, res, next) {
    let configJSON;
    if (typeof req.body.config === "string") {
      try {
        configJSON = JSON.parse(req.body.config);
      } catch (err) {
        res.send({
          status: "failure",
          message: "Stringified configuration object is not JSON.",
        });
      }
    } else configJSON = req.body.config;

    const validation = validate(configJSON);
    if (validation.valid) {
      res.send({
        status: "success",
        message: "Configuration object is valid.",
      });
    } else {
      res.send({
        status: "failure",
        message: "Configuration object is invalid.",
        errors: validation,
      });
    }
  });

function openWebSocket(body, response, info, forceClientUpdate) {
  if (
    !process.env.hasOwnProperty("ENABLE_MMGIS_WEBSOCKETS") ||
    process.env.ENABLE_MMGIS_WEBSOCKETS != "true"
  ) {
    return;
  }

  const port = parseInt(process.env.PORT || "8888", 10);
  const path = `${
    process.env.HTTPS == "true" ? "wss" : "ws"
  }://localhost:${port}${
    process.env.WEBSOCKET_ROOT_PATH || process.env.ROOT_PATH || ""
  }/`;
  try {
    const ws = new WebSocket(path);
    ws.onopen = function () {
      const data = {
        info,
        body,
        forceClientUpdate,
      };
      ws.send(JSON.stringify(data));
    };
  } catch (err) {
    console.log(err);
  }
}

// === Quick API Functions ===
function addLayer(req, res, next, cb, forceConfig, caller = "addLayer") {
  const exampleBody = {
    mission: "{mission_name}",
    layer: {
      name: "{new_layer_name}",
      type: "header || vector || vectortile || query || model || tile || data || image",
      "more...": "...",
    },
    "placement?": {
      "path?":
        "{path.to.header}, path to header in 'layers' to place new layer, a simple path ('sublayers' are added), default no group",
      "index?":
        "{0}, index in 'layers' to place new layer out of range placement indices are best fit; default end",
    },
    "forceClientUpdate?": "{true}; default false",
  };

  if (req.body.mission == null) {
    res.send({
      status: "failure",
      message: `Required parameter 'mission' is unset.`,
      example: exampleBody,
    });
    return;
  }
  if (req.body.layer == null) {
    res.send({
      status: "failure",
      message: `Required parameter 'layer' is unset.`,
      example: exampleBody,
    });
    return;
  }

  get(
    {
      query: {
        mission: req.body.mission,
      },
    },
    null,
    null,
    (config) => {
      config = forceConfig || config;
      if (config.status === "failure") {
        res.send(config);
      } else {
        try {
          let placementPath = req.body.placement?.path;
          let placementIndex = req.body.placement?.index;

          if (placementPath && typeof placementPath === "string") {
            placementPath = placementPath
              .replace(/\./g, ".sublayers.")
              .split(".")
              .concat("sublayers")
              .join(".");

            const level = Utils.getIn(config.layers, placementPath, null, true);
            if (level == null) {
              if (cb)
                cb({
                  status: "failure",
                  message: `Path specified in 'placement.path' not found in 'layers': ${placementPath}.`,
                });
              else
                res.send({
                  status: "failure",
                  message: `Path specified in 'placement.path' not found in 'layers': ${placementPath}.`,
                });
              return;
            }
            if (placementIndex == null) placementIndex = level.length;
            placementIndex = Math.max(
              0,
              Math.min(placementIndex, level.length)
            );

            placementPath += ".";
          } else {
            placementPath = "";
            if (placementIndex == null) placementIndex = config.layers.length;
            placementIndex = Math.max(
              0,
              Math.min(placementIndex, config.layers.length)
            );
          }

          let didSet = false;

          // Input can be object or array
          if (Array.isArray(req.body.layer)) {
            for (let i in req.body.layer) {
              // This adds the proposed_uuid key to all of the new layers/sublayers to be added that have
              // user defined UUIDs. We remove the proposed_uuid key after using it to check for unique UUIDs.
              Utils.traverseLayers([req.body.layer[i]], (layer) => {
                if (layer.uuid != null) {
                  layer.proposed_uuid = layer.uuid;
                }
              });

              didSet = Utils.setIn(
                config.layers,
                `${placementPath}${placementIndex}`,
                req.body.layer[i],
                true,
                true
              );

              placementIndex += 1;
            }
          } else {
            // This adds the proposed_uuid key to all of the new layers/sublayers to be added that have
            // user defined UUIDs. We remove the proposed_uuid key after using it to check for unique UUIDs.
            Utils.traverseLayers([req.body.layer], (layer) => {
              if (layer.uuid != null) {
                layer.proposed_uuid = layer.uuid;
              }
            });

            didSet = Utils.setIn(
              config.layers,
              `${placementPath}${placementIndex}`,
              req.body.layer,
              true,
              true
            );
          }

          if (didSet) {
            upsert(
              {
                body: {
                  mission: req.body.mission,
                  config: config,
                  forceClientUpdate: req.body.forceClientUpdate,
                },
              },
              null,
              null,
              (response) => {
                if (response.status === "success") {
                  if (cb) {
                    cb({
                      status: "success",
                      message: `Added layer to the ${response.mission} mission. Configuration versioned ${response.version}.`,
                      mission: response.mission,
                      version: response.version,
                      newlyAddedUUIDs: response.newlyAddedUUIDs,
                    });
                  } else {
                    res.send({
                      status: "success",
                      message: `Added layer to the ${response.mission} mission. Configuration versioned ${response.version}.`,
                      mission: response.mission,
                      version: response.version,
                      newlyAddedUUIDs: response.newlyAddedUUIDs,
                    });
                  }
                } else {
                  res.send(response);
                }
              },
              {
                type: caller,
                layerName: Array.isArray(req.body.layer)
                  ? req.body.layer.map((i) => i.name)
                  : req.body.layer.name,
              }
            );
          } else if (cb)
            cb({
              status: "failure",
              message: `Failed to add layer. setIn() operation failed.`,
            });
          else
            res.send({
              status: "failure",
              message: `Failed to add layer. setIn() operation failed.`,
            });
        } catch (err) {
          logger("error", "Failed to add layer.", req.originalUrl, req, err);
          if (cb)
            cb({
              status: "failure",
              message: `Failed to add layer. Uncaught reason.`,
            });
          else
            res.send({
              status: "failure",
              message: `Failed to add layer. Uncaught reason.`,
            });
        }
      }
    }
  );
}
if (fullAccess)
  router.post("/addLayer", checkMissionPermission, function (req, res, next) {
    addLayer(req, res, next);
  });

if (fullAccess)
  /**
   * /updateLayer
   * Finds the existing layer, merges new layer items, deletes and readds with addLayer.
   */
  router.post("/updateLayer", checkMissionPermission, function (req, res, next) {
    const exampleBody = {
      mission: "{mission_name}",
      layerUUID: "{existing_layer_uuid}",
      layer: {
        "...": "...",
      },
      "placement?": {
        "path?":
          "{path.to.header}, path to header in 'layers' to place new layer, a simple path ('sublayers' are added), default no group",
        "index?":
          "{0}, index in 'layers' to place new layer out of range placement indices are best fit; default end",
      },
      "forceClientUpdate?": "{true}; default false",
    };

    if (req.body.mission == null) {
      res.send({
        status: "failure",
        message: `Required parameter 'mission' is unset.`,
        example: exampleBody,
      });
      return;
    }
    if (req.body.layerUUID == null) {
      res.send({
        status: "failure",
        message: `Required parameter 'layerUUID' is unset. (a layer.uuid is not sufficient)`,
        example: exampleBody,
      });
      return;
    }
    if (req.body.layer == null) {
      res.send({
        status: "failure",
        message: `Required parameter 'layer' is unset.`,
        example: exampleBody,
      });
      return;
    }

    get(
      {
        query: {
          mission: req.body.mission,
        },
      },
      null,
      null,
      (config) => {
        if (config.status === "failure") {
          res.send(config);
        } else {
          try {
            // Fill out layer and placement before addLayer
            let existingLayer = null;
            let placementPath = req.body.placement?.path;
            let placementIndex = req.body.placement?.index;

            Utils.traverseLayers(config.layers, (layer, path, index) => {
              if (layer.uuid === req.body.layerUUID) {
                existingLayer = JSON.parse(JSON.stringify(layer));
                if (placementPath == null) placementPath = path;
                if (placementIndex == null) placementIndex = index;
                return "remove";
              }
            });

            if (existingLayer == null) {
              res.send({
                status: "failure",
                message: `Layer ${req.body.layerUUID} not found. Cannot update.`,
              });
              return;
            }

            // Merge existing and new
            let newLayer = deepmerge(
              existingLayer,
              JSON.parse(JSON.stringify(req.body.layer))
            );
            let body = {
              mission: req.body.mission,
              layer: newLayer,
              placement: req.body.placement || {
                path: placementPath,
                index: placementIndex,
              },
              forceClientUpdate: req.body.forceClientUpdate,
            };

            addLayer(
              {
                body: body,
              },
              res,
              next,
              (resp) => {
                if (resp.status === "success") {
                  res.send({
                    status: "success",
                    message: `Updated layer '${req.body.layerUUID}' in the ${resp.mission} mission. Configuration versioned ${resp.version}.`,
                  });
                } else {
                  resp.message = `Update layer failed with: ${resp.message}`;
                  res.send(resp);
                }
              },
              config,
              "updateLayer"
            );
            // Remove Existing
          } catch (err) {
            logger(
              "error",
              `Failed to update layer: ${req.body.layerUUID}.`,
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: `Failed to update layer: ${req.body.layerUUID}. Uncaught reason.`,
            });
          }
        }
      }
    );
  });

function removeLayer(req, res, next, cb) {
  const exampleBody = {
    mission: "{mission_name}",
    layerUUID: "{existing_layer_uuid}",
    "forceClientUpdate?": "{true}; default false",
  };

  if (req.body.mission == null) {
    res.send({
      status: "failure",
      message: `Required parameter 'mission' is unset.`,
      example: exampleBody,
    });
    return;
  }
  if (req.body.layerUUID == null) {
    res.send({
      status: "failure",
      message: `Required parameter 'layerUUID' is unset.`,
      example: exampleBody,
    });
    return;
  }

  get(
    {
      query: {
        mission: req.body.mission,
      },
    },
    null,
    null,
    (config) => {
      if (config.status === "failure") {
        res.send(config);
      } else {
        try {
          let layerUUIDs = [];

          // Input can be object or array
          if (!Array.isArray(req.body.layerUUID)) {
            layerUUIDs.push(req.body.layerUUID);
          } else {
            layerUUIDs = [...req.body.layerUUID];
          }

          let didRemove = false;
          const removedUUIDs = Utils.traverseLayers(
            config.layers,
            (layer, path, index) => {
              if (layerUUIDs.includes(layer.uuid)) {
                didRemove = true;
                return "remove";
              }
            }
          );

          const unableToRemoveUUIDs = layerUUIDs.filter(
            (i) => !removedUUIDs.map((x) => x.uuid).includes(i)
          );
          if (didRemove) {
            upsert(
              {
                body: {
                  mission: req.body.mission,
                  config: config,
                  forceClientUpdate: req.body.forceClientUpdate,
                },
              },
              res,
              next,
              (resp) => {
                if (resp.status === "success") {
                  res.send({
                    status: "success",
                    message: `Successfully removed layer${
                      removedUUIDs.length >= 1 ? "s" : ""
                    }. Configuration versioned ${resp.version}.`,
                    removedUUIDs: removedUUIDs,
                    unableToRemoveUUIDs: unableToRemoveUUIDs,
                  });
                } else {
                  res.send({
                    status: "failure",
                    message: `Failed to remove layer${
                      layerUUIDs.length >= 1 ? "s" : ""
                    }: ${resp.message}.`,
                    unableToRemoveUUIDs: layerUUIDs,
                  });
                }
              },
              {
                type: "removeLayer",
                layerName: layerUUIDs.filter((i) =>
                  removedUUIDs.map((x) => x.uuid).includes(i)
                ),
              }
            );
          } else {
            res.send({
              status: "failure",
              message: `Failed to remove layer${
                layerUUIDs.length >= 1 ? "s" : ""
              }. Layer${layerUUIDs.length >= 1 ? "s" : ""} not found.`,
              unableToRemoveUUIDs: layerUUIDs,
            });
          }
        } catch (err) {}
      }
    }
  );
}
if (fullAccess)
  /** 
 * /removeLayer
 * body: {
    "mission": "",
    "layerUUID": ""
    "forceClientUpdate?": true
  }
 */
  router.post("/removeLayer", checkMissionPermission, function (req, res, next) {
    removeLayer(req, res, next);
  });

if (fullAccess)
  /** 
 * /updateInitialView
 * body: {
    mission: "{mission_name}",
    "latitude?": 0,
    "longitude?": 0,
    "zoom?": 0
  }
 */
  router.post("/updateInitialView", checkMissionPermission, function (req, res, next) {
    const exampleBody = {
      mission: "{mission_name}",
      "latitude?": 0,
      "longitude?": 0,
      "zoom?": 5,
    };

    if (req.body.mission == null) {
      res.send({
        status: "failure",
        message: `Required parameter 'mission' is unset.`,
        example: exampleBody,
      });
      return;
    }

    get(
      {
        query: {
          mission: req.body.mission,
        },
      },
      null,
      null,
      (config) => {
        if (config.status === "failure") {
          res.send(config);
        } else {
          try {
            let lat =
              req.body.latitude != null && !isNaN(req.body.latitude)
                ? `${req.body.latitude}`
                : config.msv.view[0];
            let lng =
              req.body.longitude != null && !isNaN(req.body.longitude)
                ? `${req.body.longitude}`
                : config.msv.view[1];
            let zoom =
              req.body.zoom != null && !isNaN(req.body.zoom)
                ? `${parseInt(req.body.zoom)}`
                : config.msv.view[2];

            const existingView = config.msv.view;
            const newView = [lat, lng, zoom];

            if (JSON.stringify(newView) !== JSON.stringify(existingView)) {
              config.msv.view = [lat, lng, zoom];

              upsert(
                {
                  body: {
                    mission: req.body.mission,
                    config: config,
                  },
                },
                res,
                next,
                (resp) => {
                  if (resp.status === "success") {
                    res.send({
                      status: "success",
                      message: `Successfully updated initial view of the '${req.body.mission}' mission.`,
                    });
                  } else {
                    res.send({
                      status: "failure",
                      message: `Failed to update the initial view of the '${req.body.mission}' mission: ${resp.message}`,
                    });
                  }
                }
              );
            } else {
              res.send({
                status: "success",
                message: `The initial view of the '${req.body.mission}' mission needs no changes.`,
              });
            }
          } catch (err) {
            res.send({
              status: "failure",
              message: `Failed to update the initial view of the '${req.body.mission}' mission. Uncaught reason.`,
            });
          }
        }
      }
    );
  });

if (fullAccess) {
  router.post("/updateGeneralOptions", function (req, res, next) {
    let optionsJSON;
    if (typeof req.body.options === "string") {
      try {
        optionsJSON = JSON.parse(req.body.options);
      } catch (err) {
        res.send({
          status: "failure",
          message: "Stringified general options object is not JSON.",
        });
      }
    } else optionsJSON = req.body.options;

    GeneralOptions.upsert({
      id: 1,
      options: optionsJSON,
    })
      .then((upserted) => {
        logger(
          "info",
          "Successfully updated the general options.",
          req.originalUrl,
          req
        );
        res.send({
          status: "success",
        });
      })
      .catch((err) => {
        res.send({
          status: "failure",
          message: `Failed to update the general options.`,
        });
      });
  });
}

function getGeneralOptions(req, res, next, cb) {
  GeneralOptions.findOne({
    where: {
      id: 1,
    },
  })
    .then((resp) => {
      if (cb)
        cb({
          status: "success",
          options: resp.options,
        });
      else
        res.send({
          status: "success",
          options: resp.options,
        });
      return null;
    })
    .catch((err) => {
      if (cb)
        cb({
          status: "success",
          options: {},
        });
      else
        res.send({
          status: "success",
          options: {},
        });
      return null;
    });
  return null;
}
router.get("/getGeneralOptions", function (req, res, next) {
  getGeneralOptions(req, res, next);
});

module.exports = router;
