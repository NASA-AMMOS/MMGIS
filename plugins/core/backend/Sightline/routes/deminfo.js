const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

const logger = require("../../../../../API/logger");
const { computeLimiter } = require("../../../../../scripts/rateLimiters");
const validateMissionsPath = require("../../../../../API/validateMissionsPath");

const rootDir = `${__dirname}/../../../../..`;
const scriptsDir = path.join(__dirname, "..", "scripts");

// Reports a DEM's native (dataset) resolution in meters-per-pixel, read from
// its GeoTransform, along with the raster dimensions.  Used by the Sightline
// Tool to populate the resolution selector with real dataset resolutions.
router.post("/deminfo", computeLimiter, function (req, res) {
  if (req.body.dem == null) {
    return res.status(400).json({ error: true, message: "dem is required" });
  }

  const pathResult = validateMissionsPath(req.body.dem);
  if (pathResult.error) {
    return res.status(400).json({ error: true, message: pathResult.error });
  }

  const payload = JSON.stringify({ dem: pathResult.resolved });

  const child = spawn("python", [path.join(scriptsDir, "deminfo.py")], {
    cwd: rootDir,
    timeout: 30000,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { if (stdout.length < 64 * 1024) stdout += d; });
  child.stderr.on("data", (d) => { if (stderr.length < 64 * 1024) stderr += d; });
  child.on("error", (err) => {
    logger("error", "deminfo spawn failure:", "server", null, err);
    if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to start Python process" });
  });
  child.stdin.on("error", (err) => {
    logger("error", "deminfo stdin error:", "server", null, err);
  });
  child.stdin.write(payload);
  child.stdin.end();

  child.on("close", (code) => {
    if (res.headersSent) return;
    if (code !== 0) {
      logger("error", "deminfo failure:", "server", null, stderr || stdout);
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) return res.status(400).json(parsed);
      } catch (_) { /* fallthrough */ }
      return res.status(400).json({ error: true, message: "deminfo computation failed" });
    }
    try {
      const parsed = JSON.parse(stdout);
      if (parsed.error) return res.status(400).json(parsed);
      return res.json(parsed);
    } catch (e) {
      logger("error", "deminfo parse error:", "server", null, stdout.substring(0, 500));
      return res.status(500).json({ error: true, message: "Failed to parse deminfo result" });
    }
  });
});

module.exports = router;
