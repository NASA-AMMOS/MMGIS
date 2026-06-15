const fs = require("fs");
const path = require("path");

const logger = require("./logger");
const { discoverPluginsUnified } = require("./pluginDiscovery");

const PLUGINS_ROOT = path.join(__dirname, "..", "plugins");

/**
 * Discover and load all backend setup modules.
 *
 * Backend plugins live under `plugins/*/backend/<name>/setup.js`.
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
  let setups = {};

  // Single-pass scan of plugins/*/backend/
  const allBackends = discoverPluginsUnified(PLUGINS_ROOT, "backend", "setup.js", {
    loader: "require",
    loggerCategory: "Setups",
  });
  for (const plugin of allBackends) {
    const isOverride = setups[plugin.name] !== undefined;
    setups[plugin.name] = plugin.manifest;
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
