const fs = require("fs");
const path = require("path");
const semver = require("semver");

const logger = require("./logger");
const { validatePluginConfig } = require("./pluginValidation");
const { discoverPlugins } = require("./pluginDiscovery");

const PLUGINS_ROOT = path.join(__dirname, "..", "plugins");
const MMGIS_VERSION = require("../package.json").version;

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

  // Check engines.mmgis compatibility.
  if (config.engines && config.engines.mmgis) {
    const coercedVersion = semver.coerce(MMGIS_VERSION);
    if (coercedVersion && !semver.satisfies(coercedVersion, config.engines.mmgis)) {
      logger(
        "error",
        `${pluginType[0].toUpperCase() + pluginType.slice(1)} '${name}' requires MMGIS ${config.engines.mmgis} but current version is ${MMGIS_VERSION} — skipping`,
        loggerCategory
      );
      return false;
    }
  }

  const isOverride = registry[name] !== undefined;

  // Enforce overridable: false — reject external plugins trying to
  // override a core plugin that explicitly disallows it.
  if (isOverride && registry[name].overridable === false) {
    logger(
      "error",
      `${pluginType[0].toUpperCase() + pluginType.slice(1)} '${name}' is marked overridable:false and cannot be overridden by ${source}`,
      loggerCategory
    );
    return false;
  }

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
  const allTools = discoverPlugins(PLUGINS_ROOT, "tools", "plugin.json", { loggerCategory: "Tools" });
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
      "Kinds tool is required but is not found. Are you missing a plugin.json?",
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
  const allComponents = discoverPlugins(PLUGINS_ROOT, "components", "plugin.json", { loggerCategory: "Components" });
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
