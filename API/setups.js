const fs = require("fs");
const path = require("path");
const semver = require("semver");

const logger = require("./logger");
const { discoverPlugins, checkPluginDependencies } = require("./pluginDiscovery");

const PLUGINS_ROOT = path.join(__dirname, "..", "plugins");
const MMGIS_VERSION = require("../package.json").version;

/**
 * Discover and load all backend lifecycle modules.
 *
 * Backend plugins live under plugins/{container}/backend/{name}/plugin.js.
 *
 * Each `plugin.js` is `require()`d at discovery time and may export
 * lifecycle callbacks (`onceInit`, `onceStarted`, `onceSynced`),
 * a `priority` number, and optional `envs`.
 *
 * @param {(handle: {init:Function,started:Function,synced:Function,envs:object}) => void} cb
 *   Callback invoked exactly once with a handle containing aggregated
 *   lifecycle dispatchers and merged `envs`.
 */
function getBackendSetups(cb) {
  let setups = {};
  const setupManifests = {};

  // Single-pass scan of plugins/*/backend/ — discover via plugin.json,
  // then require the sibling plugin.js for lifecycle hooks.
  const allBackends = discoverPlugins(PLUGINS_ROOT, "backend", "plugin.json", {
    loggerCategory: "Setups",
  });
  for (const plugin of allBackends) {
    const lifecyclePath = path.join(plugin.pluginPath, "plugin.js");
    let lifecycle;
    try {
      delete require.cache[require.resolve(lifecyclePath)];
      lifecycle = require(lifecyclePath);
    } catch (err) {
      logger(
        "error",
        `Failed to require plugin.js for backend ${plugin.name}`,
        "Setups",
        null,
        err
      );
      continue;
    }
    // Check engines.mmgis compatibility.
    if (plugin.manifest && plugin.manifest.engines && plugin.manifest.engines.mmgis) {
      const coercedVersion = semver.coerce(MMGIS_VERSION);
      if (coercedVersion && !semver.satisfies(coercedVersion, plugin.manifest.engines.mmgis)) {
        logger(
          "error",
          `Backend '${plugin.name}' requires MMGIS ${plugin.manifest.engines.mmgis} but current version is ${MMGIS_VERSION} — skipping`,
          "Setups"
        );
        continue;
      }
    }

    const isOverride = setups[plugin.name] !== undefined;

    // Enforce overridable: false — check the *already-registered* plugin's
    // manifest to see if it forbids being overridden.
    if (isOverride && setupManifests[plugin.name] && setupManifests[plugin.name].overridable === false) {
      logger(
        "error",
        `Backend '${plugin.name}' is marked overridable:false and cannot be overridden by ${plugin.container}`,
        "Setups"
      );
      continue;
    }

    setups[plugin.name] = lifecycle;
    setupManifests[plugin.name] = plugin.manifest;
    logger(
      "loaded",
      `Backend: ${plugin.name} from ${plugin.container}${
        isOverride ? " (overriding standard backend)" : ""
      }`,
      "Setups"
    );
    if (isOverride) {
      logger(
        "warn",
        `Backend '${plugin.name}' overridden by ${plugin.container}`,
        "Setups"
      );
    }
  }

  // 3. Sort by priority from plugin.json manifest (falls back to lifecycle module for compat).
  setups = Object.keys(setups)
    .sort(function (a, b) {
      const pa = (setupManifests[a] && setupManifests[a].priority) || setups[a].priority || 1000;
      const pb = (setupManifests[b] && setupManifests[b].priority) || setups[b].priority || 1000;
      return pa - pb;
    })
    .reduce((obj, key) => {
      obj[key] = setups[key];
      return obj;
    }, {});

  // 4. Aggregate envs across all setups.
  const envs = {};
  for (const f in setups) {
    if (setups[f].envs) {
      for (const e in setups[f].envs) {
        if (envs[setups[f].envs[e].name] == null) {
          envs[setups[f].envs[e].name] = setups[f].envs[e];
        } else {
          logger(
            "warning",
            "ENV variable name duplicated: " + setups[f].envs[e].name,
            "Setups"
          );
        }
      }
    }
  }

  // Check inter-plugin dependencies at startup.
  checkPluginDependencies(PLUGINS_ROOT, "Setups");

  cb({
    init: (s) => {
      for (const f in setups) {
        if (typeof setups[f].onceInit === "function") setups[f].onceInit(s);
      }
    },
    started: (s) => {
      for (const f in setups)
        if (typeof setups[f].onceStarted === "function")
          setups[f].onceStarted(s);
    },
    synced: (s) => {
      for (const f in setups)
        if (typeof setups[f].onceSynced === "function")
          setups[f].onceSynced(s);
    },
    envs: envs,
  });
}

module.exports = { getBackendSetups };
