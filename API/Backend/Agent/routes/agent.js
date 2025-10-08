const express = require("express");
const { planWithProvider } = require("../provider");

const router = express.Router();

// --- Registry-backed validation ---
function getToolNames(req) {
  return req.app?.locals?.agentToolNames || new Set();
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// New helper for clearer error messages
function repr(v) {
  try {
    if (typeof v === "string") return `"${v}"`;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function validateAction(a) {
  if (!a || typeof a !== "object")
    return {
      ok: false,
      err: `Action must be an object; received ${repr(a)} instead`,
    };
  const TOOL_NAMES = getToolNames(this.req || {});
  if (!TOOL_NAMES.has(a.tool))
    return {
      ok: false,
      err: `Unknown tool '${a.tool}'. Expected one of ${[...TOOL_NAMES].join(
        ", ",
      )}; received ${repr(a.tool)} instead`,
    };
  const validators =
    (this.req &&
      this.req.app &&
      this.req.app.locals &&
      this.req.app.locals.agentToolValidators) ||
    {};
  const validate = validators[a.tool];
  const args = a.args || {};
  if (typeof validate !== "function") {
    return { ok: false, err: `No validator for tool ${a.tool}` };
  }
  const valid = validate(args);
  if (!valid) {
    const errors = (validate.errors || [])
      .map((e) => `${e.instancePath || ""} ${e.message}`)
      .join("; ");
    return { ok: false, err: `${a.tool} args invalid: ${errors}` };
  }
  return { ok: true, action: { tool: a.tool, args } };
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
    const v = validateAction.call({ req }, a);
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
