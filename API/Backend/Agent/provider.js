require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { haveFasEnv, runAgentMessage } = require("./azureService");

function loadRegistry() {
  const registryPath = path.join(__dirname, "tool-registry.json");
  let raw;
  try {
    raw = fs.readFileSync(registryPath, "utf8");
  } catch (error) {
    const err = new Error(
      `Unable to read tool registry at ${registryPath}: ${error.message}`,
    );
    err.code = "ToolRegistryReadError";
    err.cause = error;
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tools)) {
      throw new Error("Registry must provide a 'tools' array.");
    }
    return parsed;
  } catch (error) {
    const err = new Error(
      `Invalid tool registry JSON at ${registryPath}: ${error.message}`,
    );
    err.code = "ToolRegistryParseError";
    err.cause = error;
    throw err;
  }
}

const registry = loadRegistry();
const toolsList = registry.tools || [];
const TOOL_NAMES = new Set(toolsList.map((t) => t.name));
const TOOL_NAME_LIST = toolsList.map((t) => t.name).sort();
const TOOL_DESCRIPTIONS = toolsList
  .map((t) => `- ${t.name}: ${t.description || "No description provided."}`)
  .join("\n");

function haveAzureEnv() {
  const fas = haveFasEnv();
  return { ok: fas.ok, missing: fas.missing, ver: fas.apiVersion };
}

function buildPrompt(message) {
  return [
    "You are the MMGIS Copilot assisting users inside the MMGIS web app.",
    "Available tools:",
    TOOL_DESCRIPTIONS || "- (none)",
    "Always respond with minified JSON on a single line that matches this schema:",
    '{"actions":[{"tool":"string","args":{}}],"reply":"optional markdown string","citations":[{"title":"string","url":"string"}]}',
    "Guidelines:",
    "- Use actions for map-centric requests (layer visibility, opacity, zoom, etc.).",
    "- Normalize typos or paraphrasing to identify the correct tool and layer.",
    "- When a layer match is inferred (no exact match), confirm with the user first: respond with actions:[] and a clarifying reply that cites the resolved layer.",
    "- Include the original user query in args.original_query when asking for confirmation on layer-specific tools.",
    "- For informational questions, set actions to [] and populate reply with a concise, grounded summary.",
    "- When reply cites external knowledge, include 2-4 representative citations array entries (title + URL).",
    "- Prefer sources from the MMGIS documentation and GitHub repositories surfaced via your Bing grounding connection.",
    "- Never invent tool names; only use those listed above. Omit actions if none are required.",
    "- Do NOT execute or invoke tools/functions in this conversation-only describe the plan in JSON.",
    "Tool usage quick reference:",
    '  * List visible layers -> {"actions":[{"tool":"list_layers","args":{}}]}',
    '  * Toggle visibility -> {"actions":[{"tool":"toggle_layer","args":{"name":"Layer","visible":true}}]}',
    '  * Adjust opacity -> {"actions":[{"tool":"set_layer_opacity","args":{"name":"Layer","opacity":0.5}}]}',
    '  * Zoom -> {"actions":[{"tool":"zoom_to","args":{"center":[lon,lat],"zoom":12}}]}',
    '  * Layer info -> {"actions":[{"tool":"layer_information","args":{"layer_name":"Air Quality Index","original_query":"Show me air quality data"}}]}',
    '  * Mean value -> {"actions":[{"tool":"calculate_layer_mean","args":{"layer_name":"Sea Surface Temperature","geographical_area":"Beaufort Sea"}}]}',
    '  * Contours -> {"actions":[{"tool":"visualize_contours","args":{"layer_name":"Sea Surface Temperature","variable":"temperature","operator":">","value":2.5,"time":"2024-06-01T00:00:00Z"}}]}',
    '  * Difference -> {"actions":[{"tool":"calculate_layer_difference","args":{"layer_a":"Precipitation Rate","layer_b":"Vegetation Index"}}]}',
    "Examples:",
    'User: "Please list layers."\nAssistant: {"actions":[{"tool":"list_layers","args":{}}]}',
    'User: "What is MMGIS?"\nAssistant: {"actions":[],"reply":"<short grounded answer>","citations":[{"title":"MMGIS GitHub Repository","url":"https://github.com/NASA-AMMOS/MMGIS"}]}',
    `User request: ${String(message).slice(0, 1000)}`,
  ].join("\n");
}

