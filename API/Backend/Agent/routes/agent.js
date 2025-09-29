const express = require("express");
const { planWithProvider } = require("../provider");

const router = express.Router();

// --- Schemas (lightweight validation) ---
const TOOL_NAMES = new Set([
  "list_layers",
  "toggle_layer",
  "set_layer_opacity",
  "zoom_to",
]);

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function validateAction(a) {
  if (!a || typeof a !== "object")
    return { ok: false, err: "Action must be an object" };
  if (!TOOL_NAMES.has(a.tool))
    return { ok: false, err: `Unknown tool '${a.tool}'` };
  const args = a.args || {};
  switch (a.tool) {
    case "list_layers":
      if (args && Object.keys(args).length > 0)
        return { ok: false, err: "list_layers expects empty args" };
      return { ok: true, action: { tool: "list_layers", args: {} } };
    case "toggle_layer": {
      if (typeof args.name !== "string" || args.name.length === 0)
        return { ok: false, err: "toggle_layer.name required" };
      if (typeof args.visible !== "boolean")
        return { ok: false, err: "toggle_layer.visible must be boolean" };
      return {
        ok: true,
        action: {
          tool: "toggle_layer",
          args: { name: args.name, visible: !!args.visible },
        },
      };
    }
    case "set_layer_opacity": {
      if (typeof args.name !== "string" || args.name.length === 0)
        return { ok: false, err: "set_layer_opacity.name required" };
      if (typeof args.opacity !== "number" || !isFinite(args.opacity))
        return {
          ok: false,
          err: "set_layer_opacity.opacity must be number in [0,1]",
        };
      const opacity = args.opacity;
      if (opacity < 0 || opacity > 1)
        return {
          ok: false,
          err: "set_layer_opacity.opacity must be number in [0,1]",
        };
      return {
        ok: true,
        action: {
          tool: "set_layer_opacity",
          args: { name: args.name, opacity },
        },
      };
    }
    case "zoom_to": {
      if (
        Array.isArray(args.center) &&
        args.center.length === 2 &&
        typeof args.zoom === "number"
      ) {
        const [lon, lat] = args.center;
        if (!isFinite(lon) || !isFinite(lat))
          return { ok: false, err: "zoom_to.center must be [lon,lat]" };
        const z = Math.round(args.zoom);
        if (lon < -180 || lon > 180)
          return {
            ok: false,
            err: "zoom_to.center lon out of range [-180,180]",
          };
        if (lat < -90 || lat > 90)
          return { ok: false, err: "zoom_to.center lat out of range [-90,90]" };
        if (z < 0 || z > 22)
          return { ok: false, err: "zoom_to.zoom out of range [0,22]" };
        return {
          ok: true,
          action: { tool: "zoom_to", args: { center: [lon, lat], zoom: z } },
        };
      }
      if (Array.isArray(args.bbox)) {
        const b = args.bbox;
        if (b.length !== 4 || b.some((v) => !isFinite(v)))
          return {
            ok: false,
            err: "zoom_to.bbox must be [minLon,minLat,maxLon,maxLat]",
          };
        if (b[0] < -180 || b[0] > 180 || b[2] < -180 || b[2] > 180)
          return { ok: false, err: "zoom_to.bbox lon out of range [-180,180]" };
        if (b[1] < -90 || b[1] > 90 || b[3] < -90 || b[3] > 90)
          return { ok: false, err: "zoom_to.bbox lat out of range [-90,90]" };
        return {
          ok: true,
          action: { tool: "zoom_to", args: { bbox: [b[0], b[1], b[2], b[3]] } },
        };
      }
      return {
        ok: false,
        err: "zoom_to requires {center:[lon,lat],zoom} or {bbox:[...]}",
      };
    }
  }
}

