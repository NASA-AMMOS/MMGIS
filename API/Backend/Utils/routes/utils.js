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

/**
 * Validate and decode a path intended to access files under /Missions/.
 * Handles multiple levels of URL encoding, verifies the resolved path
 * stays within the Missions directory (cross-mission ../ is allowed).
 *
 * @param {string} rawPath - The raw path string from the request.
 * @returns {{ error: string }|{ decoded: string, resolved: string }} 
 *   On failure: `{ error }` with a user-facing message.
 *   On success: `{ decoded, resolved }` — the fully decoded path and its absolute resolved form.
 */
function validateMissionsPath(rawPath) {
  let decoded = String(rawPath);
  let prev = '';
  while (decoded !== prev) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      return { error: 'Invalid URL encoding in path.' };
    }
  }
  // Normalise: accept both "Missions/…" and "/Missions/…"
  if (!decoded.startsWith('/')) decoded = '/' + decoded;
  if (!decoded.startsWith('/Missions')) {
    return { error: "Only paths beginning with '/Missions' are supported." };
  }
  const resolved = path.resolve(path.join(rootDir, decoded));
  const allowed = path.resolve(rootDir, 'Missions');
  const normalizedResolved = resolved.replace(/\\/g, '/');
  const normalizedAllowed = allowed.replace(/\\/g, '/');
  if (normalizedResolved !== normalizedAllowed && !normalizedResolved.startsWith(normalizedAllowed + '/')) {
    return { error: 'Invalid path: access denied.' };
  }
  return { decoded, resolved };
}

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
  const pathResult = validateMissionsPath(req.query.path);
  if (pathResult.error) {
    res.send({ status: "failure", message: pathResult.error });
    return;
  }
  const decodedUrl = pathResult.decoded;
  const resolvedPath = pathResult.resolved;
  const allowedBase = path.resolve(rootDir, 'Missions');

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
  // Validate string fields used in filesystem path construction in Python.
  // Only allow alphanumeric, underscore, hyphen (SPICE body/frame names).
  const SAFE_NAME_RE = /^[A-Za-z0-9_-]+$/;
  const target = String(req.body.target);
  const obsRefFrame = String(req.body.obsRefFrame || "IAU_MARS");
  const obsBody = String(req.body.obsBody || "MARS");
  if (!SAFE_NAME_RE.test(target) || !SAFE_NAME_RE.test(obsRefFrame) || !SAFE_NAME_RE.test(obsBody)) {
    return res.status(400).json({ error: true, message: "target, obsRefFrame, and obsBody must contain only alphanumeric, underscore, or hyphen characters" });
  }
  const inputData = {
    lng: req.body.lng,
    lat: req.body.lat,
    height: req.body.height,
    target: target,
    times: req.body.times,
    obsRefFrame: obsRefFrame,
    obsBody: obsBody,
    includeSunEarth: String(req.body.includeSunEarth || "false"),
    isCustom: String(req.body.isCustom || "false"),
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
    if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to start Python process" });
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

  const args = ["private/api/chronice.py", body, target, fromFormat, time];
  if (req.body.lng != null) {
    args.push(encodeURIComponent(String(req.body.lng)));
  }

  execFile(
    "python",
    args,
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

//utils gethorizonprofile
router.post("/gethorizonprofile", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  // Validate required fields
  if (req.body.path == null || req.body.lat == null || req.body.lng == null) {
    return res.status(400).json({ error: true, message: "path, lat, and lng are required" });
  }

  // Path security via shared helper
  const pathResult = validateMissionsPath(req.body.path);
  if (pathResult.error) {
    return res.status(400).json({ error: true, message: pathResult.error });
  }

  // Validate and cap numeric parameters
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const observerHeight = Number(req.body.observerHeight || 0);
  const numAzimuths = Math.min(Number(req.body.numAzimuths || 360), 3600);
  const maxRadius = Math.min(Number(req.body.maxRadius || 5000), 100000);
  const minSkipRadius = Number(req.body.minSkipRadius || 0);
  const planetRadius = Number(req.body.planetRadius || 0);

  if ([lat, lng, observerHeight, numAzimuths, maxRadius, minSkipRadius, planetRadius].some(v => !isFinite(v))) {
    return res.status(400).json({ error: true, message: "All numeric parameters must be finite numbers" });
  }

  execFile(
    "python",
    [
      "private/api/HorizonProfile.py",
      pathResult.resolved,
      String(lat),
      String(lng),
      String(observerHeight),
      String(numAzimuths),
      String(maxRadius),
      String(minSkipRadius),
      String(planetRadius),
    ],
    function (error, stdout, stderr) {
      if (error) {
        logger("error", "gethorizonprofile failure:", "server", null, error);
        res.status(400).send();
      } else {
        res.send(stdout);
      }
    }
  );
});

//utils sightmap — single or batch (pass `times` array for batch)
router.post("/sightmap", function(req,res,next){(router._computeLimiter||function(r,s,n){n()})(req,res,next)}, function (req, res) {
  const MAX_TIMES = 200;
  const isBatch = Array.isArray(req.body.times) && req.body.times.length > 0;
  if (req.body.dem == null || req.body.lat == null || req.body.lng == null || req.body.target == null) {
    return res.status(400).json({ error: true, message: "dem, lat, lng, and target are required" });
  }
  if (!isBatch && req.body.time == null) {
    return res.status(400).json({ error: true, message: "time (or times array) is required" });
  }
  if (isBatch && req.body.times.length > MAX_TIMES) {
    return res.status(400).json({ error: true, message: "times array exceeds maximum of " + MAX_TIMES + " entries" });
  }

  // Validate string fields used in filesystem path construction in Python.
  const SAFE_NAME_RE = /^[A-Za-z0-9_-]+$/;
  const target = String(req.body.target);
  const obsRefFrame = String(req.body.obsRefFrame || 'IAU_MOON');
  const obsBody = String(req.body.obsBody || 'MOON');
  if (!SAFE_NAME_RE.test(target) || !SAFE_NAME_RE.test(obsRefFrame) || !SAFE_NAME_RE.test(obsBody)) {
    return res.status(400).json({ error: true, message: "target, obsRefFrame, and obsBody must contain only alphanumeric, underscore, or hyphen characters" });
  }

  const pathResult = validateMissionsPath(req.body.dem);
  if (pathResult.error) {
    return res.status(400).json({ error: true, message: pathResult.error });
  }

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const height = Number(req.body.height || 0);
  const planetRadius = Number(req.body.planetRadius || 0);
  const maxOutputDim = Math.min(Number(req.body.maxOutputDim || 400), 4096);

  if ([lat, lng, height, planetRadius, maxOutputDim].some(v => !isFinite(v))) {
    return res.status(400).json({ error: true, message: "All numeric parameters must be finite numbers" });
  }

  const minDistance = Number(req.body.minDistance || 0);
  const maxDistance = Number(req.body.maxDistance || 0);

  const payloadObj = {
    dem: pathResult.resolved,
    lat: lat,
    lng: lng,
    height: height,
    target: target,
    obsRefFrame: obsRefFrame,
    obsBody: obsBody,
    planetRadius: planetRadius,
    maxOutputDim: maxOutputDim,
    isCustom: String(req.body.isCustom || 'false'),
    customAz: Number(req.body.customAz || 0),
    customEl: Number(req.body.customEl || 0),
    minDistance: minDistance,
    maxDistance: maxDistance,
  };
  if (isBatch) {
    payloadObj.times = req.body.times.map(String);
  } else {
    payloadObj.time = String(req.body.time);
  }
  if (req.body.viewportBounds) {
    payloadObj.viewportBounds = String(req.body.viewportBounds);
  }
  const payload = JSON.stringify(payloadObj);

  // Batch mode may take much longer (N timestamps × ~10s each)
  const timeoutMs = isBatch ? Math.min(req.body.times.length * 30000, 1800000) : 120000;

  const spawnStart = Date.now();
  const child = spawn("python", ["private/api/sightmap.py"], {
    cwd: rootDir,
    timeout: timeoutMs,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  child.on('error', (err) => {
    logger("error", "sightmap spawn failure:", "server", null, err);
    if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to start Python process" });
  });
  child.stdin.on('error', (err) => {
    logger("error", "sightmap stdin error:", "server", null, err);
  });
  child.stdin.write(payload);
  child.stdin.end();

  child.on('close', (code) => {
    if (code !== 0) {
      logger("error", "sightmap failure:", "server", null, stderr || stdout);
      // Try to parse the JSON error from stdout (Python prints structured errors)
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          if (!res.headersSent) return res.status(400).json(parsed);
          return;
        }
      } catch (_) { /* not valid JSON — fall through */ }
      if (!res.headersSent) return res.status(400).json({ error: true, message: "sightmap computation failed" });
      return;
    }
    try {
      const parseStart = Date.now();
      const parsed = JSON.parse(stdout);
      const parseMs = Date.now() - parseStart;
      const totalMs = Date.now() - spawnStart;
      logger("info", `sightmap completed: total=${totalMs}ms, json_parse=${parseMs}ms, stdout_size=${(stdout.length/1024).toFixed(1)}KB`, "server");
      if (parsed.error) {
        logger("error", "sightmap error:", "server", null, parsed.message);
        if (!res.headersSent) return res.status(400).json(parsed);
        return;
      }
      if (!res.headersSent) res.json(parsed);
    } catch (e) {
      logger("error", "sightmap parse error:", "server", null, stdout.substring(0, 500));
      if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to parse sightmap result" });
    }
  });
});

module.exports = router;
