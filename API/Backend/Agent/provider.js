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
        "You are an MMGIS agent. You may call tools exposed to you.",
        "Emit only function calls from the available tools when needed.",
        "Before a tool call, include one short rationale sentence.",
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

// Expose a deterministic tool export for snapshot tests and introspection
function listProviderTools() {
  const reg = loadRegistry();
  return (reg.tools || []).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || t.name,
      parameters: t.modelParameters ||
        t.parameters || { type: "object", additionalProperties: false },
    },
  }));
}

module.exports = { planWithProvider, haveAzureEnv, listProviderTools };
