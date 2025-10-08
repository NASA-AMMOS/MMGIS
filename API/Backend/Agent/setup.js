const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const router = require("./routes/agent");

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
