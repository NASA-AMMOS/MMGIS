const fs = require("fs");
const path = require("path");

const logger = require("./logger");
const { validatePluginConfig } = require("./pluginValidation");
const { discoverPluginsUnified } = require("./pluginDiscovery");

const PLUGINS_ROOT = path.join(__dirname, "..", "plugins");

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
    "loaded",
    `${pluginType[0].toUpperCase() + pluginType.slice(1)}: ${name} from ${source}${
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

  // Single-pass scan of plugins/*/tools/
  const allTools = discoverPluginsUnified(PLUGINS_ROOT, "tools", "config.json", { loggerCategory: "Tools" });
  for (const plugin of allTools) {
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

  // 5. Build dynamic /src/pre/tools.js file with static imports for every
  //    tool. Tool modules are referenced synchronously by cross-tool code
  //    (e.g. `Map_` feature-click hands off to `InfoTool.use(...)`,
  //    `LegendTool` reads `LayersTool.populateCogScale`), so they must be
  //    available the moment `ToolController_` is initialised.
  let toolConfigs = "";
  const toolModules = {};
  let kindsModule = null;
  for (const t in tools) {
    for (const p in tools[t].paths) {
      if (p === "Kinds") {
        kindsModule = p;
        toolConfigs += `import kinds from '../${tools[t].paths[p]}'\n`;
      } else {
        toolModules[p] = p;
        toolConfigs += `import ${p} from '../${tools[t].paths[p]}'\n`;
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

  // Single-pass scan of plugins/*/components/
  const allComponents = discoverPluginsUnified(PLUGINS_ROOT, "components", "config.json", { loggerCategory: "Components" });
  for (const plugin of allComponents) {
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
