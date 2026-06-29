const fs = require("fs");
const path = require("path");
const semver = require("semver");

const logger = require("./logger");
const { validatePluginConfig } = require("./pluginValidation");
const { discoverPlugins, checkPluginDependencies } = require("./pluginDiscovery");

const PLUGINS_ROOT = path.join(__dirname, "..", "plugins");
const REPO_ROOT = path.join(__dirname, "..");
const SRC_PRE_DIR = path.join(REPO_ROOT, "src", "pre");
const MMGIS_VERSION = require("../package.json").version;

/**
 * Resolve a plugin path value for use in generated import statements.
 * - Relative paths (starting with "./") are resolved from the plugin's
 *   directory and converted to a path relative to src/pre/.
 * - Legacy absolute-ish paths (starting with "../") are prefixed with
 *   "../" as before (from src/pre/ → src/ → repo root).
 *
 * Always returns POSIX separators (/) since the result is used in JS
 * import statements, not filesystem operations.
 */
function resolvePluginPath(pathValue, pluginPath) {
  if (pathValue.startsWith("./") && pluginPath) {
    const abs = path.resolve(pluginPath, pathValue);
    const rel = path.relative(SRC_PRE_DIR, abs).split(path.sep).join("/");
    return rel;
  }
  if (pathValue.startsWith("../")) {
    // Legacy "../" prefix — keep existing behavior.
    return `../${pathValue}`;
  }
  // Bare path — treat as legacy.
  return `../${pathValue}`;
}

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
  // Separate map from plugin name → pluginPath so we don't mutate manifests.
  const toolPluginPaths = {};

  // Single-pass scan of plugins/*/tools/
  const allTools = discoverPlugins(PLUGINS_ROOT, "tools", "plugin.json", { loggerCategory: "Tools" });
  for (const plugin of allTools) {
    const registered = registerPlugin({
      registry: tools,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "tool",
      source: plugin.container,
      loggerCategory: "Tools",
    });
    if (registered) toolPluginPaths[plugin.name] = plugin.pluginPath;
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
  // Paths values in plugin.json can be:
  //   - Relative ("./DrawTool") — resolved from the plugin's directory
  //   - Legacy ("../plugins/core/tools/X/XTool") — prefixed with "../"
  // Both produce correct import paths relative to src/pre/.
  for (const t in tools) {
    const pluginPath = toolPluginPaths[t] || null;
    for (const p in tools[t].paths) {
      const resolved = resolvePluginPath(tools[t].paths[p], pluginPath);
      toolModules[p] = p;
      toolConfigs += `import ${p} from '${resolved}'\n`;
    }
  }

  toolConfigs += `\n`;
  toolConfigs += `export const toolConfigs = ${JSON.stringify(tools)}\n`;
  toolConfigs += `export const toolModules = ${JSON.stringify(
    toolModules
  ).replace(/"/g, "")}\n`;

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

  // Check inter-plugin dependencies (warns if a tool's backend dep is missing/disabled).
  checkPluginDependencies(PLUGINS_ROOT, "Tools");
}

function updateComponents() {
  let components = {};
  const componentPluginPaths = {};

  // Single-pass scan of plugins/*/components/
  const allComponents = discoverPlugins(PLUGINS_ROOT, "components", "plugin.json", { loggerCategory: "Components" });
  for (const plugin of allComponents) {
    const registered = registerPlugin({
      registry: components,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "component",
      source: plugin.container,
      loggerCategory: "Components",
    });
    if (registered) componentPluginPaths[plugin.name] = plugin.pluginPath;
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
    const pluginPath = componentPluginPaths[c] || null;
    for (const p in components[c].paths) {
      const resolved = resolvePluginPath(components[c].paths[p], pluginPath);
      componentModules[p] = p;
      componentConfigs += `import ${p} from '${resolved}'\n`;
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

function updateInteractions() {
  let interactions = {};
  const interactionPluginPaths = {};

  // 1. Discover all interaction plugins.
  const allInteractions = discoverPlugins(
    PLUGINS_ROOT,
    "interactions",
    "plugin.json",
    { loggerCategory: "Interactions" }
  );

  // 2. Build set of all enabled plugin IDs (tools + backend + components)
  //    for hard dependency checking.
  const enabledPluginIds = new Set();
  for (const type of ["tools", "backend", "components"]) {
    const plugins = discoverPlugins(PLUGINS_ROOT, type, "plugin.json", {
      loader: "parse",
      loggerCategory: "Interactions",
    });
    for (const p of plugins) {
      enabledPluginIds.add(`${p.container}/${type}/${p.name}`);
    }
  }

  // 3. Register each interaction, enforcing hard dependencies.
  for (const plugin of allInteractions) {
    // Hard dependency check — exclude interactions whose deps are missing.
    if (Array.isArray(plugin.manifest.pluginDependencies)) {
      const missing = plugin.manifest.pluginDependencies.filter(
        (dep) => !enabledPluginIds.has(dep)
      );
      if (missing.length > 0) {
        logger(
          "warn",
          `Interaction '${plugin.name}' skipped — missing dependencies: ${missing.join(", ")}`,
          "Interactions"
        );
        continue;
      }
    }

    const registered = registerPlugin({
      registry: interactions,
      name: plugin.name,
      config: plugin.manifest,
      pluginType: "interaction",
      source: plugin.container,
      loggerCategory: "Interactions",
    });
    if (registered) {
      interactionPluginPaths[plugin.name] = plugin.pluginPath;
    }
  }

  // 4. Write interactionConfigs.json for the Configure page.
  try {
    fs.writeFileSync(
      "./configure/public/interactionConfigs.json",
      JSON.stringify(interactions)
    );
    logger(
      "success",
      "Successfully updated interaction configurations.",
      "Interactions"
    );
  } catch (err) {
    logger(
      "error",
      "Failed to write interactionConfigs.json",
      "Interactions",
      null,
      err
    );
  }

  // 5. Generate src/pre/interactions.js with static imports.
  let output = "";
  const handlerEntries = [];

  for (const name in interactions) {
    const manifest = interactions[name];
    const pluginPath = interactionPluginPaths[name] || null;
    for (const p in manifest.paths) {
      const resolved = resolvePluginPath(manifest.paths[p], pluginPath);
      const safeName = `interaction_${name}_${p}`;
      output += `import ${safeName} from '${resolved}'\n`;
      handlerEntries.push({
        interactionId: manifest.interactionId,
        importName: safeName,
      });
    }
  }

  output += "\n";
  output += "export const interactionHandlers = {\n";
  for (const entry of handlerEntries) {
    output += `  '${entry.interactionId}': ${entry.importName},\n`;
  }
  output += "}\n\n";
  output += `export const interactionConfigs = ${JSON.stringify(
    interactions
  )}\n`;

  try {
    fs.writeFileSync("./src/pre/interactions.js", output);
    logger("success", "Successfully plugged-in interactions.", "Interactions");
  } catch (err) {
    logger(
      "error",
      "Failed to write src/pre/interactions.js",
      "Interactions",
      null,
      err
    );
  }

  // 6. Cross-type dependency check.
  checkPluginDependencies(PLUGINS_ROOT, "Interactions");
}

module.exports = { updateTools, updateComponents, updateInteractions };