// --- Simple rule-based fallback ---
function fallbackPlan(message) {
  const m = (message || "").toLowerCase();
  const actions = [];
  if (m.includes("list")) actions.push({ tool: "list_layers", args: {} });
  const nameMatch = (() => {
    const mm =
      /(?:toggle|turn\s+on|turn\s+off|show|hide)\s+([\w:\-\/ ]+)/i.exec(
        message,
      );
    if (mm && mm[1]) return mm[1].trim();
    if (/sample[_\s-]?points/i.test(message)) return "Sample_Points";
    if (/osm[_\s-]?basemap/i.test(message)) return "OSM_Basemap";
    return null;
  })();
  if (nameMatch) {
    const wantOn = /(turn\s+on|show)/.test(m)
      ? true
      : /(turn\s+off|hide)/.test(m)
        ? false
        : true;
    if (/(turn\s+on|turn\s+off|toggle|show|hide)/.test(m)) {
      actions.push({
        tool: "toggle_layer",
        args: { name: nameMatch, visible: wantOn },
      });
    }
  }
  const opMatch = m.match(/opacity\s*(to)?\s*([0-1]?(?:\.\d+)?)/);
  if (opMatch && nameMatch) {
    const v = clamp01(parseFloat(opMatch[2]));
    actions.push({
      tool: "set_layer_opacity",
      args: { name: nameMatch, opacity: v },
    });
  }
  const zoomMatch = m.match(
    /zoom\s*to\s*([\-\d\.]+)\s*,\s*([\-\d\.]+).*?(?:zoom\s*(\d+))?/,
  );
  if (zoomMatch) {
    const lon = parseFloat(zoomMatch[1]);
    const lat = parseFloat(zoomMatch[2]);
    const zoom = zoomMatch[3] != null ? parseInt(zoomMatch[3], 10) : 6;
    if (isFinite(lon) && isFinite(lat))
      actions.push({ tool: "zoom_to", args: { center: [lon, lat], zoom } });
  }
  if (actions.length === 0) actions.push({ tool: "list_layers", args: {} });
  return actions;
}

// Server no longer claims Performed; client owns success phrasing

router.post("/", express.json(), async function (req, res) {
  const message = (req.body && req.body.message) || "";

  if (typeof message !== "string" || message.length > 2000) {
    return res.status(200).json({
      text: "Message too long (max 2000 chars).",
      actions: [],
      source: "fallback",
      debug: {
        providerAttempted: false,
        providerReturnedActions: false,
        providerFailureReason: "MessageTooLong",
      },
    });
  }

  // Try provider, then fallback
  let proposed = [];
  let source = "provider";
  const debug = {
    providerAttempted: false,
    providerReturnedActions: false,
    providerFailureReason: null,
  };
  try {
    debug.providerAttempted = true;
    const r = await planWithProvider(message);
    if (Array.isArray(r)) {
      // backward compat
      proposed = r;
    } else {
      proposed = r.actions || [];
      if (r.debug) debug.azure = r.debug;
    }
    debug.providerReturnedActions =
      Array.isArray(proposed) && proposed.length > 0;
  } catch (e) {
    proposed = [];
    debug.providerFailureReason = (e && e.message) || "Error";
  }
  if (!Array.isArray(proposed) || proposed.length === 0) {
    source = "fallback";
    proposed = fallbackPlan(message);
  }

  // Validate each action strictly
  const actions = [];
  const errors = [];
  let sawUnknownTool = false;
  for (const a of proposed) {
    const v = validateAction(a);
    if (v.ok) actions.push(v.action);
    else {
      errors.push(v.err);
      if (/Unknown tool/.test(v.err)) sawUnknownTool = true;
    }
  }

  let text =
    `Planned: ${actions.map((a) => a.tool).join(", ") || "(none)"}.` +
    (errors.length ? ` Dropped: ${errors.join("; ")}` : "");
  if (sawUnknownTool) {
    text +=
      " Note: Only list_layers, toggle_layer, set_layer_opacity, zoom_to are available right now.";
  }

  res.status(200).json({
    text: source === "fallback" ? text + " (fallback)" : text,
    actions,
    source,
    debug,
  });
});

module.exports = router;
