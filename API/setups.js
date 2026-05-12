const fs = require("fs");
const path = require("path");

const logger = require("./logger");
const { discoverPlugins } = require("./pluginDiscovery");

const STANDARD_BACKEND_PATTERN = ["__exact:Backend"];
const PLUGIN_BACKEND_PATTERNS = ["Private-Backend", "Plugin-Backend"];

/**
 * Discover and load all backend setup modules.
 *
 * Backend plugins live under:
 *   - API/Backend/<name>/setup.js (standard)
 *   - API/(...)Private-Backend(...)/<name>/setup.js (private plugins)
 *   - API/(...)Plugin-Backend(...)/<name>/setup.js (third-party plugins)
 *
 * Each `setup.js` is `require()`d at discovery time and may export
 * lifecycle callbacks (`onceInit`, `onceStarted`, `onceSynced`),
 * a `priority` number, and optional `envs`.
 *
 * @param {(handle: {init:Function,started:Function,synced:Function,envs:object}) => void} cb
 *   Callback invoked exactly once with a handle containing aggregated
 *   lifecycle dispatchers and merged `envs`.
 */
function getBackendSetups(cb) {
  const apiPath = path.join(__dirname);
  let setups = {};

  // 1. Standard backends — `API/Backend/<name>/setup.js`.
  const standardBackends = discoverPlugins(
    apiPath,
    STANDARD_BACKEND_PATTERN,
    "setup.js",
    { loader: "require", loggerCategory: "Setups" }
  );
  for (const plugin of standardBackends) {
    setups[plugin.name] = plugin.manifest;
  }

  // 2. Plugin/private backends — `API/*Plugin-Backend*` and `API/*Private-Backend*`.
  const pluginBackends = discoverPlugins(
    apiPath,
    PLUGIN_BACKEND_PATTERNS,
    "setup.js",
    { loader: "require", loggerCategory: "Setups" }
  );
  for (const plugin of pluginBackends) {
    const isOverride = setups[plugin.name] !== undefined;
    setups[plugin.name] = plugin.manifest;
    logger(
      "info",
      `Loaded backend setup: ${plugin.name} from ${plugin.container}${
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

  // 3. Sort by priority (preserves previous behavior).
  setups = Object.keys(setups)
    .sort(function (a, b) {
      return (setups[a].priority || 1000) - (setups[b].priority || 1000);
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
