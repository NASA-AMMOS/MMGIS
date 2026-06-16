/**
 * Shared plugin-discovery utility used by `API/updateTools.js`,
 * `API/setups.js`, and `scripts/resolve-plugin-deps.js`.
 *
 * MMGIS supports two discovery mechanisms:
 *
 * 1. `discoverPlugins()` — legacy two-level scan (container → plugin).
 *    Retained for backward compatibility during the transition.
 *
 * 2. `discoverPluginsUnified()` — three-level scan under `/plugins/`:
 *    `plugins/<repoDir>/<type>/<PluginName>/<configFile>`.
 *    This is the canonical mechanism going forward.
 */

const fs = require("fs");
const path = require("path");

const logger = require("./logger");

/**
 * Resolve plugin manifests under a base path.
 *
 * Directory layout (e.g. for tools):
 *
 *   <basePath>/
 *     My-Plugin-Tools/        ← container (matches one of `patterns`)
 *       FooTool/              ← plugin
 *         plugin.json         ← manifest (matches `configFile`)
 *       BarTool/
 *         plugin.json
 *     Other-Plugin-Tools/
 *       BazTool/
 *         plugin.json
 *
 * Subdirectories whose names start with `_` or `.` are skipped at every
 * level. Plugin subdirectories that don't contain the requested
 * manifest file are skipped silently. Containers that don't exist on
 * disk or aren't readable are skipped with a `warn` log line.
 *
 * @param {string} basePath  Directory in which to look for matching
 *   container directories.
 * @param {string[]} patterns  Substrings — a container directory name
 *   matches if it `.includes(p)` for any `p` in `patterns`. Pass `["*"]`
 *   (or any pattern that matches every name) to disable filtering.
 *   Alternatively, pass `["__exact:<name>"]` to require a name match
 *   exactly (useful for the standard `Tools` and `Components` dirs).
 * @param {string} [configFile="plugin.json"]  Manifest filename to
 *   require inside each plugin subdirectory. Pass `"setup.js"` for
 *   backend plugins.
 * @param {object} [opts]  Additional options.
 * @param {("parse"|"require"|"none")} [opts.loader="parse"]  How to
 *   load the manifest:
 *     - `"parse"`: read the file as UTF-8 and `JSON.parse()` it.
 *     - `"require"`: `require()` the file (used for `setup.js`).
 *     - `"none"`: don't load — just return the absolute path.
 * @param {string} [opts.loggerCategory="PluginDiscovery"]  Category
 *   passed to `logger()` for any warning/error messages.
 * @returns {Array<{name:string, container:string, pluginPath:string, manifestPath:string, manifest:any}>}
 *   An array of plugin records. Each record contains:
 *     - `name`: the plugin subdirectory name (e.g. `"FooTool"`).
 *     - `container`: the container directory name (e.g. `"My-Plugin-Tools"`).
 *     - `pluginPath`: absolute path to the plugin subdirectory.
 *     - `manifestPath`: absolute path to the manifest file.
 *     - `manifest`: parsed manifest contents (or `null` when
 *       `loader === "none"`).
 *
 *   The returned array preserves the order in which the filesystem
 *   yields containers and plugin subdirectories. Callers that care
 *   about deterministic ordering should sort the result.
 */
function discoverPlugins(basePath, patterns, configFile = "plugin.json", opts = {}) {
    const {
        loader = "parse",
        loggerCategory = "PluginDiscovery",
    } = opts;

    const out = [];

    if (!Array.isArray(patterns) || patterns.length === 0) {
        return out;
    }

    const exactNames = patterns
        .filter((p) => typeof p === "string" && p.startsWith("__exact:"))
        .map((p) => p.slice("__exact:".length));
    const substrings = patterns.filter(
        (p) => typeof p === "string" && !p.startsWith("__exact:") && p !== "*"
    );
    const matchAny = patterns.some((p) => p === "*");

    function nameMatches(name) {
        if (matchAny) return true;
        if (exactNames.includes(name)) return true;
        return substrings.some((s) => name.includes(s));
    }

    let containers = [];
    try {
        containers = fs.readdirSync(basePath, { withFileTypes: true });
    } catch (err) {
        logger(
            "warn",
            `Could not read plugin base directory: ${basePath}`,
            loggerCategory,
            null,
            err
        );
        return out;
    }

    for (const containerEntry of containers) {
        let isDir = false;
        try {
            isDir = containerEntry.isDirectory();
        } catch {
            continue;
        }
        if (!isDir) continue;
        if (containerEntry.name[0] === "_" || containerEntry.name[0] === ".") continue;
        if (!nameMatches(containerEntry.name)) continue;

        const containerPath = path.join(basePath, containerEntry.name);

        let pluginEntries = [];
        try {
            pluginEntries = fs.readdirSync(containerPath, {
                withFileTypes: true,
            });
        } catch (err) {
            logger(
                "warn",
                `Could not read plugin container: ${containerEntry.name}`,
                loggerCategory,
                null,
                err
            );
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

            const pluginPath = path.join(containerPath, pluginEntry.name);
            const manifestPath = path.join(pluginPath, configFile);

            if (!fs.existsSync(manifestPath)) {
                // Plugin directory without manifest is silently skipped
                // — matches existing MMGIS behavior.
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
                        `Failed to parse ${configFile} for plugin ${pluginEntry.name} in ${containerEntry.name}`,
                        loggerCategory,
                        null,
                        err
                    );
                    continue;
                }
            } else if (loader === "require") {
                try {
                    // Bust Node's require cache so repeated discovery in
                    // tests picks up fresh files.
                    delete require.cache[require.resolve(manifestPath)];
                    manifest = require(manifestPath);
                } catch (err) {
                    logger(
                        "error",
                        `Failed to require ${configFile} for plugin ${pluginEntry.name} in ${containerEntry.name}`,
                        loggerCategory,
                        null,
                        err
                    );
                    continue;
                }
            }

            out.push({
                name: pluginEntry.name,
                container: containerEntry.name,
                pluginPath,
                manifestPath,
                manifest,
            });
        }
    }

    return out;
}

/**
 * Unified three-level plugin discovery for the `/plugins/` directory.
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
 *   load the manifest (same semantics as `discoverPlugins`).
 * @param {string} [opts.loggerCategory="PluginDiscovery"]  Logger category.
 * @returns {Array<{name:string, container:string, pluginPath:string, manifestPath:string, manifest:any}>}
 */
function discoverPluginsUnified(pluginsRoot, type, configFile = "plugin.json", opts = {}) {
    const {
        loader = "parse",
        loggerCategory = "PluginDiscovery",
    } = opts;

    const out = [];

    // Load plugin-state.json for enable/disable tracking.
    // Core plugins are always enabled regardless of state.
    let pluginState = { plugins: {} };
    try {
        const statePath = path.join(pluginsRoot, "plugin-state.json");
        if (fs.existsSync(statePath)) {
            pluginState = JSON.parse(fs.readFileSync(statePath, "utf8"));
            if (!pluginState || typeof pluginState.plugins !== "object") {
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

            // Check plugin-state.json — skip disabled non-core plugins.
            if (repoEntry.name !== "core") {
                const stateKey = `${repoEntry.name}/${type}/${pluginEntry.name}`;
                const stateEntry = pluginState.plugins[stateKey];
                if (stateEntry && stateEntry.enabled === false) {
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

            const pluginPath = path.join(typePath, pluginEntry.name);
            const manifestPath = path.join(pluginPath, configFile);

            if (!fs.existsSync(manifestPath)) {
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

module.exports = { discoverPlugins, discoverPluginsUnified };
