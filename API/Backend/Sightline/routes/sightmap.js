const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

const logger = require("../../../logger");
const validateMissionsPath = require("../../../validateMissionsPath");

const rootDir = `${__dirname}/../../../..`;
const scriptsDir = path.join(__dirname, "..", "scripts");

router.post("/sightmap", function (req, res, next) {
  (router._computeLimiter || function (r, s, n) { n(); })(req, res, next);
}, function (req, res) {
  const isBatch = req.body.startTime != null && req.body.endTime != null && req.body.stepSeconds != null;
  if (req.body.dem == null || req.body.lat == null || req.body.lng == null || req.body.target == null) {
    return res.status(400).json({ error: true, message: "dem, lat, lng, and target are required" });
  }
  if (!isBatch && req.body.time == null) {
    return res.status(400).json({ error: true, message: "time (or startTime/endTime/stepSeconds) is required" });
  }
  // Frame limit scales inversely with resolution: fewer cells/frame → more frames allowed
  const maxDim = Number(req.body.maxOutputDim || 400);
  const MAX_TIMES = maxDim >= 800 ? 256 : maxDim >= 400 ? 512 : maxDim >= 200 ? 1024 : 2048;
  if (isBatch) {
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
    if (frameCount > MAX_TIMES) {
      return res.status(400).json({ error: true, message: "Computed " + frameCount + " frames exceeds maximum of " + MAX_TIMES + " at this resolution" });
    }
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

  const shadowReach = Math.max(0, Number(req.body.shadowReach || 0));
  if (!isFinite(shadowReach)) {
    return res.status(400).json({ error: true, message: "shadowReach must be a finite number" });
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
    maxOutputDim: maxOutputDim,
    isCustom: String(req.body.isCustom || 'false'),
    customAz: Number(req.body.customAz || 0),
    customEl: Number(req.body.customEl || 0),
    shadowReach: shadowReach,
  };
  if (isBatch) {
    payloadObj.startTime = String(req.body.startTime);
    payloadObj.endTime = String(req.body.endTime);
    payloadObj.stepSeconds = Number(req.body.stepSeconds);
  } else {
    payloadObj.time = String(req.body.time);
  }
  if (req.body.viewportBounds) {
    payloadObj.viewportBounds = String(req.body.viewportBounds);
  }
  const payload = JSON.stringify(payloadObj);

  // Batch mode may take much longer (N timestamps × ~10s each)
  let timeoutMs = 120000;
  if (isBatch) {
    const stepSec = Number(req.body.stepSeconds);
    const startMs = new Date(String(req.body.startTime)).getTime();
    const endMs = new Date(String(req.body.endTime)).getTime();
    const frameCount = Math.floor((endMs - startMs) / (stepSec * 1000)) + 1;
    timeoutMs = Math.min(frameCount * 30000, 1800000);
  }

  const child = spawn("python", [path.join(scriptsDir, "sightmap.py")], {
    cwd: rootDir,
    timeout: timeoutMs,
  });

  const MAX_STDOUT = 256 * 1024 * 1024; // 256 MB safety cap
  let stdout = '';
  let stderr = '';
  let stdoutOverflow = false;
  child.stdout.on('data', (data) => {
    if (stdoutOverflow) return;
    if (stdout.length + data.length > MAX_STDOUT) {
      stdoutOverflow = true;
      child.kill();
      logger("error", "sightmap output exceeded 256 MB limit — killed process", "server");
      return;
    }
    try { stdout += data; } catch (_) {
      stdoutOverflow = true;
      child.kill();
      logger("error", "sightmap output string allocation failed — killed process", "server");
    }
  });
  child.stderr.on('data', (data) => {
    if (stderr.length < 1024 * 1024) stderr += data;
  });
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
    if (stdoutOverflow) {
      if (!res.headersSent) res.status(413).json({ error: true, message: "Sightmap output too large — reduce resolution or area" });
      return;
    }
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
      const parsed = JSON.parse(stdout);
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
