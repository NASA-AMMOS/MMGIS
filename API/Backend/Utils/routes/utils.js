/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;
const execFile = require("child_process").execFile;
const spawn = require("child_process").spawn;

const Sequelize = require("sequelize");
const { sequelizeSTAC } = require("../../../connection");
const logger = require("../../../logger");

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

  // Security: Decode URL encoding to catch encoded path traversal attempts
  // Handle multiple levels of encoding
  let decodedUrl = originalUrl;
  let previousUrl = '';
  while (decodedUrl !== previousUrl) {
    previousUrl = decodedUrl;
    try {
      decodedUrl = decodeURIComponent(decodedUrl);
    } catch (e) {
      // Invalid URL encoding, reject
      res.send({
        status: "failure",
        message: "Invalid URL encoding in path.",
      });
      return;
    }
  }

  if (!decodedUrl.startsWith("/Missions")) {
    res.send({
      status: "failure",
      message: "Only paths beginning with '/Missions' are supported.",
    });
    return;
  }
  // Security: Block path traversal sequences (after decoding)
  if (decodedUrl.includes('..')) {
    res.send({
      status: "failure",
      message: "Invalid path: traversal sequences not allowed.",
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

  const relUrl = decodedUrl.replace("/Missions", "");

  // Security: Validate resolved path stays within allowed directory
  // This prevents path traversal via URL encoding or other techniques
  const targetPath = path.join(rootDir, decodedUrl);
  const resolvedPath = path.resolve(targetPath);
  const allowedBase = path.resolve(rootDir, 'Missions');

  // Normalize paths for comparison (handle Windows/Unix differences)
  const normalizedResolved = resolvedPath.replace(/\\/g, '/');
  const normalizedBase = allowedBase.replace(/\\/g, '/');

  if (!normalizedResolved.startsWith(normalizedBase)) {
    res.send({
      status: "failure",
      message: "Invalid path: access denied.",
    });
    return;
  }

  if (decodedUrl.indexOf("_time_") > -1) {
    // Find _time_ marker only after the allowedBase prefix, so any
    // _time_ substring inside the installation directory is ignored.
    const timeMarkerIndex = resolvedPath.indexOf("_time_", allowedBase.length);
    const resolvedDir = resolvedPath.substring(0, timeMarkerIndex);
    const relUrlSplit = relUrl.split("_time_");

    if (dirStore[relUrlSplit[0]] == null) {
      dirStore[relUrlSplit[0]] = {
        lastUpdated: 0,
        dirs: [],
      };
    }
    if (Date.now() - dirStore[relUrlSplit[0]].lastUpdated > DIR_STORE_MAX_AGE) {
      fs.readdir(
        resolvedDir,
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
  if (sequelizeSTAC == null) {
    res.send({
      status: "failure",
      message: "No STAC Database",
    });
    return;
  }
  const range = new Date(req.query.endtime) - new Date(req.query.starttime);
  let binBy = "milliseconds";
  let minNumBins = 100;
  // find ideal bin size
  if (range > 31557600000 * minNumBins) {
    binBy = "year";
  } else if (range > 7889400000 * minNumBins) {
    binBy = "quarter";
  } else if (range > 2629746000 * minNumBins) {
    binBy = "month";
  } else if (range > 604800000 * minNumBins) {
    binBy = "week";
  } else if (range > 86400000 * minNumBins) {
    binBy = "day";
  } else if (range > 3600000 * minNumBins) {
    binBy = "hour";
  } else if (range > 60000 * minNumBins) {
    binBy = "minute";
  } else if (range > 1000 * minNumBins) {
    binBy = "second";
  }

  // prettier-ignore
  sequelizeSTAC
  .query(
    `SELECT
      date_trunc (:binBy, datetime) AS t,
      COUNT(*) AS total
    FROM pgstac.items
    WHERE collection = :collection_id AND datetime >= :starttime AND end_datetime <= :endtime
    GROUP BY 1
    ORDER BY t`,
    {
      replacements: {
        collection_id: req.query.stacCollection,
        starttime: req.query.starttime,
        endtime: req.query.endtime,
        binBy: binBy
      },
    }
  )
  .then(([results]) => {
    res.send({
      status: "success",
      body: {
        times: results,
        binBy: binBy
      },
    });
    return;
  })
  .catch((err) => {
    console.log(err)
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

// API
// TODO: move to API/Backend
//TEST
router.get("/healthcheck", function (req, res) {
  res.send("Alive and Well!");
});

// TODO: Remove or move to Setup structure. Some are definitely still used.

//utils getprofile
router.post("/getprofile", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const path = encodeURIComponent(req.body.path);
  const lat1 = encodeURIComponent(req.body.lat1);
  const lon1 = encodeURIComponent(req.body.lon1);
  const lat2 = encodeURIComponent(req.body.lat2);
  const lon2 = encodeURIComponent(req.body.lon2);
  const steps = encodeURIComponent(req.body.steps);
  const axes = encodeURIComponent(req.body.axes);

  execFile(
    "python",
    [
      "private/api/2ptsToProfile.py",
      path,
      lat1,
      lon1,
      lat2,
      lon2,
      steps,
      axes,
      1,
    ],
    function (error, stdout, stderr) {
      if (error) {
        logger("warn", error);
        res.status(400).send();
      } else {
        res.send(stdout.replace(/None/g, null));
      }
    }
  );
});

//utils getbands
router.post("/getbands", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const path = encodeURIComponent(req.body.path);
  const x = encodeURIComponent(req.body.x);
  const y = encodeURIComponent(req.body.y);
  const xyorll = encodeURIComponent(req.body.xyorll);
  const bands = encodeURIComponent(req.body.bands);

  execFile(
    "python",
    ["private/api/BandsToProfile.py", path, x, y, xyorll, bands],
    function (error, stdout, stderr) {
      if (error) {
        logger("warn", error);
        res.status(400).send();
      } else {
        res.send(stdout);
      }
    }
  );
});

//utils getminmax
router.post("/getminmax", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const path = encodeURIComponent(req.body.path);
  const bands = encodeURIComponent(req.body.bands);

  execFile(
    "python",
    ["private/api/gdalinfoMinMax.py", path, bands],
    function (error, stdout, stderr) {
      if (error) {
        logger("warn", error);
        res.status(400).send();
      } else {
        res.send(stdout);
      }
    }
  );
});

//utils ll2aerll
router.post("/ll2aerll", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const lng = encodeURIComponent(req.body.lng);
  const lat = encodeURIComponent(req.body.lat);
  const height = encodeURIComponent(req.body.height);
  const target = encodeURIComponent(req.body.target);
  const time = encodeURIComponent(req.body.time)
    .replace(/%20/g, " ")
    .replace(/%3A/g, ":");
  const obsRefFrame = encodeURIComponent(req.body.obsRefFrame) || "IAU_MARS";
  const obsBody = encodeURIComponent(req.body.obsBody) || "MARS";
  const includeSunEarth =
    encodeURIComponent(req.body.includeSunEarth) || "False";

  const isCustom = encodeURIComponent(req.body.isCustom) || "False";
  const customAz = encodeURIComponent(req.body.customAz);
  const customEl = encodeURIComponent(req.body.customEl);
  const customRange = encodeURIComponent(req.body.customRange);

  execFile(
    "python",
    [
      "private/api/ll2aerll.py",
      lng,
      lat,
      height,
      target,
      time,
      obsRefFrame,
      obsBody,
      includeSunEarth,
      isCustom,
      customAz,
      customEl,
      customRange,
    ],
    function (error, stdout, stderr) {
      if (error) logger("error", "ll2aerll failure:", "server", null, error);
      res.send(stdout);
    }
  );
});


//utils ll2aerll_bulk (batch time queries, kernels loaded once)
router.post("/ll2aerll_bulk", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const MAX_TIMES = 1000;
  if (!Array.isArray(req.body.times) || req.body.times.length === 0) {
    return res.status(400).json({ error: true, message: "times must be a non-empty array" });
  }
  if (req.body.times.length > MAX_TIMES) {
    return res.status(400).json({ error: true, message: "times array exceeds maximum of " + MAX_TIMES + " entries" });
  }
  if (req.body.lng == null || req.body.lat == null || req.body.height == null || !req.body.target) {
    return res.status(400).json({ error: true, message: "lng, lat, height, and target are required" });
  }
  // Sanitize string fields that are used in filesystem path construction in Python
  const safeStr = (v) => typeof v === 'string' ? encodeURIComponent(v) : String(v);
  const inputData = {
    lng: req.body.lng,
    lat: req.body.lat,
    height: req.body.height,
    target: safeStr(req.body.target),
    times: req.body.times,
    obsRefFrame: safeStr(req.body.obsRefFrame || "IAU_MARS"),
    obsBody: safeStr(req.body.obsBody || "MARS"),
    includeSunEarth: req.body.includeSunEarth || "false",
    isCustom: req.body.isCustom || "false",
    customAz: req.body.customAz || 0,
    customEl: req.body.customEl || 0,
    customRange: req.body.customRange || 0,
  };

  const child = spawn("python", ["private/api/ll2aerll.py", "--bulk"]);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => { stdout += data.toString(); });
  child.stderr.on("data", (data) => { stderr += data.toString(); });
  child.on("error", (err) => {
    logger("error", "ll2aerll_bulk spawn failure:", "server", null, err);
    if (!res.headersSent) res.status(500).send(JSON.stringify({ error: true, message: "Failed to start Python process" }));
  });
  child.on("close", (code) => {
    if (code !== 0) {
      logger("error", "ll2aerll_bulk failure:", "server", null, stderr || stdout);
      if (!res.headersSent) res.status(500).json({ error: true, message: "Python process exited with code " + code });
      return;
    }
    if (!res.headersSent) res.send(stdout);
  });
  child.stdin.on("error", (err) => {
    logger("error", "ll2aerll_bulk stdin error:", "server", null, err);
  });
  child.stdin.write(JSON.stringify(inputData));
  child.stdin.end();
});

//utils chronos (spice time converter)
router.post("/chronice", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const body = encodeURIComponent(req.body.body);
  const target = encodeURIComponent(req.body.target);
  const fromFormat = encodeURIComponent(req.body.from);
  const time = encodeURIComponent(req.body.time)
    .replace(/%20/g, " ")
    .replace(/%3A/g, ":");

  execFile(
    "python",
    ["private/api/chronice.py", body, target, fromFormat, time],
    function (error, stdout, stderr) {
      if (error) logger("error", "chronice failure:", "server", null, error);
      res.send(stdout);
    }
  );
});

//utils chronos (spice time converter)
router.get("/proj42wkt", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const proj4 = encodeURIComponent(req.query.proj4);

  execFile(
    "python",
    ["private/api/proj42wkt.py", proj4],
    function (error, stdout, stderr) {
      if (error) logger("error", "proj42wkt failure:", "server", null, error);
      res.send(stdout);
    }
  );
});

module.exports = router;
