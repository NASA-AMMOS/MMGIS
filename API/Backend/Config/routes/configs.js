/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const execFile = require("child_process").execFile;

const logger = require("../../../logger");
const Config = require("../models/config");
const config_template = require("../../../templates/config_template");

const fs = require("fs");

let fullAccess = false;
if (
  !process.env.hasOwnProperty("HIDE_CONFIG") ||
  process.env.HIDE_CONFIG != "true"
)
  fullAccess = true;

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
        if (cb) cb({ status: "failure", message: "Mission not found." });
        else res.send({ status: "failure", message: "Mission not found." });
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
            } else res.send(mission.config);
            return null;
          })
          .catch((err) => {
            if (cb) cb({ status: "failure", message: "Mission not found." });
            else res.send({ status: "failure", message: "Mission not found." });
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

  if (
    req.body.mission !==
      req.body.mission.replace(
        /[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi,
        ""
      ) &&
    req.body.mission.length === 0 &&
    !isNaN(req.body.mission[0])
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
    add(req, res, next);
  });

function upsert(req, res, next, cb) {
  let hasVersion = false;
  if (req.body.version != null) hasVersion = true;
  let versionConfig = null;

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
      Config.create({
        mission: req.body.mission,
        config: versionConfig || JSON.parse(req.body.config),
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
      logger("error", "Failed to update mission.", req.originalUrl, req, err);
      if (cb) cb({ status: "failure", message: "Failed to update mission." });
      else res.send({ status: "failure", message: "Failed to find mission." });
      return null;
    });
  return null;
}

if (fullAccess)
  router.post("/upsert", function (req, res, next) {
    upsert(req, res, next);
  });

router.post("/missions", function (req, res, next) {
  Config.aggregate("mission", "DISTINCT", { plain: false })
    .then((missions) => {
      let allMissions = [];
      for (let i = 0; i < missions.length; i++)
        allMissions.push(missions[i].DISTINCT);
      allMissions.sort();
      res.send({ status: "success", missions: allMissions });
      return null;
    })
    .catch((err) => {
      logger("error", "Failed to find missions.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to find missions." });
      return null;
    });
  return null;
});

if (fullAccess)
  router.post("/versions", function (req, res, next) {
    Config.findAll({
      where: {
        mission: req.body.mission,
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

module.exports = router;
