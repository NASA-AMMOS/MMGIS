const fetch = require("node-fetch");

const TOOL_NAMES = new Set([
  "list_layers",
  "toggle_layer",
  "set_layer_opacity",
  "zoom_to",
]);

async function planWithProvider(message) {
  const ep = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const dep = process.env.AZURE_OPENAI_DEPLOYMENT;
  const ver = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
  if (!ep || !key || !dep || !ver) return [];

  const url = `${ep}/openai/deployments/${dep}/chat/completions?api-version=${ver}`;
  const sys = [
    {
      role: "system",
      content:
        "You are an MMGIS agent. Output ONLY function calls for these tools: list_layers, toggle_layer, set_layer_opacity, zoom_to. No other tools.",
    },
  ];
  const user = [{ role: "user", content: message }];
  const tools = [
    {
      type: "function",
      function: {
        name: "list_layers",
        description: "List all layer display names",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "toggle_layer",
        description: "Toggle a layer visibility",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            visible: { type: "boolean" },
          },
          required: ["name", "visible"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_layer_opacity",
        description: "Set layer opacity 0..1",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            opacity: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["name", "opacity"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "zoom_to",
        description: "Zoom to center/zoom or bbox",
        parameters: {
          type: "object",
          oneOf: [
            {
              properties: {
                center: {
                  type: "array",
                  items: { type: "number" },
                  minItems: 2,
                  maxItems: 2,
                },
                zoom: { type: "integer" },
              },
              required: ["center", "zoom"],
              additionalProperties: false,
            },
            {
              properties: {
                bbox: {
                  type: "array",
                  items: { type: "number" },
                  minItems: 4,
                  maxItems: 4,
                },
              },
              required: ["bbox"],
              additionalProperties: false,
            },
          ],
        },
      },
    },
  ];

  const body = {
    messages: [...sys, ...user],
    temperature: 0,
    tools,
    tool_choice: "auto",
    response_format: { type: "json_object" },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const msg =
    data && data.choices && data.choices[0] && data.choices[0].message;
  const calls = (msg && msg.tool_calls) || [];
  const actions = [];
  for (const c of calls) {
    if (!c || !c.function || !c.function.name) continue;
    const name = c.function.name;
    if (!TOOL_NAMES.has(name)) continue;
    let args = {};
    try {
      args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
    } catch (e) {
      args = {};
    }
    actions.push({ tool: name, args });
  }
  return actions;
}

module.exports = { planWithProvider };
