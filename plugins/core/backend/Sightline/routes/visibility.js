const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const zlib = require("zlib");

const logger = require("../../../../../API/logger");
const { computeLimiter } = require("../../../../../scripts/rateLimiters");
const validateMissionsPath = require("../../../../../API/validateMissionsPath");

const rootDir = `${__dirname}/../../../../..`;
const scriptsDir = path.join(__dirname, "..", "scripts");

// Dedicated single-ray, native-resolution visibility timeline.
// For each timestep it casts one ray from the observer toward the source's
// azimuth at the DEM's native resolution and reports whether the source is
// above the local horizon. Independent of the sightmap's viewport-dependent
// grid, and supports a denser temporal sampling than the sweep itself.
router.post("/visibility", computeLimiter, function (req, res) {
  if (
    req.body.dem == null ||
    req.body.lat == null ||
    req.body.lng == null ||
    req.body.target == null ||
    req.body.startTime == null ||
    req.body.endTime == null ||
    req.body.stepSeconds == null
  ) {
    return res.status(400).json({
      error: true,
      message: "dem, lat, lng, target, startTime, endTime, and stepSeconds are required",
    });
  }

  const stepSec = Number(req.body.stepSeconds);
  if (!isFinite(stepSec) || stepSec <= 0) {
    return res.status(400).json({ error: true, message: "stepSeconds must be a positive number" });
  }
  const startMs = new Date(String(req.body.startTime)).getTime();
  const endMs = new Date(String(req.body.endTime)).getTime();
  if (isNaN(startMs) || isNaN(endMs) || startMs > endMs) {
    return res.status(400).json({ error: true, message: "Invalid startTime/endTime range" });
  }
  const frameCount = Math.floor((endMs - startMs) / (stepSec * 1000)) + 1;
  const MAX_SAMPLES = 32768;
  if (frameCount > MAX_SAMPLES) {
    return res.status(400).json({
      error: true,
      message: "Computed " + frameCount + " samples exceeds maximum of " + MAX_SAMPLES,
    });
  }

  const SAFE_NAME_RE = /^[A-Za-z0-9_-]+$/;
  const target = String(req.body.target);
  const obsRefFrame = String(req.body.obsRefFrame || "IAU_MOON");
  const obsBody = String(req.body.obsBody || "MOON");
  if (!SAFE_NAME_RE.test(target) || !SAFE_NAME_RE.test(obsRefFrame) || !SAFE_NAME_RE.test(obsBody)) {
    return res.status(400).json({
      error: true,
      message: "target, obsRefFrame, and obsBody must contain only alphanumeric, underscore, or hyphen characters",
    });
  }

  const pathResult = validateMissionsPath(req.body.dem);
  if (pathResult.error) {
    return res.status(400).json({ error: true, message: pathResult.error });
  }

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const height = Number(req.body.height || 0);
  const planetRadius = Number(req.body.planetRadius || 0);
  const maxRadius = Math.min(Number(req.body.maxRadius || 500000), 500000);
  const minSkipRadius = Number(req.body.minSkipRadius || 0);

  if ([lat, lng, height, planetRadius, maxRadius, minSkipRadius].some((v) => !isFinite(v))) {
    return res.status(400).json({ error: true, message: "All numeric parameters must be finite numbers" });
  }

  const payloadObj = {
    dem: pathResult.resolved,
    lat: lat,
    lng: lng,
    height: height,
    target: target,
    obsRefFrame: obsRefFrame,
    obsBody: obsBody,
    planetRadius: planetRadius,
    maxRadius: maxRadius,
    minSkipRadius: minSkipRadius,
    isCustom: String(req.body.isCustom || "false"),
    customAz: Number(req.body.customAz || 0),
    customEl: Number(req.body.customEl || 0),
    startTime: String(req.body.startTime),
    endTime: String(req.body.endTime),
    stepSeconds: stepSec,
  };
  const payload = JSON.stringify(payloadObj);

  const timeoutMs = Math.max(120000, Math.min(frameCount * 200, 300000));

  const child = spawn("python", [path.join(scriptsDir, "visibility.py")], {
    cwd: rootDir,
    timeout: timeoutMs,
  });

  // If the client aborts the request (e.g. a sweep is cancelled), kill the
  // Python process so it does not keep computing to completion (or up to the
  // spawn timeout) with its output discarded.
  res.on("close", () => {
    if (!child.killed) {
      try {
        child.kill();
      } catch (_) {}
    }
  });

  let stderr = "";
  child.stderr.on("data", (data) => {
    if (stderr.length < 1024 * 1024) stderr += data;
  });
  child.on("error", (err) => {
    logger("error", "visibility spawn failure:", "server", null, err);
    if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to start Python process" });
  });
  child.stdin.on("error", (err) => {
    logger("error", "visibility stdin error:", "server", null, err);
  });
  child.stdin.write(payload);
  child.stdin.end();

  const MAX_STDOUT = 64 * 1024 * 1024;
  let stdout = "";
  let overflow = false;
  child.stdout.on("data", (data) => {
    if (overflow) return;
    if (stdout.length + data.length > MAX_STDOUT) {
      overflow = true;
      child.kill();
      logger("error", "visibility output exceeded limit — killed process", "server");
      return;
    }
    stdout += data;
  });
  child.on("close", (code) => {
    if (overflow) {
      if (!res.headersSent) res.status(413).json({ error: true, message: "Visibility output too large" });
      return;
    }
    if (code !== 0) {
      logger("error", "visibility failure:", "server", null, stderr || stdout);
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error && !res.headersSent) return res.status(400).json(parsed);
      } catch (_) {}
      if (!res.headersSent) return res.status(400).json({ error: true, message: "visibility computation failed" });
      return;
    }
    try {
      const parsed = JSON.parse(stdout);
      if (parsed.error) {
        logger("error", "visibility error:", "server", null, parsed.message);
        if (!res.headersSent) return res.status(400).json(parsed);
        return;
      }
      const acceptGzip = (req.headers["accept-encoding"] || "").includes("gzip");
      const body = JSON.stringify(parsed);
      if (acceptGzip) {
        zlib.gzip(Buffer.from(body), (err, compressed) => {
          if (err || res.headersSent) {
            if (!res.headersSent) res.json(parsed);
            return;
          }
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Content-Encoding", "gzip");
          res.send(compressed);
        });
      } else {
        if (!res.headersSent) res.json(parsed);
      }
    } catch (e) {
      logger("error", "visibility parse error:", "server", null, stdout.substring(0, 500));
      if (!res.headersSent) res.status(500).json({ error: true, message: "Failed to parse visibility result" });
    }
  });
});

module.exports = router;
