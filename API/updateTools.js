const fs = require("fs");
const path = require("path");

const logger = require("./logger");
const { validatePluginConfig } = require("./pluginValidation");
const { discoverPlugins } = require("./pluginDiscovery");

const STANDARD_TOOLS_PATH = "./src/essence/Tools";
const STANDARD_COMPONENTS_PATH = "./src/essence/Components";
const ESSENCE_PATH = path.join(__dirname, "..", "src", "essence");
const TOOL_PLUGIN_PATTERNS = ["Private-Tools", "Plugin-Tools"];
const COMPONENT_PLUGIN_PATTERNS = ["Private-Components", "Plugin-Components"];

/**
 * Register a single plugin's parsed config.json onto the in-memory
 * registry. Returns true if the plugin was registered, false if it was
 * rejected for failing validation.
 */
function registerPlugin({
  registry,
  name,
  config,
  pluginType,
  source,
  loggerCategory,
}) {
  const errors = validatePluginConfig(config, name, pluginType);
  if (errors.length > 0) {
    for (const e of errors) {
      logger("error", e, loggerCategory);
    }
    logger(
      "error",
      `Skipping invalid ${pluginType} plugin: ${name}${
        source ? ` from ${source}` : ""
      }`,
      loggerCategory
    );
    return false;
  }
  const isOverride = registry[name] !== undefined;
  registry[name] = config;
  logger(
    "info",
    `Loaded ${pluginType}: ${name} from ${source}${
      isOverride ? ` (overriding standard ${pluginType})` : ""
    }`,
    loggerCategory
  );
  if (isOverride) {
    logger(
      "warn",
      `${pluginType[0].toUpperCase() + pluginType.slice(1)} '${name}' overridden by ${source}`,
      loggerCategory
    );
  }
  return true;
}

function updateTools() {
  let tools = {};

  // 1. Standard tools live directly under src/essence/Tools/<ToolName>/config.json
  //    Use discoverPlugins() with an exact-name pattern so the shared
  //    scanner picks up `Tools` as the container.
  const standardToolPlugins = discoverPlugins(
    path.join(ESSENCE_PATH),
    ["__exact:Tools"],
    "config.json",
    { loggerCategory: "Tools" }
  );
  for (const plugin of standardToolPlugins) {
    registerPlugin({
      registry: tools,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "tool",
      source: "Tools",
      loggerCategory: "Tools",
    });
  }

  // 2. Plugin/private tool containers (e.g. *Plugin-Tools*, *Private-Tools*).
  //    Same scan, but with substring matching on container names.
  const pluginToolPlugins = discoverPlugins(
    ESSENCE_PATH,
    TOOL_PLUGIN_PATTERNS,
    "config.json",
    { loggerCategory: "Tools" }
  );
  for (const plugin of pluginToolPlugins) {
    registerPlugin({
      registry: tools,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "tool",
      source: plugin.container,
      loggerCategory: "Tools",
    });
  }

  // 3. Sort by toolbarPriority (preserve previous behavior).
  tools = Object.keys(tools)
    .sort(function (a, b) {
      return (
        (tools[a].toolbarPriority || 1000) - (tools[b].toolbarPriority || 1000)
      );
    })
    .reduce((obj, key) => {
      obj[key] = tools[key];
      return obj;
    }, {});

  // 4. Build dynamic toolConfigs.json for the Configure page.
  try {
    fs.writeFileSync(
      "./configure/public/toolConfigs.json",
      JSON.stringify(tools)
    );
    logger(
      "success",
      "Successfully updated source tool configurations.",
      "Tools"
    );
  } catch (err) {
    logger("error", "Failed to write toolConfigs.json", "Tools", null, err);
  }

  // 5. Build dynamic /src/pre/tools.js file
  //
  // Each tool is emitted as a lazy import:
  //    const FooTool = () => import(/* webpackChunkName: "tool-Foo" */ '...')
  //
  // The `Kinds` tool is still a default-export object and is needed
  // synchronously at startup, so it remains a static import.
  //
  // `toolModules` maps the import name to its lazy loader function (or,
  // once resolved, to the loaded module). `ToolController_` resolves
  // the loader lazily via `ensureToolLoaded(name)`.
  let toolConfigs = "";
  const toolModules = {};
  let kindsModule = null;
  for (const t in tools) {
    for (const p in tools[t].paths) {
      if (p === "Kinds") {
        // Kinds is the only required-at-startup tool. Keep the static
        // import so it's bundled into the main chunk.
        kindsModule = p;
        toolConfigs += `import kinds from '../${tools[t].paths[p]}'\n`;
      } else {
        const chunkName = `tool-${p}`;
        toolModules[p] = p;
        toolConfigs += `const ${p} = () => import(/* webpackChunkName: "${chunkName}" */ '../${tools[t].paths[p]}')\n`;
      }
    }
  }

  toolConfigs += `\n`;
  toolConfigs += `export const toolConfigs = ${JSON.stringify(tools)}\n`;
  toolConfigs += `export const toolModules = ${JSON.stringify(
    toolModules
  ).replace(/"/g, "")}\n`;
  toolConfigs += `export const Kinds = kinds`;

  if (kindsModule == null) {
    logger(
      "error",
      "Kinds tool is required but is not found. Are you missing a config.js?",
      "Tools",
      null
    );
  } else {
    try {
      fs.writeFileSync("./src/pre/tools.js", toolConfigs);
      logger("success", "Successfully plugged-in tools.", "Tools");
    } catch (err) {
      logger(
        "error",
        "Failed to write tool paths to src tools.js",
        "Tools",
        null,
        err
      );
    }
  }
}

