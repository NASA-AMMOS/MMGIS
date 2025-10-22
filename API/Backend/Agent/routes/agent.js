const express = require("express");
const { planWithProvider } = require("../provider");

const router = express.Router();

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function scoreCandidate(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q) return 0;
  if (q === c) return 1;
  if (c && c.includes(q)) return Math.max(0.8, q.length / Math.max(c.length, 1));
  if (q && q.includes(c)) return Math.max(0.7, c.length / Math.max(q.length, 1));
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length, 1);
  return Math.max(0, 1 - dist / maxLen);
}

function findBestLayerInfo(query, store) {
  if (!store || !Array.isArray(store.index) || store.index.length === 0) {
    return null;
  }
  let best = null;
  let bestScore = 0;
  for (const entry of store.index) {
    const score = scoreCandidate(query, entry.item.name);
    if (score > bestScore) {
      bestScore = score;
      best = entry.item;
    }
  }
  if (!best) return null;
  return { item: best, score: bestScore };
}

function getToolNames(req) {
  return req.app?.locals?.agentToolNames || new Set();
}

function getValidators(req) {
  return req.app?.locals?.agentToolValidators || {};
}

function repr(v) {
  try {
    if (typeof v === "string") return `"${v}"`;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function validateAction(action, req) {
  if (!action || typeof action !== "object") {
    throw new TypeError(
      `Action must be an object; received ${repr(action)} instead`,
    );
  }
  const toolNames = getToolNames(req);
  if (!toolNames.has(action.tool)) {
    const expected = [...toolNames].join(", ") || "(none)";
    throw new Error(
      `Unknown tool '${action.tool}'. Expected one of ${expected}; received ${repr(action.tool)} instead`,
    );
  }
  const validators = getValidators(req);
  const validate = validators[action.tool];
  const args = action.args || {};
  if (typeof validate !== "function") {
    throw new Error(`No validator for tool ${action.tool}`);
  }
  const valid = validate(args);
  if (!valid) {
    const errors =
      (validate.errors || [])
        .map((e) => `${e.instancePath || ""} ${e.message}`)
        .join("; ") || "validation failed";
    const err = new Error(`${action.tool} args invalid: ${errors}`);
    err.validationErrors = validate.errors || [];
    throw err;
  }
  return { tool: action.tool, args };
}

router.post("/", express.json(), async function (req, res) {
  try {
    const message = req.body?.message ?? "";
    if (typeof message !== "string") {
      const err = new Error("Message must be a string.");
      err.status = 400;
      throw err;
    }
    if (message.length > 2000) {
      const err = new Error("Message too long (max 2000 chars).");
      err.status = 400;
      throw err;
    }

    const result = await planWithProvider(message);
    if (!result || !Array.isArray(result.actions)) {
      throw new Error(
        "Provider returned malformed response (missing actions array).",
      );
    }

    const reply = typeof result.reply === "string" ? result.reply.trim() : "";
    const citations = Array.isArray(result.citations) ? result.citations : [];
    const actions = result.actions.map((action) => validateAction(action, req));

    const planList = actions.map((a) => a.tool).join(", ") || "(none)";
    const planText = `Planned: ${planList}.`;

    const segments = [];
    if (reply) segments.push(reply);
    if (planText) segments.push(planText);
    const text = segments.join("\n\n");

    const debug = {
      providerAttempted: true,
      providerReturnedActions: actions.length > 0,
      providerFailureReason: null,
    };
    if (result.debug) {
      debug.azure = result.debug;
    }

    res.status(200).json({
      text,
      reply,
      citations,
      actions,
      source: "provider",
      debug,
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const response = {
      error: error.message || "Agent planning failed",
      stack: typeof error.stack === "string" ? error.stack.split(/\r?\n/) : [],
    };
    if (error.debug) response.debug = error.debug;
    if (error.validationErrors)
      response.validationErrors = error.validationErrors;
    res.status(status).json(response);
  }
});

router.get("/layer-info", (req, res) => {
  const store = req.app?.locals?.agentLayerInfo;
  if (!store || store.error) {
    res.status(404).json({
      error: "Layer metadata is unavailable.",
      code: "LayerInfoUnavailable",
      details: store?.error || null,
    });
    return;
  }

  const query =
    typeof req.query?.name === "string" ? req.query.name.trim() : "";
  let items = store.items || [];
  let match = null;
  if (query) {
    const found = findBestLayerInfo(query, store);
    if (found && found.score >= 0.35) {
      items = [found.item];
      match = {
        name: found.item.name,
        score: Number(found.score.toFixed(3)),
      };
    } else {
      items = [];
      match = null;
    }
  }

  res.status(200).json({
    items,
    match,
    source: {
      path: store.sourcePath || null,
      loadedAt: store.loadedAt || null,
    },
  });
});

module.exports = router;