function extractAssistantText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const candidate =
        (part &&
          part.text &&
          typeof part.text.value === "string" &&
          part.text.value) ||
        (part && typeof part.text === "string" && part.text) ||
        (part && typeof part.value === "string" && part.value) ||
        (part && typeof part.content === "string" && part.content) ||
        (part &&
          part.content &&
          typeof part.content.text === "string" &&
          part.content.text) ||
        "";
      if (candidate) {
        return candidate;
      }
    }
  }
  if (typeof message.text === "string") return message.text;
  return "";
}

function parseAgentPlan(rawAssistantText) {
  const trimmed =
    typeof rawAssistantText === "string" ? rawAssistantText.trim() : "";
  if (!trimmed) {
    throw new Error("Azure Agent Service returned an empty response.");
  }
  const jsonCandidate =
    trimmed.match(/^\s*\{[\s\S]*\}\s*$/m)?.[0] ||
    trimmed.match(/\{[\s\S]*?\}/m)?.[0] ||
    trimmed;
  try {
    const plan = JSON.parse(jsonCandidate);
    if (!plan || typeof plan !== "object") {
      throw new Error("Plan must be a JSON object.");
    }
    return plan;
  } catch (error) {
    const err = new Error(
      `Azure Agent Service returned non-JSON response: ${error.message}`,
    );
    err.code = "InvalidAgentPlan";
    err.raw = rawAssistantText;
    err.cause = error;
    throw err;
  }
}

function normalizeActions(actions) {
  if (actions == null) return [];
  if (!Array.isArray(actions)) {
    throw new Error("Azure Agent Service plan missing 'actions' array.");
  }
  return actions.map((action, index) => {
    if (!action || typeof action !== "object") {
      throw new Error(`Plan action at index ${index} is not an object.`);
    }
    if (typeof action.tool !== "string" || !action.tool.trim()) {
      throw new Error(`Plan action at index ${index} missing 'tool' name.`);
    }
    if (!TOOL_NAMES.has(action.tool)) {
      throw new Error(
        `Plan action references unknown tool '${action.tool}'. Valid tools: ${[...TOOL_NAMES].join(", ")}`,
      );
    }
    if (action.args && typeof action.args !== "object") {
      throw new Error(`Plan action '${action.tool}' has non-object args.`);
    }
    return { tool: action.tool, args: action.args || {} };
  });
}

function normalizeCitations(citations) {
  if (!Array.isArray(citations)) return [];
  const normalized = [];
  const seen = new Set();
  for (const entry of citations) {
    const value =
      typeof entry === "string" ? { title: entry, url: entry } : entry;
    if (
      value &&
      typeof value.title === "string" &&
      value.title &&
      typeof value.url === "string" &&
      value.url
    ) {
      if (!seen.has(value.url)) {
        seen.add(value.url);
        normalized.push({ title: value.title, url: value.url });
      }
    }
  }
  return normalized;
}

function fallbackMessage() {
  const list =
    TOOL_NAME_LIST.length > 0 ? TOOL_NAME_LIST.join(", ") : "(no tools)";
  return `I'm sorry, I can't perform that operation. Here are the available tools: ${list}.`;
}

async function planWithProvider(message) {
  const env = haveAzureEnv();
  if (!env.ok) {
    throw new Error(
      `Azure Agent Service not configured. Missing environment variables: ${env.missing.join(", ")}`,
    );
  }

  const prompt = buildPrompt(message);
  const azure = await runAgentMessage(prompt);
  const assistantMessage = azure?.message;
  if (!assistantMessage) {
    throw new Error(
      "Azure Agent Service response did not include an assistant message.",
    );
  }

  const rawAssistantText = extractAssistantText(assistantMessage);
  if (!rawAssistantText || !rawAssistantText.trim()) {
    throw new Error("Azure Agent Service returned an empty response.");
  }

  const plan = parseAgentPlan(rawAssistantText);
  const actions = normalizeActions(plan.actions);
  let reply =
    typeof plan.reply === "string" && plan.reply.trim().length > 0
      ? plan.reply.trim()
      : rawAssistantText.trim();
  const citations = normalizeCitations(plan.citations);
  const usedFallback = actions.length === 0 && (!reply || reply.length === 0);
  if (usedFallback) {
    reply = fallbackMessage();
  }

  return {
    actions,
    reply,
    citations,
    debug: {
      request: { toolCount: TOOL_NAMES.size },
      response: { status: 200 },
      message: rawAssistantText,
      run: azure?.run
        ? {
            id: azure.run.id,
            status: azure.run.status,
          }
        : undefined,
      fallbackApplied: usedFallback,
    },
  };
}

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
