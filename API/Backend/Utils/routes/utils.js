/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

const rootDir = `${__dirname}/../../../..`;

const dirStore = {};
const DIR_STORE_MAX_AGE = 3600000 / 2; // 1hours / 2

function getDirsInRange(prepath, starttime, endtime) {
  let dirs = dirStore[prepath];

  if (dirs) {
    dirs = dirs.dirs;

    return dirs.filter(function (v) {
      return v.t >= starttime && v.t <= endtime;
    });
  }
  return false;
}

/*
  path must begin with /Missions
  ex.
  /queryTilesetTimes?path=/Missions/MSL/Layers/MyTileset/_time_/{z}/{x}/{y}.png&starttime=2022-08-09T17:26:52Z&&endtime=2022-11-09T17:26:52Z
  returns
  {
    status: "success",
    body: {
      times: [
        {t: timestamp, n: "Z-..."} 
      ]
    }
  }
*/
function queryTilesetTimesDir(req, res) {
  const originalUrl = req.query.path;
  if (!originalUrl.startsWith("/Missions")) {
    res.send({
      status: "failure",
      message: "Only paths beginning with '/Missions' are supported.",
    });
    return;
  }
  if (
    req.query.starttime == null ||
    req.query.endtime == null ||
    req.query.starttime > req.query.endtime
  ) {
    res.send({
      status: "failure",
      message:
        "'starttime' or 'endtime' are null or 'starttime' occurs after 'endtime'.",
    });
    return;
  }

  const relUrl = originalUrl.replace("/Missions", "");
  if (originalUrl.indexOf("_time_") > -1) {
    const urlSplit = originalUrl.split("_time_");
    const relUrlSplit = relUrl.split("_time_");

    if (dirStore[relUrlSplit[0]] == null) {
      dirStore[relUrlSplit[0]] = {
        lastUpdated: 0,
        dirs: [],
      };
    }
    if (Date.now() - dirStore[relUrlSplit[0]].lastUpdated > DIR_STORE_MAX_AGE) {
      fs.readdir(
        path.join(rootDir, urlSplit[0]),
        { withFileTypes: true },
        (error, files) => {
          if (!error) {
            const dirs = files
              .filter((item) => item.isDirectory())
              .map((item) => item.name);

            dirStore[relUrlSplit[0]].lastUpdated = Date.now();
            dirs.sort();
            dirStore[relUrlSplit[0]].dirs = [];
            dirs.forEach((name) => {
              const split = name.split("Z-");
              let t = split.shift();
              const n = split.join("");
              t = t.replace(/_/g, ":");
              if (t[t.length - 1] !== "Z") t += "Z";
              dirStore[relUrlSplit[0]].dirs.push({ t: t, n: n });
            });

            const inRange = getDirsInRange(
              relUrlSplit[0],
              req.query.starttime,
              req.query.endtime
            );
            if (inRange) {
              res.send({
                status: "success",
                body: {
                  times: inRange,
                },
              });
              return;
            } else {
              res.send({
                status: "failure",
                message: "Failed to get times in range.",
              });
              return;
            }
          } else {
            res.send({ status: "failure", message: error });
            return;
          }
        }
      );
    } else {
      const inRange = getDirsInRange(
        relUrlSplit[0],
        req.query.starttime,
        req.query.endtime
      );
      if (inRange) {
        res.send({
          status: "success",
          body: {
            times: inRange,
          },
        });
        return;
      } else {
        res.send({
          status: "failure",
          message: "Failed to get times in range.",
        });
        return;
      }
    }
  } else {
    res.send({
      status: "failure",
      message:
        "The 'path' parameter must contain '_time_' to indicate the location of time directories.",
    });
    return;
  }
}
function queryTilesetTimesStac(req, res) {
  // prettier-ignore
  sequelize
  .query(
    `SELECT
      date_trunc ('month', datetime) AS month,
      COUNT(*) AS total
    FROM pgstac.items
    WHERE collection = ':collection_id' && datetime >= :starttime && end_datetime <= :endtime
    GROUP BY 1
    ORDER BY month`,
    {
      replacements: {
        collection_id: req.query.stacCollection,
        starttime: req.query.starttime,
        endtime: req.query.endtime
      },
    }
  )
  .then(([results]) => {
    res.send({
      status: "success",
      body: {
        times: results,
      },
    });
    return;
  })
  .catch((err) => {
    res.send({
      status: "failure",
      message: "Failed to get times in range.",
    });
    return;
  });
}

router.get("/queryTilesetTimes", function (req, res) {
  if (req.query.stacCollection != null) queryTilesetTimesStac(req, res);
  else queryTilesetTimesDir(req, res);
});

module.exports = router;
