/**
 * Shared plugin-discovery utility used by `API/updateTools.js`,
 * `API/setups.js`, and `scripts/resolve-plugin-deps.js`.
 *
 * `discoverPlugins()` performs a three-level scan under `/plugins/`:
 * `plugins/<repoDir>/<type>/<PluginName>/<configFile>`.
 */

const fs = require("fs");
const path = require("path");

const logger = require("./logger");

/**
 * Three-level plugin discovery for the `/plugins/` directory.
 *
 * Directory layout:
 *
 *   <pluginsRoot>/
 *     core/               ← repo container (always scanned first)
 *       tools/            ← type subdirectory (matches `type` param)
 *         DrawTool/       ← plugin
 *           plugin.json   ← manifest (matches `configFile`)
 *     alice-spectral/     ← external repo container
 *       tools/
 *         SpectralTool/
 *           plugin.json
 *
 * Scan order: `core` is always first, then remaining containers in
 * alphabetical order. This ensures deterministic plugin ordering and
 * that external plugins can override core plugins (last scanned wins
 * at the caller level).
 *
 * @param {string} pluginsRoot  Absolute path to the `plugins/` directory.
 * @param {string} type  Plugin type subdirectory to look for inside each
 *   container (e.g. `"tools"`, `"backend"`, `"components"`).
 * @param {string} [configFile="plugin.json"]  Manifest filename.
 * @param {object} [opts]  Additional options.
 * @param {("parse"|"require"|"none")} [opts.loader="parse"]  How to
 *   load the manifest.
 * @param {string} [opts.loggerCategory="PluginDiscovery"]  Logger category.
 * @returns {Array<{name:string, container:string, pluginPath:string, manifestPath:string, manifest:any}>}
 */
function discoverPlugins(pluginsRoot, type, configFile = "plugin.json", opts = {}) {
    const {
        loader = "parse",
        loggerCategory = "PluginDiscovery",
    } = opts;

    const out = [];

    // Load plugin-state.json for enable/disable tracking.
    // Required plugins (required: true or overridable: false) are never skipped.
    let pluginState = { plugins: {} };
    try {
        const statePath = path.join(pluginsRoot, "plugin-state.json");
        if (fs.existsSync(statePath)) {
            pluginState = JSON.parse(fs.readFileSync(statePath, "utf8"));
            if (!pluginState || !pluginState.plugins || typeof pluginState.plugins !== "object") {
                pluginState = { plugins: {} };
            }
        }
    } catch {
        // Missing or invalid state file — treat all plugins as enabled.
    }

    let repoDirs = [];
    try {
        repoDirs = fs.readdirSync(pluginsRoot, { withFileTypes: true });
    } catch (err) {
        logger(
            "warn",
            `Could not read plugins root directory: ${pluginsRoot}`,
            loggerCategory,
            null,
            err
        );
        return out;
    }

    // Sort: `core` first, then alphabetical for deterministic order.
    const sorted = repoDirs
        .filter((d) => {
            try {
                return d.isDirectory() && d.name[0] !== "_" && d.name[0] !== ".";
            } catch {
                return false;
            }
        })
        .sort((a, b) => {
            if (a.name === "core") return -1;
            if (b.name === "core") return 1;
            return a.name.localeCompare(b.name);
        });

    for (const repoEntry of sorted) {
        const typePath = path.join(pluginsRoot, repoEntry.name, type);

        let pluginEntries = [];
        try {
            pluginEntries = fs.readdirSync(typePath, { withFileTypes: true });
        } catch {
            // Type subdirectory doesn't exist in this container — skip silently.
            continue;
        }

        for (const pluginEntry of pluginEntries) {
            let pIsDir = false;
            try {
                pIsDir = pluginEntry.isDirectory();
            } catch {
                continue;
            }
            if (!pIsDir) continue;
            if (pluginEntry.name[0] === "_" || pluginEntry.name[0] === ".") continue;

            const pluginPath = path.join(typePath, pluginEntry.name);
            const manifestPath = path.join(pluginPath, configFile);

            if (!fs.existsSync(manifestPath)) {
                // Warn about deprecated manifest formats.
                const deprecated = [
                    { file: "config.json", replacement: "plugin.json" },
                    { file: "setup.js",    replacement: "plugin.json + plugin.js" },
                ];
                for (const d of deprecated) {
                    if (fs.existsSync(path.join(pluginPath, d.file))) {
                        logger(
                            "warn",
                            `Plugin "${repoEntry.name}/${type}/${pluginEntry.name}" has a deprecated ${d.file}. ` +
                            `Please migrate to ${d.replacement}. See plugins/README.md for the migration guide.`,
                            loggerCategory,
                            null,
                            null
                        );
                    }
                }
                continue;
            }

            let manifest = null;
            if (loader === "parse") {
                try {
                    const raw = fs.readFileSync(manifestPath, "utf8");
                    manifest = JSON.parse(raw);
                } catch (err) {
                    logger(
                        "error",
                        `Failed to parse ${configFile} for plugin ${pluginEntry.name} in ${repoEntry.name}/${type}`,
                        loggerCategory,
                        null,
                        err
                    );
                    continue;
                }
            } else if (loader === "require") {
                try {
                    delete require.cache[require.resolve(manifestPath)];
                    manifest = require(manifestPath);
                } catch (err) {
                    logger(
                        "error",
                        `Failed to require ${configFile} for plugin ${pluginEntry.name} in ${repoEntry.name}/${type}`,
                        loggerCategory,
                        null,
                        err
                    );
                    continue;
                }
            }

            // Check plugin-state.json — skip disabled plugins.
            // Required plugins (required: true or overridable: false) cannot be disabled.
            const stateKey = `${repoEntry.name}/${type}/${pluginEntry.name}`;
            const stateEntry = pluginState.plugins[stateKey];
            if (stateEntry && stateEntry.enabled === false) {
                const isRequired = manifest &&
                    (manifest.required === true || manifest.overridable === false);
                if (!isRequired) {
                    logger(
                        "info",
                        `Skipping disabled plugin: ${stateKey}`,
                        loggerCategory,
                        null,
                        null
                    );
                    continue;
                }
            }

            out.push({
                name: pluginEntry.name,
                container: repoEntry.name,
                pluginPath,
                manifestPath,
                manifest,
            });
        }
    }

    return out;
}

