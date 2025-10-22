const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const router = require("./routes/agent");

const LAYER_INFO_PATH = path.join(__dirname, "layer_name_info.txt");

function normalizeLayerName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseLayerInfo(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (!parts[0]) return null;
      return {
        name: parts[0],
        summary: parts[1] || "",
        citation: parts[2] || "",
        normalized: normalizeLayerName(parts[0]),
      };
    })
    .filter(Boolean);
}

function loadLayerInfoFromDisk(filePath) {
  const store = {
    items: [],
    index: [],
    sourcePath: filePath,
    loadedAt: null,
    error: null,
  };
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseLayerInfo(raw);
    store.items = parsed.map((item) => ({
      name: item.name,
      summary: item.summary,
      citation: item.citation,
    }));
    store.index = parsed.map((item) => ({
      normalized: item.normalized,
      item: {
        name: item.name,
        summary: item.summary,
        citation: item.citation,
      },
    }));
    store.loadedAt = new Date().toISOString();
  } catch (error) {
    store.error = { message: error.message, code: error.code };
  }
  return store;
}

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    // Load tool registry and compile validators once
    try {
      const registryPath = path.join(__dirname, "tool-registry.json");
      const raw = fs.readFileSync(registryPath, "utf8");
      const registry = JSON.parse(raw);

      const ajv = new Ajv({
        allErrors: true,
        strict: false,
        coerceTypes: true,
        useDefaults: true,
      });
      const validators = {};
      const toolNames = new Set();
      for (const t of registry.tools || []) {
        toolNames.add(t.name);
        // Ajv can validate top-level schema; we wrap params under object if needed
        validators[t.name] = ajv.compile(
          t.parameters || { type: "object", additionalProperties: false },
        );
      }
      s.app.locals.agentToolRegistry = registry;
      s.app.locals.agentAjv = ajv;
      s.app.locals.agentToolValidators = validators;
      s.app.locals.agentToolNames = toolNames;
    } catch (e) {
      // If registry fails to load, keep running; routes will degrade gracefully
      s.app.locals.agentToolRegistry = { tools: [] };
      s.app.locals.agentToolValidators = {};
      s.app.locals.agentToolNames = new Set();
    }

    // Load optional layer metadata for the information tool
    s.app.locals.agentLayerInfo = loadLayerInfoFromDisk(LAYER_INFO_PATH);

    // Read-only endpoint to fetch the current registry
    s.app.get(
      s.ROOT_PATH + "/api/agent/tools",
      s.checkHeadersCodeInjection,
      s.setContentType,
      (req, res) => {
        res.status(200).json(req.app.locals.agentToolRegistry || { tools: [] });
      },
    );

    s.app.use(
      s.ROOT_PATH + "/api/agent",
      s.checkHeadersCodeInjection,
      s.setContentType,
      router,
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {},
};

module.exports = setup;