function updateComponents() {
  let components = {};

  // 1. Standard components: src/essence/Components/<ComponentName>/config.json.
  //    The standard Components directory is optional — `discoverPlugins`
  //    will warn but not throw if it doesn't exist.
  const standardComponentPlugins = discoverPlugins(
    ESSENCE_PATH,
    ["__exact:Components"],
    "config.json",
    { loggerCategory: "Components" }
  );
  for (const plugin of standardComponentPlugins) {
    registerPlugin({
      registry: components,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "component",
      source: "Components",
      loggerCategory: "Components",
    });
  }

  // 2. Plugin/private component containers.
  const pluginComponentPlugins = discoverPlugins(
    ESSENCE_PATH,
    COMPONENT_PLUGIN_PATTERNS,
    "config.json",
    { loggerCategory: "Components" }
  );
  for (const plugin of pluginComponentPlugins) {
    registerPlugin({
      registry: components,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "component",
      source: plugin.container,
      loggerCategory: "Components",
    });
  }

  // 3. Write componentConfigs.json (Configure page) and src/pre/components.js.
  try {
    fs.writeFileSync(
      "./configure/public/componentConfigs.json",
      JSON.stringify(components)
    );
    logger(
      "success",
      "Successfully updated source component configurations.",
      "Components"
    );
  } catch (err) {
    logger(
      "error",
      "Failed to write componentConfigs.json",
      "Components",
      null,
      err
    );
  }

  let componentConfigs = "";
  const componentModules = {};
  for (const c in components) {
    for (const p in components[c].paths) {
      componentModules[p] = p;
      componentConfigs += `import ${p} from '../${components[c].paths[p]}'\n`;
    }
  }

  componentConfigs += `\n`;
  componentConfigs += `export const componentConfigs = ${JSON.stringify(
    components
  )}\n`;
  componentConfigs += `export const componentModules = ${JSON.stringify(
    componentModules
  ).replace(/"/g, "")}\n`;

  try {
    fs.writeFileSync("./src/pre/components.js", componentConfigs);
    logger("success", "Successfully plugged-in components.", "Components");
  } catch (err) {
    logger(
      "error",
      "Failed to write component paths to src/pre/components.js",
      "Components",
      null,
      err
    );
  }
}

module.exports = { updateTools, updateComponents };
