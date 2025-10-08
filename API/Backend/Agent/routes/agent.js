const express = require("express");
const fetch = require("node-fetch");
const { AzureOpenAI } = require("openai");
const { planWithProvider, haveAzureEnv } = require("../provider");

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
function fallbackPlan(_message) {
  // Intentionally no hard-coded tool routing; rely on provider.
  return [];
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

  const planList = actions.map((a) => a.tool).join(", ") || "(none)";
  let text =
    `Planned: ${planList}.` +
    (errors.length ? ` Dropped: ${errors.join("; ")}` : "");

  res.status(200).json({
    text: source === "fallback" ? text + " (fallback)" : text,
    actions,
    source,
    debug,
  });
});

// Execute a single action on the server when adapter = "openapi" (e.g., web search)
router.post("/exec", express.json(), async function (req, res) {
  const registry = req.app?.locals?.agentToolRegistry || { tools: [] };
  const validators = req.app?.locals?.agentToolValidators || {};
  const toolMap = {};
  for (const t of registry.tools || []) toolMap[t.name] = t;

  const action = (req.body && req.body.action) || null;
  const v = validateAction.call({ req }, action);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.err });

  const spec = toolMap[action.tool];
  if (!spec || !spec.execution) {
    return res
      .status(400)
      .json({ ok: false, error: "No execution descriptor for tool" });
  }
  const exec = spec.execution;
  if (exec.adapter !== "openapi") {
    return res.status(400).json({ ok: false, error: "Unsupported adapter" });
  }

  async function webSearchProduct(query) {
    const endpoint =
      process.env.AZURE_BING_SEARCH_ENDPOINT ||
      "https://api.bing.microsoft.com/v7.0/search";
    const key =
      process.env.AZURE_BING_SEARCH_KEY ||
      process.env.BING_SEARCH_KEY ||
      process.env.BING_SUBSCRIPTION_KEY;

    let links = [];
    let citations = [];
    try {
      if (!key) throw new Error("Missing Bing Search key");
      const url = `${endpoint}?q=${encodeURIComponent(query)}&count=4&textDecorations=false&safeSearch=Moderate`;
      const r = await fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      const j = (await r.json()) || {};
      const vals = (j.webPages && j.webPages.value) || [];
      links = vals.map((v) => ({ title: v.name, url: v.url })).slice(0, 4);
      citations = links.map((l) => l.url);
    } catch (_) {
      // continue with empty links; summary will reflect no results
    }

    // Summarize with Azure OpenAI if available
    let summary = links.length
      ? `Top sources for "${query}": ${links.map((l) => l.title).join(", ")}.`
      : `No sources found for "${query}".`;
    try {
      const env = haveAzureEnv();
      if (env.ok) {
        const client = new AzureOpenAI({
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiVersion: env.ver,
        });
        const model = process.env.AZURE_OPENAI_DEPLOYMENT;
        const sys =
          "You summarize web search results succinctly in one or two sentences.";
        const user = [
          `Query: ${query}`,
          `Links:`,
          ...links.map((l, i) => `${i + 1}. ${l.title} - ${l.url}`),
          `Write one short summary sentence.`,
        ].join("\n");
        const cr = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          temperature: 0.2,
        });
        const content =
          cr && cr.choices && cr.choices[0] && cr.choices[0].message?.content;
        if (content && typeof content === "string") summary = content.trim();
      }
    } catch (_) {}

    return { summary, links, citations };
  }

  try {
    if (exec.operation === "web_search_product") {
      const q = String(action.args?.query || "").slice(0, 200);
      const result = await webSearchProduct(q);
      return res.status(200).json({ ok: true, result });
    }
    return res.status(400).json({ ok: false, error: "Unknown operation" });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: (e && e.message) || "Execution error" });
  }
});

module.exports = router;