/**
 * Cross-check pluginDependencies across all plugin types.
 *
 * Does a lightweight scan of tools, backend, and components, then warns
 * about any pluginDependency that references a plugin that is missing
 * or disabled.  Called at build time (updateTools) and server startup
 * (setups) so operators see problems before they hit 404s at runtime.
 *
 * @param {string} pluginsRoot  Absolute path to the `plugins/` directory.
 * @param {string} [loggerCategory="PluginDeps"]
 */
function checkPluginDependencies(pluginsRoot, loggerCategory = "PluginDeps") {
    // Discover all types with a lightweight parse-only scan.
    const allPlugins = [];
    for (const type of ["tools", "backend", "components"]) {
        const discovered = discoverPlugins(pluginsRoot, type, "plugin.json", {
            loader: "parse",
            loggerCategory,
        });
        for (const p of discovered) {
            allPlugins.push({
                id: `${p.container}/${type}/${p.name}`,
                name: p.name,
                type,
                manifest: p.manifest,
            });
        }
    }

    // Build set of enabled plugin IDs.
    const enabledIds = new Set(allPlugins.map((p) => p.id));

    // Check each plugin's pluginDependencies.
    let warningCount = 0;
    for (const p of allPlugins) {
        if (!p.manifest || !Array.isArray(p.manifest.pluginDependencies)) continue;
        for (const depId of p.manifest.pluginDependencies) {
            if (!enabledIds.has(depId)) {
                warningCount++;
                logger(
                    "warn",
                    `Plugin '${p.id}' depends on '${depId}' which is not enabled — ` +
                    `features requiring this dependency may not work correctly`,
                    loggerCategory,
                    null,
                    null
                );
            }
        }
    }
    return warningCount;
}

module.exports = { discoverPlugins, checkPluginDependencies };
