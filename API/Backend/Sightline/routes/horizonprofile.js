const express = require("express");
const router = express.Router();
const { execFile } = require("child_process");
const path = require("path");

const logger = require("../../../logger");
const validateMissionsPath = require("../../../validateMissionsPath");

const scriptsDir = path.join(__dirname, "..", "scripts");

router.post("/horizonprofile", function (req, res, next) {
  (router._computeLimiter || function (r, s, n) { n(); })(req, res, next);
}, function (req, res) {
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
  const maxRadius = Math.min(Number(req.body.maxRadius || 5000), 500000);
  const minSkipRadius = Number(req.body.minSkipRadius || 0);
  const planetRadius = Number(req.body.planetRadius || 0);

  if ([lat, lng, observerHeight, numAzimuths, maxRadius, minSkipRadius, planetRadius].some(v => !isFinite(v))) {
    return res.status(400).json({ error: true, message: "All numeric parameters must be finite numbers" });
  }

  execFile(
    "python",
    [
      path.join(scriptsDir, "HorizonProfile.py"),
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
        logger("error", "horizonprofile failure:", "server", null, error);
        res.status(400).send();
      } else {
        res.send(stdout);
      }
    }
  );
});

module.exports = router;
