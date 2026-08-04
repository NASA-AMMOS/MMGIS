const fs = require("fs");
const path = require("path");
const semver = require("semver");

const logger = require("./logger");
const {
  validatePluginConfig,
  findDuplicateInteractionIds,
  findDuplicateIds,
  validateLayerTypeInheritance,
  flattenLayerModules,
} = require("./pluginValidation");
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
  for (const type of ["tools", "backend", "components", "interactions"]) {
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

  const duplicateIds = findDuplicateInteractionIds(
    Object.entries(interactions).map(([name, manifest]) => ({
      name,
      interactionId: manifest.interactionId,
    }))
  );
  if (duplicateIds.length > 0) {
    const messages = duplicateIds.map(
      ({ interactionId, owners }) =>
        `Duplicate interactionId '${interactionId}' declared by: ${owners.join(", ")}`
    );
    messages.forEach((message) => logger("error", message, "Interactions"));
    throw new Error(messages.join("; "));
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

  // 5. Build phase arrays, suppression map, and kind pipelines from manifests.
  const phaseBuckets = {
    click: { preamble: [], postamble: [] },
    hover: { preamble: [], postamble: [] },
    mouseout: { preamble: [], postamble: [] },
  };
  const suppressionMap = {};
  // interactionId -> the layer types it declares itself applicable to. Only
  // interactions that declare a (non-empty) list appear; an absent entry means
  // "any layer type", so the runner needs no separate "declared?" flag.
  const applicableLayerTypes = {};
  const kindAliasEntries = []; // { kind, interactionId, order }

  for (const name in interactions) {
    const manifest = interactions[name];
    const id = manifest.interactionId;
    const phase = manifest.phase;
    const order = typeof manifest.order === "number" ? manifest.order : 0;
    const events = manifest.applicableEvents || [];

    if (phase === "preamble" || phase === "postamble") {
      for (const evt of events) {
        if (phaseBuckets[evt]) {
          phaseBuckets[evt][phase].push({ id, order });
        }
      }
    }

    if (Array.isArray(manifest.suppresses) && manifest.suppresses.length > 0) {
      suppressionMap[id] = manifest.suppresses;
    }

    if (
      Array.isArray(manifest.applicableLayerTypes) &&
      manifest.applicableLayerTypes.length > 0
    ) {
      applicableLayerTypes[id] = manifest.applicableLayerTypes;
    }

    if (Array.isArray(manifest.kindAlias)) {
      for (const kind of manifest.kindAlias) {
        kindAliasEntries.push({ kind, id, order });
      }
    }
  }

  // Sort each phase bucket by order.
  for (const evt of Object.keys(phaseBuckets)) {
    phaseBuckets[evt].preamble.sort((a, b) => a.order - b.order);
    phaseBuckets[evt].postamble.sort((a, b) => a.order - b.order);
  }

  // Build kind pipelines by grouping and sorting kindAlias entries.
  const kindPipelines = { none: [] };
  for (const entry of kindAliasEntries) {
    if (!kindPipelines[entry.kind]) kindPipelines[entry.kind] = [];
    kindPipelines[entry.kind].push({ id: entry.id, order: entry.order });
  }
  for (const kind of Object.keys(kindPipelines)) {
    kindPipelines[kind].sort((a, b) => a.order - b.order);
    kindPipelines[kind] = kindPipelines[kind].map((e) => e.id);
  }

  const clickPreamble = phaseBuckets.click.preamble.map((e) => e.id);
  const clickPostamble = phaseBuckets.click.postamble.map((e) => e.id);
  const hoverDefaults = phaseBuckets.hover.preamble.map((e) => e.id);
  const mouseoutDefaults = phaseBuckets.mouseout.preamble.map((e) => e.id);

  // 6. Generate src/pre/interactions.js with static imports and config.
  let output = "";
  const handlerEntries = [];

  for (const name in interactions) {
    const manifest = interactions[name];
    const pluginPath = interactionPluginPaths[name] || null;
    const pathKeys = Object.keys(manifest.paths);
    // Use first path entry — interactions are single-handler by design.
    const p = pathKeys[0];
    if (p) {
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
  output += `export const interactionConfigs = ${JSON.stringify(interactions)}\n\n`;
  output += `export const CLICK_PREAMBLE = ${JSON.stringify(clickPreamble)}\n`;
  output += `export const CLICK_POSTAMBLE = ${JSON.stringify(clickPostamble)}\n`;
  output += `export const HOVER_DEFAULTS = ${JSON.stringify(hoverDefaults)}\n`;
  output += `export const MOUSEOUT_DEFAULTS = ${JSON.stringify(mouseoutDefaults)}\n`;
  output += `export const SUPPRESSION_MAP = ${JSON.stringify(suppressionMap)}\n`;
  output += `export const KIND_PIPELINES = ${JSON.stringify(kindPipelines)}\n`;
  output += `export const APPLICABLE_LAYER_TYPES = ${JSON.stringify(
    applicableLayerTypes
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

  // 7. Cross-type dependency check.
  checkPluginDependencies(PLUGINS_ROOT, "Interactions");
}

/**
 * Turn an arbitrary string into a safe JS identifier fragment for use in
 * generated import statements.
 */
function safeIdent(s) {
  return String(s).replace(/[^A-Za-z0-9_$]/g, "_");
}

/**
 * Shared generator for the two renderer-plugin kinds (`layertype` and
 * `layerattachment`). Both declare their implementation by render surface —
 * a layertype's `modules` ({ map, config, filter, time, globe: { <engine> } })
 * or either kind's single `module` — plus an optional inline `config` object
 * describing the plugin's Configure-page form.
 *
 * Produces:
 *   - configure/public/<configureFile>  → { [id]: { manifest, config } }
 *   - src/pre/<preFile>                 → static imports + generated maps:
 *       export const <configsExport>  = { [id]: manifest }
 *       export const <modulesExport>  = { [id]: { map, globe: { <engine> }, … } }
 *
 * Everything is keyed by the plugin's stable id (`typeId`/`attachmentId`) so
 * runtime lookup by `layerObj.type` is a direct map access.
 */
function generateLayerRegistry({
  discoverType,
  pluginType,
  idField,
  preFile,
  configureFile,
  configsExport,
  modulesExport,
  loggerCategory,
}) {
  let registry = {};
  const pluginPaths = {};

  const discovered = discoverPlugins(PLUGINS_ROOT, discoverType, "plugin.json", {
    loggerCategory,
  });
  for (const plugin of discovered) {
    const registered = registerPlugin({
      registry,
      name: plugin.name,
      config: plugin.manifest,
      pluginType,
      source: plugin.container,
      loggerCategory,
    });
    if (registered) pluginPaths[plugin.name] = plugin.pluginPath;
  }

  // Enforce one owner per stable id — runtime resolves layerObj.type to
  // exactly one plugin, so collisions are fatal.
  const duplicates = findDuplicateIds(
    Object.entries(registry).map(([name, manifest]) => ({
      name,
      [idField]: manifest[idField],
    })),
    idField
  );
  if (duplicates.length > 0) {
    const messages = duplicates.map(
      ({ id, owners }) =>
        `Duplicate ${idField} '${id}' declared by: ${owners.join(", ")}`
    );
    messages.forEach((message) => logger("error", message, loggerCategory));
    throw new Error(messages.join("; "));
  }

  // Re-key by stable id (name → id) so both the Configure app and the runtime
  // registry look up by layerObj.type.
  const byId = {};
  const idToName = {};
  for (const name in registry) {
    const id = registry[name][idField];
    byId[id] = registry[name];
    idToName[id] = name;
  }

  // `extends` is resolved at runtime, so a dangling or chained parent would be
  // a silent no-op renderer; fail the build instead.
  if (pluginType === "layertype") {
    const inheritanceErrors = validateLayerTypeInheritance(byId);
    if (inheritanceErrors.length > 0) {
      inheritanceErrors.forEach((message) =>
        logger("error", message, loggerCategory)
      );
      throw new Error(inheritanceErrors.join("; "));
    }
  }

  // 1. Configure page JSON — surface each plugin's config so the separate React
  //    app can resolve layer forms by type without importing from the plugins
  //    directory.
  const configureOut = {};
  for (const id in byId) {
    const { config = null, ...manifest } = byId[id];
    configureOut[id] = { manifest, config };
  }
  try {
    fs.writeFileSync(
      `./configure/public/${configureFile}`,
      JSON.stringify(configureOut)
    );
    logger(
      "success",
      `Successfully updated ${loggerCategory} configurations.`,
      loggerCategory
    );
  } catch (err) {
    logger(
      "error",
      `Failed to write ${configureFile}`,
      loggerCategory,
      null,
      err
    );
  }

  // 2. src/pre generated module — static imports + registry maps.
  let out = "";
  const moduleEntries = {}; // id → { surfaceKey: importName }

  for (const id in byId) {
    const name = idToName[id];
    const pluginPath = pluginPaths[name] || null;
    moduleEntries[id] = {};

    const declared = flattenLayerModules(byId[id]);
    for (const key in declared) {
      const resolved = resolvePluginPath(declared[key], pluginPath);
      const importName = `ltp_${safeIdent(id)}__${safeIdent(key)}`;
      out += `import ${importName} from '${resolved}'\n`;
      moduleEntries[id][key] = importName;
    }
  }

  out += "\n";

  // Build the nested modules map. A path key like "globe.cesium" becomes a
  // nested { globe: { cesium: <import> } } entry.
  out += `export const ${modulesExport} = {\n`;
  for (const id in moduleEntries) {
    const nested = {};
    for (const key in moduleEntries[id]) {
      const importName = moduleEntries[id][key];
      const segments = key.split(".");
      let cursor = nested;
      for (let i = 0; i < segments.length - 1; i++) {
        cursor[segments[i]] = cursor[segments[i]] || {};
        cursor = cursor[segments[i]];
      }
      cursor[segments[segments.length - 1]] = importName;
    }
    // Stringify with import identifiers left unquoted.
    const body = JSON.stringify(nested).replace(
      /"(ltp_[A-Za-z0-9_$]+)"/g,
      "$1"
    );
    out += `  '${id}': ${body},\n`;
  }
  out += "}\n\n";

  // `config` only describes the Configure-page form, so it is served in the
  // Configure JSON above rather than shipped in the frontend bundle.
  const runtimeManifests = {};
  for (const id in byId) {
    const { config, ...manifest } = byId[id];
    void config;
    runtimeManifests[id] = manifest;
  }
  out += `export const ${configsExport} = ${JSON.stringify(
    runtimeManifests
  )}\n`;

  try {
    fs.writeFileSync(`./src/pre/${preFile}`, out);
    logger("success", `Successfully plugged-in ${loggerCategory}.`, loggerCategory);
  } catch (err) {
    logger(
      "error",
      `Failed to write src/pre/${preFile}`,
      loggerCategory,
      null,
      err
    );
  }

  checkPluginDependencies(PLUGINS_ROOT, loggerCategory);
}

function updateLayerTypes() {
  generateLayerRegistry({
    discoverType: "layertypes",
    pluginType: "layertype",
    idField: "typeId",
    preFile: "layertypes.js",
    configureFile: "layerTypeConfigs.json",
    configsExport: "layerTypeConfigs",
    modulesExport: "layerTypeModules",
    loggerCategory: "LayerTypes",
  });
}

function updateLayerAttachments() {
  generateLayerRegistry({
    discoverType: "layerattachments",
    pluginType: "layerattachment",
    idField: "attachmentId",
    preFile: "layerattachments.js",
    configureFile: "layerAttachmentConfigs.json",
    configsExport: "layerAttachmentConfigs",
    modulesExport: "layerAttachmentModules",
    loggerCategory: "LayerAttachments",
  });
}

module.exports = {
  updateTools,
  updateComponents,
  updateInteractions,
  updateLayerTypes,
  updateLayerAttachments,
};
