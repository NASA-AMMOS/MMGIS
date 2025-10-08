require("dotenv").config();
const { AzureOpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

function loadRegistry() {
  try {
    const p = path.join(__dirname, "tool-registry.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return { tools: [] };
  }
}

const registry = loadRegistry();
const TOOL_NAMES = new Set((registry.tools || []).map((t) => t.name));

function haveAzureEnv() {
  const missing = [];
  if (!process.env.AZURE_OPENAI_ENDPOINT) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!process.env.AZURE_OPENAI_API_KEY) missing.push("AZURE_OPENAI_API_KEY");
  if (!process.env.AZURE_OPENAI_DEPLOYMENT)
    missing.push("AZURE_OPENAI_DEPLOYMENT");
  const ver = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
  if (!ver) missing.push("AZURE_OPENAI_API_VERSION");
  return { ok: missing.length === 0, missing, ver };
}

async function planWithProvider(message) {
  const env = haveAzureEnv();
  if (!env.ok) {
    return {
      actions: [],
      debug: { reason: "MissingEnv", missing: env.missing },
    };
  }

  const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: env.ver,
  });

  const model = process.env.AZURE_OPENAI_DEPLOYMENT;
  const messages = [
    {
      role: "system",
      content: [
        "You are an MMGIS agent that emits ONLY tool calls (function calls) from this set: list_layers, toggle_layer, set_layer_opacity, zoom_to.",
        "Before your tool call, include a single short sentence rationale in your assistant message content (plain English).",
        "Selection rules:",
        "- If the user asks to list layers, use list_layers.",
        "- If the user mentions a specific layer name with an action (toggle/turn on/off/show/hide), use toggle_layer with that exact name; if 'turn on' or 'show' ⇒ visible=true; if 'turn off' or 'hide' ⇒ visible=false; if just 'toggle' with no explicit on/off ⇒ visible=true.",
        "- If the user asks to set opacity, use set_layer_opacity with the given name and numeric opacity.",
        "- If the user asks to zoom to lon,lat, use zoom_to with center:[lon,lat] and zoom; if bbox given, use bbox.",
        "- If the user only provides a location name to zoom, infer the lat lon and include that in your rationale.",
        "- If the user does not provide a zoom level, use zoom=15 and include that in your rationale.",
        "Examples:",
        "User: 'Please toggle OSM_Basemap' ⇒ toggle_layer { name:'OSM_Basemap', visible:true }",
        "User: 'Hide Sample_Points' ⇒ toggle_layer { name:'Sample_Points', visible:false }",
        "User: 'Set Sample_Points opacity to 0.7' ⇒ set_layer_opacity { name:'Sample_Points', opacity:0.7 }",
        "User: 'Zoom to 0, 80 at zoom 6' ⇒ zoom_to { center:[0,80], zoom:6 }",
      ].join("\n"),
    },
    { role: "user", content: message },
  ];
  const tools = (registry.tools || []).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || t.name,
      // Prefer modelParameters for provider-facing schemas (cannot use top-level oneOf)
      parameters: t.modelParameters ||
        t.parameters || {
          type: "object",
          additionalProperties: false,
        },
    },
  }));

  const request = {
    model,
    messages,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    // No temperature override: some Azure models only accept default (1)
  };

  const requestSummary = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: model,
    apiVersion: env.ver,
    toolCount: tools.length,
    toolChoice: request.tool_choice,
    parallelToolCalls: request.parallel_tool_calls === false ? false : true,
    messagePreview: String(message).slice(0, 120),
  };

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), ms)),
    ]);
  }
  try {
    const result = await withTimeout(
      client.chat.completions.create({ ...request }),
      10000,
    );

    const choice = result && result.choices && result.choices[0];
    const msg = choice && choice.message;
    const rationale =
      msg && typeof msg.content === "string"
        ? msg.content.slice(0, 200)
        : undefined;
    const calls = (msg && (msg.tool_calls || msg.toolCalls)) || [];
    const actions = [];
    for (const c of calls) {
      const fn = c && c.function;
      const name = fn && fn.name;
      if (!name || !TOOL_NAMES.has(name)) continue;
      let args = {};
      const raw = fn && fn.arguments;
      if (raw && typeof raw === "object") args = raw;
      else if (typeof raw === "string") {
        try {
          args = JSON.parse(raw);
        } catch (_) {
          args = {};
        }
      }
      actions.push({ tool: name, args });
    }
    return {
      actions,
      debug: {
        request: requestSummary,
        response: {
          status: 200,
          choicesCount: Array.isArray(result && result.choices)
            ? result.choices.length
            : 0,
          toolCallsCount: Array.isArray(calls) ? calls.length : 0,
          request_id: result && result._request_id,
        },
        rationale,
      },
    };
  } catch (e) {
    const isAbort = /Timeout/i.test(String(e && e.message));
    return {
      actions: [],
      debug: {
        reason: isAbort ? "Timeout" : (e && e.message) || "Error",
        request: requestSummary,
        response: { status: isAbort ? "aborted" : "error" },
      },
    };
  }
}

module.exports = { planWithProvider, haveAzureEnv };
