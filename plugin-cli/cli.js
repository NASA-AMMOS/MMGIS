#!/usr/bin/env node

/**
 * MMGIS Plugin CLI
 *
 * Manages plugin installation, activation, and inspection.
 *
 * Usage:
 *   npm run plugins -- <command> [options]      (node plugin-cli/cli.js …)
 *
 * Commands:
 *   list                          List all plugins with status
 *   install <git-url|path|name>   Install a plugin repo (--only to filter)
 *   uninstall <repo-name>         Uninstall an installed plugin repo
 *   enable <plugin-id>            Enable a plugin
 *   disable <plugin-id>           Disable a plugin
 *   update [repo-name]            Pull latest for installed repo(s)
 *   create <type> <Name>          Scaffold a new plugin
 *   activate                      Regenerate frontend plugin imports
 *   validate                      Validate all active plugin manifests
 *   deps                          Show dependency graph and conflicts
 *   info <plugin-id>              Show detailed plugin info
 *   registry add <git-url>        Add a registry URL
 *   registry remove <name>        Remove a registry URL
 *   registry list                 List registered URLs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { scaffold } = require("./lib/scaffolds");

const REPO_ROOT = path.resolve(__dirname, "..");
const PLUGINS_ROOT = path.join(REPO_ROOT, "plugins");
// The CLI's own config lives with the CLI; plugin state lives with the plugins,
// since the server reads it at discovery time.
const REGISTRIES_PATH = path.join(__dirname, "registries.json");
const STATE_PATH = path.join(PLUGINS_ROOT, "plugin-state.json");
const CORE_CONTAINER = "core";
// Every plugin family: the type `create` and a manifest's `type` name → the
// directory a container holds it in. Layer types and attachments are families
// like any other; core's are just `overridable: false` and so undisableable.
const TYPE_DIRS = {
    tool: "tools",
    backend: "backend",
    component: "components",
    interaction: "interactions",
    layertype: "layertypes",
    layerattachment: "layerattachments",
};
const VALID_TYPES = Object.keys(TYPE_DIRS);
const PLUGIN_TYPE_DIRS = Object.values(TYPE_DIRS);
const PLUGIN_TYPE_SINGULAR = Object.fromEntries(
    Object.entries(TYPE_DIRS).map(([type, dir]) => [dir, type])
);

// ---------------------------------------------------------------------------
// CLI flags — parsed early so colour helpers can reference them.
// ---------------------------------------------------------------------------

const RAW_ARGS = process.argv.slice(2);
const FLAG_NO_COLOR = RAW_ARGS.includes("--no-color") || !!process.env.NO_COLOR;
const FLAG_JSON = RAW_ARGS.includes("--json");
const FLAG_LINK = RAW_ARGS.includes("--link");
const FLAG_FORCE = RAW_ARGS.includes("--force");
const FLAG_CONTAINER = (() => {
    const idx = RAW_ARGS.indexOf("--container");
    return idx !== -1 && idx + 1 < RAW_ARGS.length ? RAW_ARGS[idx + 1] : null;
})();
function flagValue(name) {
    const idx = RAW_ARGS.indexOf(name);
    return idx !== -1 && idx + 1 < RAW_ARGS.length ? RAW_ARGS[idx + 1] : null;
}
const FLAG_TIER = flagValue("--tier");
const FLAG_DESCRIPTION = flagValue("--description");
const FLAG_LICENSE = flagValue("--license");
const FLAG_AUTHOR = flagValue("--author");
const FLAG_ONLY = flagValue("--only");
const VALUE_FLAGS = ["--container", "--tier", "--description", "--license", "--author", "--only"];
// Strip flags so positional command parsing still works.
const args = RAW_ARGS.filter((a, i) =>
    a !== "--no-color" && a !== "--json" && a !== "--link" && a !== "--force" &&
    !VALUE_FLAGS.includes(a) && (i === 0 || !VALUE_FLAGS.includes(RAW_ARGS[i - 1]))
);

// ---------------------------------------------------------------------------
// ANSI colour helpers (zero deps)
// ---------------------------------------------------------------------------

const _esc = (code, text) => (FLAG_NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`);
const c = {
    bold:    (t) => _esc("1", t),
    dim:     (t) => _esc("2", t),
    red:     (t) => _esc("31", t),
    green:   (t) => _esc("32", t),
    yellow:  (t) => _esc("33", t),
    blue:    (t) => _esc("34", t),
    magenta: (t) => _esc("35", t),
    cyan:    (t) => _esc("36", t),
    white:   (t) => _esc("37", t),
    gray:    (t) => _esc("90", t),
};

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function getMMGISVersion() {
    try {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
        );
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

function resolveVersion(version) {
    if (version === "core") return `${getMMGISVersion()} ${c.dim("(core)")}`;
    return version;
}

// ---------------------------------------------------------------------------
// Step indicator for long-running operations
// ---------------------------------------------------------------------------

function step(current, total, msg) {
    const label = c.cyan(`[${current}/${total}]`);
    console.log(`  ${label} ${msg}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJSON(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return fallback;
    }
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + "\n", "utf8");
}

function loadRegistries() {
    return loadJSON(REGISTRIES_PATH, { registries: [] });
}

function saveRegistries(data) {
    saveJSON(REGISTRIES_PATH, data);
}

function loadState() {
    return loadJSON(STATE_PATH, { plugins: {} });
}

function saveState(data) {
    saveJSON(STATE_PATH, data);
}

/**
 * Recursively copy a directory. Works cross-platform (no shell deps).
 */
function cpDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            cpDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Derive a container directory name from a git URL.
 * For URLs with a recognizable org/owner segment (e.g. GitHub, GitLab),
 * returns "org--repo" so that repos with the same name under different
 * orgs don't clobber each other.  Falls back to just the repo basename
 * when the org can't be determined.
 *
 * Examples:
 *   https://github.com/NASA-AMMOS/MMGIS-Plugins.git → NASA-AMMOS--MMGIS-Plugins
 *   git@github.com:NASA-AMMOS/MMGIS-Plugins.git     → NASA-AMMOS--MMGIS-Plugins
 *   https://example.com/repo.git                     → repo
 */
function repoNameFromURL(url) {
    const cleaned = url.replace(/\.git$/, "");

    // Try SSH style: git@host:org/repo
    const sshMatch = cleaned.match(/:([^/]+)\/([^/]+)$/);
    if (sshMatch) return `${sshMatch[1]}--${sshMatch[2]}`;

    // Try HTTPS style: grab last two path segments as org/repo
    try {
        const parsed = new URL(cleaned);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (segments.length >= 2) {
            const org = segments[segments.length - 2];
            const repo = segments[segments.length - 1];
            return `${org}--${repo}`;
        }
        if (segments.length === 1) return segments[0];
    } catch { /* not a valid URL — fall through */ }

    // Fallback: basename
    const basename = path.basename(cleaned);
    return basename || url;
}

/**
 * Resolve a name (registry short name or container directory name) to the
 * actual on-disk container directory name.  Returns the input unchanged if
 * it already matches a directory, otherwise checks the registry for a
 * matching short name and derives the container name from its URL.
 */
function resolveContainerName(name) {
    if (fs.existsSync(path.join(PLUGINS_ROOT, name))) return name;
    const registries = loadRegistries();
    const match = registries.registries.find((r) => r.name === name);
    if (match && match.url) {
        const derived = repoNameFromURL(match.url);
        if (fs.existsSync(path.join(PLUGINS_ROOT, derived))) return derived;
    }
    return name; // fallback — caller decides what to do with a missing dir
}

/**
 * Build a plugin ID from container + type + name.
 * e.g. "core/tools/Draw" or "my-plugins/backend/CustomAPI"
 */
function pluginId(container, type, name) {
    return `${container}/${type}/${name}`;
}

/**
 * Parse tool/component names from the generated src/pre/ files.
 * Returns a Set of import identifiers (e.g. "DrawTool", "OperationsClock").
 */
function parsePreImports(filePath) {
    const names = new Set();
    try {
        const content = fs.readFileSync(filePath, "utf8");
        for (const line of content.split("\n")) {
            const m = line.match(/^import\s+(\S+)\s+from\s+/);
            if (m) names.add(m[1]);
        }
    } catch { /* file doesn't exist yet */ }
    return names;
}

/**
 * Re-generate src/pre/tools.js and src/pre/components.js so that newly
 * installed (or removed) frontend plugins are picked up by webpack without
 * requiring a full `npm run build`.
 *
 * Only prints the diff (added/removed) rather than the full list.
 */
function activate({ expectChanges = false, silent = false } = {}) {
    try {
        const repoRoot = path.resolve(__dirname, "..");
        const preFile = (f) => path.join(repoRoot, "src", "pre", f);
        const FRONTEND_PRE = {
            tool: preFile("tools.js"),
            component: preFile("components.js"),
            interaction: preFile("interactions.js"),
            layertype: preFile("layertypes.js"),
            layerattachment: preFile("layerattachments.js"),
        };

        const before = {};
        for (const [type, file] of Object.entries(FRONTEND_PRE))
            before[type] = parsePreImports(file);

        // Suppress logger console output during regeneration.
        const origWrite = process.stdout.write;
        const origLog = console.log;
        const origError = console.error;
        try {
            process.stdout.write = () => true;
            console.log = () => {};
            console.error = () => {};

            const {
                updateTools,
                updateComponents,
                updateInteractions,
                updateLayerTypes,
                updateLayerAttachments,
            } = require("../API/updateTools");
            updateTools();
            updateComponents();
            updateInteractions();
            updateLayerTypes();
            updateLayerAttachments();
        } finally {
            process.stdout.write = origWrite;
            console.log = origLog;
            console.error = origError;
        }

        // Compute diffs.
        const added = [];
        const removed = [];
        for (const [type, file] of Object.entries(FRONTEND_PRE)) {
            const after = parsePreImports(file);
            for (const name of after) {
                if (!before[type].has(name)) added.push({ name, type });
            }
            for (const name of before[type]) {
                if (!after.has(name)) removed.push({ name, type });
            }
        }

        if (!silent) {
            if (added.length === 0 && removed.length === 0) {
                const noChange = expectChanges
                    ? c.yellow("No changes detected.")
                    : c.dim("No changes.");
                console.log(`\n  ${c.green("Frontend plugins activated.")} ${noChange}`);
            } else {
                console.log(`\n  ${c.green("Frontend plugins activated.")}`);
                for (const a of added) {
                    console.log(`    ${c.green("+")} ${c.cyan(a.name)} ${c.dim(`(${a.type})`)}`);
                }
                for (const r of removed) {
                    console.log(`    ${c.red("-")} ${c.dim(r.name)} ${c.dim(`(${r.type})`)}`);
                }
            }
        }

        return { added, removed, error: null };
    } catch (err) {
        if (!silent) {
            console.error(`\n  ${c.red("Failed to activate frontend plugins:")} ${err.message}`);
            console.log(`  ${c.dim("You may need to run")} ${c.cyan("npm run build")} ${c.dim("instead.")}`);
        }
        return { added: [], removed: [], error: err.message };
    }
}

/**
 * Discover all plugins across all containers. Returns an array of objects
 * with { id, container, type, name, manifestPath, manifest, pluginPath }.
 */
function discoverAll() {
    const plugins = [];
    const TYPES = PLUGIN_TYPE_DIRS;

    let containers;
    try {
        containers = fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true });
    } catch {
        return plugins;
    }

    // Sort: core first, then alphabetical.
    const sorted = containers
        .filter((d) => {
            try {
                return d.isDirectory() && d.name[0] !== "_" && d.name[0] !== ".";
            } catch {
                return false;
            }
        })
        .sort((a, b) => {
            if (a.name === CORE_CONTAINER) return -1;
            if (b.name === CORE_CONTAINER) return 1;
            return a.name.localeCompare(b.name);
        });

    for (const containerEntry of sorted) {
        for (const type of TYPES) {
            const typePath = path.join(PLUGINS_ROOT, containerEntry.name, type);
            let entries;
            try {
                entries = fs.readdirSync(typePath, { withFileTypes: true });
            } catch {
                continue;
            }

            for (const entry of entries) {
                let isDir = false;
                try {
                    isDir = entry.isDirectory();
                } catch {
                    continue;
                }
                if (!isDir || entry.name[0] === "_" || entry.name[0] === ".") continue;

                const pluginPath = path.join(typePath, entry.name);
                const manifestPath = path.join(pluginPath, "plugin.json");
                let manifest = null;
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
                } catch {
                    // No plugin.json — check for deprecated formats and warn.
                    const deprecated = [
                        { file: "config.json", replacement: "plugin.json" },
                        { file: "setup.js",    replacement: "plugin.json + plugin.js" },
                    ];
                    for (const d of deprecated) {
                        if (fs.existsSync(path.join(pluginPath, d.file))) {
                            console.log(
                                `  ${c.yellow("Warning:")} Plugin "${containerEntry.name}/${type}/${entry.name}" ` +
                                `has a deprecated ${c.cyan(d.file)}. ` +
                                `Please migrate to ${c.cyan(d.replacement)}. ` +
                                `See ${c.cyan("plugins/README.md")} for the migration guide.`
                            );
                        }
                    }
                    continue;
                }

                plugins.push({
                    id: pluginId(containerEntry.name, type, entry.name),
                    container: containerEntry.name,
                    type,
                    name: entry.name,
                    pluginPath,
                    manifestPath,
                    manifest,
                });
            }
        }
    }

    return plugins;
}

/**
 * Get the effective enabled/disabled status for a plugin.
 * Required plugins (required: true or overridable: false) are always enabled.
 */
function isPluginEnabled(plugin, state) {
    const entry = state.plugins[plugin.id];
    // Default: enabled (new plugins are active unless explicitly disabled).
    if (entry === undefined) return true;
    if (entry.enabled === false) {
        // Required plugins cannot be disabled.
        if (plugin.manifest && (plugin.manifest.required === true || plugin.manifest.overridable === false)) {
            return true;
        }
        return false;
    }
    return true;
}

function isCore(plugin) {
    return plugin.container === CORE_CONTAINER;
}

function isRequired(plugin) {
    if (!plugin.manifest) return false;
    return plugin.manifest.required === true || plugin.manifest.overridable === false;
}

/**
 * Find a plugin by ID, name, or alias.
 * Returns the first match. If multiple plugins match a short name,
 * logs a warning (unless silent) and returns the first.
 */
function findPlugin(plugins, str, { silent = false } = {}) {
    if (!str) return null;
    // Exact ID match first.
    const byId = plugins.find((p) => p.id === str);
    if (byId) return byId;
    // Name match.
    const byName = plugins.filter((p) => p.name === str);
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) {
        if (!silent && !FLAG_JSON) {
            console.log(`  ${c.yellow("Warning:")} Multiple plugins named '${str}': ${byName.map((p) => p.id).join(", ")}`);
            console.log(`  ${c.dim("Using first match. Use the full plugin ID to be precise.")}`);
        }
        return byName[0];
    }
    // Alias match.
    for (const p of plugins) {
        if (p.manifest && Array.isArray(p.manifest.aliases) && p.manifest.aliases.includes(str)) {
            return p;
        }
    }
    return null;
}

/**
 * Find all enabled plugins that declare `pluginDependencies` containing
 * the given plugin ID.
 */
function findDependents(plugins, pluginId, state) {
    return plugins.filter((p) => {
        if (!isPluginEnabled(p, state)) return false;
        if (!p.manifest || !Array.isArray(p.manifest.pluginDependencies)) return false;
        return p.manifest.pluginDependencies.includes(pluginId);
    });
}

/**
 * Normalize directory-based type name to singular manifest form.
 * "tools" → "tool", "components" → "component", "backend" → "backend"
 */
function singularType(dirType, manifest) {
    if (manifest && manifest.type) return manifest.type;
    return PLUGIN_TYPE_SINGULAR[dirType] || dirType;
}

/**
 * Emit a JSON error and exit. Used to ensure --json always produces JSON,
 * even for error paths.
 */
function jsonError(message, exitCode = 1) {
    if (FLAG_JSON) {
        console.log(JSON.stringify({ error: message }));
        process.exit(exitCode);
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdList() {
    const plugins = discoverAll();
    const state = loadState();

    if (plugins.length === 0) {
        console.log(c.yellow("No plugins found."));
        return;
    }

    // --json: structured output
    if (FLAG_JSON) {
        const out = plugins.map((p) => ({
            id: p.id,
            name: p.name,
            type: singularType(p.type, p.manifest),
            container: p.container,
            enabled: isPluginEnabled(p, state),
            core: isCore(p),
            required: isRequired(p),
            version: (p.manifest && p.manifest.version) || null,
            tier: (p.manifest && p.manifest.tier) || null,
            author: (p.manifest && p.manifest.author) || null,
            description: (p.manifest && p.manifest.description) || null,
            path: p.pluginPath,
        }));
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    // Group by container → type → plugins.
    const groups = {};
    for (const p of plugins) {
        if (!groups[p.container]) groups[p.container] = {};
        if (!groups[p.container][p.type]) groups[p.container][p.type] = [];
        groups[p.container][p.type].push(p);
    }

    // Type display helpers — colour per type and friendly labels.
    const TYPE_LABELS = { tools: "Tools", backend: "Backend", components: "Components", interactions: "Interactions", layertypes: "Layer Types", layerattachments: "Layer Attachments" };
    const TYPE_COLOR = { tools: c.cyan, backend: c.yellow, components: c.green, interactions: c.magenta, layertypes: c.blue, layerattachments: c.blue };

    // Compute column widths for alignment (name only, since type is a header).
    let maxName = 0;
    let maxVer = 0;
    for (const p of plugins) {
        if (p.name.length > maxName) maxName = p.name.length;
        const ver = p.manifest && p.manifest.version ? `v${p.manifest.version === "core" ? getMMGISVersion() : p.manifest.version}` : "";
        if (ver.length > maxVer) maxVer = ver.length;
    }

    let enabledCount = 0;
    let disabledCount = 0;
    const TYPE_ORDER = PLUGIN_TYPE_DIRS;

    for (const [container, types] of Object.entries(groups)) {
        console.log(`\n  ${c.bold(c.white(container + "/"))}`);
        for (const type of TYPE_ORDER) {
            const items = types[type];
            if (!items || items.length === 0) continue;
            const colorFn = TYPE_COLOR[type] || c.white;
            const label = TYPE_LABELS[type] || type;
            console.log(`    ${colorFn(c.bold(label))}`);

            for (const p of items) {
                const enabled = isPluginEnabled(p, state);
                if (enabled) enabledCount++;
                else disabledCount++;

                const status = enabled ? c.green("✓") : c.red("✗");
                const paddedName = p.name.padEnd(maxName);
                const ver = p.manifest && p.manifest.version ? `v${p.manifest.version === "core" ? getMMGISVersion() : p.manifest.version}` : "";
                const verStr = ver ? c.yellow(ver.padEnd(maxVer)) : "".padEnd(maxVer);
                const tier = p.manifest && p.manifest.tier ? c.dim(`[${p.manifest.tier}]`) : "";
                const coreLabel = isCore(p) ? c.gray(" (core)") : "";

                console.log(`      ${status} ${colorFn(paddedName)}  ${verStr}  ${tier}${coreLabel}`);
            }
        }
    }

    // Summary bar
    const total = plugins.length;
    const summary = `${c.bold(String(total))} plugin(s)`;
    const en = c.green(`${enabledCount} enabled`);
    const dis = disabledCount > 0 ? `, ${c.red(`${disabledCount} disabled`)}` : "";
    const containers = Object.keys(groups).length;
    console.log(`\n  ${summary} (${en}${dis}) across ${c.cyan(String(containers))} container(s)\n`);
}

function cmdInstall(target) {
    if (!target) {
        jsonError("Usage: plugin-cli install <git-url|local-path|registry-name>");
        console.error(c.red("Usage: plugin-cli install <git-url|local-path|registry-name>"));
        process.exit(1);
    }

    // Resolve registry names — if target isn't a URL or existing path, look it up.
    const isURL = /^(https?:\/\/|git@|ssh:\/\/)/.test(target) || target.endsWith(".git");
    if (!isURL && !fs.existsSync(path.resolve(target))) {
        const registries = loadRegistries();
        const match = registries.registries.find((r) => r.name === target);
        if (match) {
            if (!FLAG_JSON) console.log(`  ${c.dim(`Resolved registry '${target}' → ${match.url}`)}`);
            target = match.url;
        }
    }

    const isGit = target.startsWith("http://") || target.startsWith("https://") ||
                  target.startsWith("git@") || target.endsWith(".git");

    const jsonResult = FLAG_JSON ? { command: "install", source: target, method: null, discovered: [], activated: null, warnings: [] } : null;

    if (isGit) {
        const repoName = repoNameFromURL(target);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
            if (FLAG_JSON) { console.log(JSON.stringify({ error: `Plugin repo '${repoName}' already exists` })); process.exit(1); }
            console.error(c.red(`Plugin repo '${repoName}' already exists at ${dest}`));
            console.error(c.yellow("Use 'update' to pull latest, or 'uninstall' first."));
            process.exit(1);
        }

        if (jsonResult) jsonResult.method = "git-clone";
        if (!FLAG_JSON) step(1, 3, `Cloning ${c.cyan(target)} → ${c.cyan(`plugins/${repoName}/`)}`);
        try {
            execSync(`git clone "${target}" "${dest}"`, { stdio: FLAG_JSON ? "pipe" : "inherit" });
        } catch (err) {
            if (FLAG_JSON) { console.log(JSON.stringify({ error: `Failed to clone: ${err.message}` })); process.exit(1); }
            console.error(c.red(`Failed to clone: ${err.message}`));
            process.exit(1);
        }

        // Auto-register in registries if not already present.
        if (!FLAG_JSON) step(2, 3, "Registering in plugin-cli/registries.json");
        const registries = loadRegistries();
        const existing = registries.registries.find((r) => r.url === target);
        if (!existing) {
            registries.registries.push({
                name: repoName,
                url: target,
                type: "git",
            });
            saveRegistries(registries);
        }

        // Discover what was installed and report.
        if (!FLAG_JSON) step(3, 3, "Discovering plugins");
        const plugins = discoverAll().filter((p) => p.container === repoName);
        if (FLAG_JSON) {
            jsonResult.discovered = plugins.map((p) => ({ id: p.id, type: singularType(p.type, p.manifest), name: p.name }));
        } else if (plugins.length > 0) {
            console.log(`\n  ${c.green(`Discovered ${plugins.length} plugin(s):`)}`)
            for (const p of plugins) {
                console.log(`    ${c.cyan(p.type + "/" + p.name)}`);
            }
        } else {
            console.log(`\n  ${c.red("Discovered 0 plugin(s).")}`);
            console.log(c.dim("  Ensure the repo has the structure: <repo>/{tools,backend,components,interactions}/<Name>/plugin.json"));
        }
    } else {
        // Local path — copy or symlink.
        const absPath = path.resolve(target);
        if (!fs.existsSync(absPath)) {
            jsonError(`Path not found: ${absPath}`);
            console.error(c.red(`Path not found: ${absPath}`));
            process.exit(1);
        }

        const repoName = path.basename(absPath);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
            jsonError(`Plugin directory '${repoName}' already exists at ${dest}`);
            console.error(c.red(`Plugin directory '${repoName}' already exists at ${dest}`));
            process.exit(1);
        }

        if (FLAG_LINK) {
            if (jsonResult) jsonResult.method = "symlink";
            if (!FLAG_JSON) step(1, 2, `Linking ${c.cyan(absPath)} → ${c.cyan(`plugins/${repoName}/`)}`);
            try {
                fs.symlinkSync(absPath, dest, "dir");
            } catch (err) {
                if (err.code === "EPERM") {
                    console.log(`    ${c.yellow("Symlink failed (EPERM), falling back to junction...")}`);
                    fs.symlinkSync(absPath, dest, "junction");
                } else {
                    throw err;
                }
            }
        } else {
            if (jsonResult) jsonResult.method = "copy";
            if (!FLAG_JSON) step(1, 2, `Copying ${c.cyan(absPath)} → ${c.cyan(`plugins/${repoName}/`)}`);
            cpDirSync(absPath, dest);
        }

        if (!FLAG_JSON) step(2, 2, "Discovering plugins");
        const plugins = discoverAll().filter((p) => p.container === repoName);
        if (FLAG_JSON) {
            jsonResult.discovered = plugins.map((p) => ({ id: p.id, type: singularType(p.type, p.manifest), name: p.name }));
        } else if (plugins.length === 0) {
            console.log(`  ${c.red(`Discovered ${plugins.length} plugin(s).`)}`);
        } else {
            console.log(`  ${c.green(`Discovered ${plugins.length} plugin(s).`)}`);
        }

        // Warn about flat repo structure (no tools/backend/components subdir).
        if (plugins.length === 0) {
            const hasTypeDir = PLUGIN_TYPE_DIRS.some((t) =>
                fs.existsSync(path.join(dest, t))
            );
            if (!hasTypeDir) {
                const legacyFiles = ["config.json", "setup.js", "plugin.json"];
                let foundLegacy = false;
                try {
                    for (const sub of fs.readdirSync(dest, { withFileTypes: true })) {
                        if (!sub.isDirectory() || sub.name[0] === "_" || sub.name[0] === ".") continue;
                        for (const f of legacyFiles) {
                            if (fs.existsSync(path.join(dest, sub.name, f))) {
                                foundLegacy = true;
                                break;
                            }
                        }
                        if (foundLegacy) break;
                    }
                } catch { /* ignore */ }

                if (foundLegacy) {
                    if (jsonResult) jsonResult.warnings.push("Repo has flat structure — no tools/backend/components/interactions subdirectory");
                    if (!FLAG_JSON) {
                        console.log(
                            `\n  ${c.yellow("Warning:")} This repo appears to have plugins directly under the root ` +
                            `without a ${c.cyan("tools/")}, ${c.cyan("backend/")}, ${c.cyan("components/")}, or ${c.cyan("interactions/")} subdirectory.\n` +
                            `  The plugin system expects: ${c.cyan("<repo>/tools/<PluginName>/plugin.json")}\n` +
                            `  See ${c.cyan("plugins/README.md")} for the expected directory structure.`
                        );
                    }
                }
            }
        }
    }

    // --only: disable all plugins in this container except the named ones.
    if (FLAG_ONLY) {
        const keepNames = FLAG_ONLY.split(",").map((n) => n.trim());
        const containerName = isGit ? repoNameFromURL(target) : path.basename(path.resolve(target));
        const allInContainer = discoverAll().filter((p) => p.container === containerName);
        const state = loadState();
        let disabledCount = 0;
        for (const p of allInContainer) {
            const shouldKeep = keepNames.some((k) => p.name === k || p.id === k || p.id.endsWith("/" + k));
            if (!shouldKeep) {
                state.plugins[p.id] = { enabled: false };
                disabledCount++;
            }
        }
        saveState(state);
        if (!FLAG_JSON && disabledCount > 0) {
            console.log(`\n  ${c.dim(`--only: disabled ${disabledCount} plugin(s), kept: ${keepNames.join(", ")}`)}`);
        }
        if (jsonResult) {
            jsonResult.only = keepNames;
            jsonResult.disabled = disabledCount;
        }
    }

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        jsonResult.activated = { added: act.added, removed: act.removed };
        if (act.error) jsonResult.warnings.push(act.error);
        console.log(JSON.stringify(jsonResult, null, 2));
    } else {
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Run")} ${c.cyan("npm run plugins:install")} ${c.dim("to install plugin dependencies.")}`);
        console.log(`  ${c.dim("Restart the server to activate backend plugins.")}\n`);
    }
}

function cmdUninstall(repoName) {
    if (!repoName) {
        jsonError("Usage: plugin-cli uninstall <repo-name>");
        console.error(c.red("Usage: plugin-cli uninstall <repo-name>"));
        process.exit(1);
    }

    // Resolve: accept either the on-disk container name or a registry short name.
    const containerName = resolveContainerName(repoName);
    const dest = path.join(PLUGINS_ROOT, containerName);

    if (containerName === CORE_CONTAINER) {
        jsonError("Cannot uninstall core plugins.");
        console.error(c.red("Cannot uninstall core plugins."));
        process.exit(1);
    }

    if (!fs.existsSync(dest)) {
        jsonError(`Plugin repo '${repoName}' not found.`);
        console.error(c.red(`Plugin repo '${repoName}' not found.`));
        process.exit(1);
    }

    if (!FLAG_JSON) step(1, 2, "Uninstalling from state file");
    const state = loadState();
    const keysToRemove = Object.keys(state.plugins).filter((k) => k.startsWith(containerName + "/"));
    for (const k of keysToRemove) {
        delete state.plugins[k];
    }
    saveState(state);

    if (!FLAG_JSON) step(2, 2, "Removing directory");
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
        fs.unlinkSync(dest);
    } else {
        fs.rmSync(dest, { recursive: true, force: true });
    }

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "uninstall", repo: containerName, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`\n  ${c.green(`Uninstalled plugin repo '${containerName}'.`)}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}\n`);
    }
}

function cmdEnable(pluginIdStr) {
    if (!pluginIdStr) {
        jsonError("Usage: plugin-cli enable <plugin-id>");
        console.error(c.red("Usage: plugin-cli enable <plugin-id>"));
        console.error(c.dim("Plugin IDs look like: my-plugins/tools/CustomTool"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = findPlugin(plugins, pluginIdStr);

    if (!match) {
        jsonError(`Plugin '${pluginIdStr}' not found.`);
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        console.error(c.dim("Run 'npm run plugins -- list' to see available plugins."));
        process.exit(1);
    }

    if (isRequired(match)) {
        if (FLAG_JSON) {
            console.log(JSON.stringify({ command: "enable", plugin: match.id, noop: true, reason: "required" }));
            return;
        }
        console.log(c.yellow(`Plugin '${match.id}' is a required plugin and is always enabled.`));
        return;
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: true };
    saveState(state);

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "enable", plugin: match.id, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`  ${c.green("✓")} Enabled: ${c.cyan(match.id)}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
    }
}

function cmdDisable(pluginIdStr) {
    if (!pluginIdStr) {
        jsonError("Usage: plugin-cli disable <plugin-id>");
        console.error(c.red("Usage: plugin-cli disable <plugin-id>"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = findPlugin(plugins, pluginIdStr);

    if (!match) {
        jsonError(`Plugin '${pluginIdStr}' not found.`);
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        process.exit(1);
    }

    if (isCore(match)) {
        jsonError(`Cannot disable core plugin '${match.id}'.`);
        console.error(c.red(`Cannot disable core plugin '${match.id}'.`));
        process.exit(1);
    }

    if (isRequired(match)) {
        jsonError(`Cannot disable required plugin '${match.id}'.`);
        console.error(c.red(`Cannot disable required plugin '${match.id}'.`));
        process.exit(1);
    }

    // Warn if other enabled plugins depend on this one.
    const state = loadState();
    const dependents = findDependents(plugins, match.id, state);

    state.plugins[match.id] = { enabled: false };
    saveState(state);

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        const result = { command: "disable", plugin: match.id, activated: { added: act.added, removed: act.removed } };
        if (dependents.length > 0) result.warnings = [`The following enabled plugins depend on '${match.id}': ${dependents.map((d) => d.id).join(", ")}`];
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`  ${c.red("✗")} Disabled: ${c.cyan(match.id)}`);
        if (dependents.length > 0) {
            console.log(`  ${c.yellow("Warning:")} The following enabled plugins depend on '${match.id}':`);
            for (const dep of dependents) {
                console.log(`    ${c.dim("→")} ${c.cyan(dep.id)}`);
            }
            console.log(`  ${c.dim("Those plugins may not work correctly until this plugin is re-enabled.")}`);
        }
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
    }
}

function cmdEnableAll() {
    const plugins = discoverAll();
    const container = FLAG_CONTAINER;

    if (container === CORE_CONTAINER) {
        const msg = "Core plugins are always enabled and cannot be bulk-managed.";
        jsonError(msg);
        console.error(c.red(msg));
        process.exit(1);
    }

    const targets = container
        ? plugins.filter((p) => p.container === container)
        : plugins.filter((p) => p.container !== CORE_CONTAINER);

    if (targets.length === 0) {
        const msg = container ? `No plugins found in container '${container}'.` : "No external plugins found.";
        jsonError(msg);
        console.error(c.red(msg));
        process.exit(1);
    }

    const state = loadState();
    let count = 0;
    for (const p of targets) {
        if (!isRequired(p)) {
            state.plugins[p.id] = { enabled: true };
            count++;
        }
    }
    saveState(state);

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "enable-all", container: container || "all-external", enabled: count, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`  ${c.green("✓")} Enabled ${count} plugin(s)${container ? ` in ${c.cyan(container)}` : ""}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
    }
}

function cmdDisableAll() {
    const plugins = discoverAll();
    const container = FLAG_CONTAINER;

    if (container === CORE_CONTAINER) {
        const msg = "Cannot disable core plugins. Core plugins are protected.";
        jsonError(msg);
        console.error(c.red(msg));
        process.exit(1);
    }

    const targets = container
        ? plugins.filter((p) => p.container === container)
        : plugins.filter((p) => p.container !== CORE_CONTAINER);

    if (targets.length === 0) {
        const msg = container ? `No plugins found in container '${container}'.` : "No external plugins found.";
        jsonError(msg);
        console.error(c.red(msg));
        process.exit(1);
    }

    const state = loadState();
    let count = 0;
    let skippedRequired = 0;
    for (const p of targets) {
        if (isRequired(p)) {
            skippedRequired++;
        } else {
            state.plugins[p.id] = { enabled: false };
            count++;
        }
    }
    saveState(state);

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "disable-all", container: container || "all-external", disabled: count, skippedRequired, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`  ${c.red("✗")} Disabled ${count} plugin(s)${container ? ` in ${c.cyan(container)}` : ""}`);
        if (skippedRequired > 0) console.log(`  ${c.dim(`(${skippedRequired} required plugin(s) skipped)`)}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
    }
}

function cmdUpdate(repoName) {
    const registries = loadRegistries();

    if (repoName) {
        const resolved = resolveContainerName(repoName);
        const dest = path.join(PLUGINS_ROOT, resolved);
        if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
            console.error(c.red(`'${repoName}' is not a git-based plugin repo.`));
            process.exit(1);
        }
        if (resolved === CORE_CONTAINER) {
            console.error(c.yellow("Core plugins are updated with the main MMGIS repo."));
            process.exit(1);
        }
        if (!FLAG_JSON) step(1, 1, `Pulling latest for ${c.cyan(repoName)}`);
        try {
            execSync("git pull", { cwd: dest, stdio: FLAG_JSON ? "pipe" : "inherit" });
            if (!FLAG_JSON) console.log(`  ${c.green("Done.")}`);
        } catch (err) {
            if (FLAG_JSON) { console.log(JSON.stringify({ error: `Failed to update ${repoName}: ${err.message}` })); process.exit(1); }
            console.error(c.red(`Failed to update ${repoName}: ${err.message}`));
            process.exit(1);
        }
    } else {
        const repos = registries.registries;
        if (repos.length === 0) {
            if (FLAG_JSON) { console.log(JSON.stringify({ command: "update", updated: 0, repos: [] })); return; }
            console.log(c.yellow("No registered plugin repos to update."));
            return;
        }
        let updated = 0;
        const updatedRepos = [];
        for (let i = 0; i < repos.length; i++) {
            const reg = repos[i];
            const containerDir = resolveContainerName(reg.name);
            const dest = path.join(PLUGINS_ROOT, containerDir);
            if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
                if (!FLAG_JSON) step(i + 1, repos.length, `Skipping ${c.dim(reg.name)} (not a git repo on disk)`);
                continue;
            }
            if (!FLAG_JSON) step(i + 1, repos.length, `Pulling latest for ${c.cyan(reg.name)}`);
            try {
                execSync("git pull", { cwd: dest, stdio: FLAG_JSON ? "pipe" : "inherit" });
                updated++;
                updatedRepos.push(reg.name);
            } catch (err) {
                if (!FLAG_JSON) console.error(`    ${c.red("Failed:")} ${err.message}`);
            }
        }
        if (!FLAG_JSON) console.log(`\n  ${c.green(`Updated ${updated} repo(s).`)}`);
    }

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "update", repo: repoName || "all", activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Run")} ${c.cyan("npm run plugins:install")} ${c.dim("if dependencies changed.")}`);
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}\n`);
    }
}

function cmdValidate() {
    const {
        validatePluginConfig,
        validateDependencies,
        findDuplicateInteractionIds,
    } = require(path.join(__dirname, "..", "API", "pluginValidation"));

    const plugins = discoverAll();
    const state = loadState();
    const results = [];
    let errors = 0;
    let warnings = 0;
    let passed = 0;

    if (!FLAG_JSON) console.log("");
    for (const p of plugins) {
        const enabled = isPluginEnabled(p, state);
        const prefix = p.id;
        const pluginErrors = [];

        if (!p.manifest) {
            pluginErrors.push("missing or invalid plugin.json");
            if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red("missing or invalid plugin.json")}`);
            errors++;
            results.push({ plugin: prefix, valid: false, enabled, errors: pluginErrors });
            continue;
        }

        const validationType = PLUGIN_TYPE_SINGULAR[p.type] || p.type;

        const errs = validatePluginConfig(p.manifest, p.name, validationType);
        if (errs.length > 0) {
            for (const e of errs) {
                pluginErrors.push(e);
                if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(e)}`);
            }
            errors += errs.length;
        }

        if (p.manifest.dependencies) {
            const depErrs = validateDependencies(p.manifest.dependencies, p.name);
            for (const e of depErrs) {
                pluginErrors.push(e);
                if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(e)}`);
            }
            errors += depErrs.length;
        }

        if (!enabled) {
            if (!FLAG_JSON) console.log(`  ${c.yellow("⚠")} ${c.cyan(prefix)}: ${c.yellow("disabled")}`);
            warnings++;
        } else if (errs.length === 0) {
            passed++;
        }

        results.push({ plugin: prefix, valid: pluginErrors.length === 0, enabled, errors: pluginErrors });
    }

    // Check inter-plugin dependencies.
    const pluginIds = new Set(plugins.map((p) => p.id));
    const enabledIds = new Set(plugins.filter((p) => isPluginEnabled(p, state)).map((p) => p.id));
    let depWarnings = 0;
    const depWarningMessages = [];
    for (const p of plugins) {
        if (!p.manifest || !Array.isArray(p.manifest.pluginDependencies)) continue;
        if (!isPluginEnabled(p, state)) continue;
        for (const depId of p.manifest.pluginDependencies) {
            if (!pluginIds.has(depId)) {
                depWarnings++;
                const msg = `${p.id} depends on '${depId}' which was not found`;
                depWarningMessages.push(msg);
                if (!FLAG_JSON) console.log(`  ${c.yellow("⚠")} ${c.cyan(p.id)}: depends on ${c.red(depId)} ${c.yellow("(not found)")}`);
            } else if (!enabledIds.has(depId)) {
                depWarnings++;
                const msg = `${p.id} depends on '${depId}' which is disabled`;
                depWarningMessages.push(msg);
                if (!FLAG_JSON) console.log(`  ${c.yellow("⚠")} ${c.cyan(p.id)}: depends on ${c.red(depId)} ${c.yellow("(disabled)")}`);
            }
        }
    }

    // Interaction-specific validation: unique IDs, order collisions, and suppression targets.
    const interactionPlugins = plugins.filter((p) => p.type === "interactions" && p.manifest && isPluginEnabled(p, state));
    const interactionIds = new Set(interactionPlugins.map((p) => p.manifest.interactionId).filter(Boolean));
    let interactionErrors = 0;
    const interactionErrorMessages = [];
    let interactionWarnings = 0;
    const interactionWarningMessages = [];

    const duplicateIds = findDuplicateInteractionIds(
        interactionPlugins.map((p) => ({
            name: p.id,
            interactionId: p.manifest.interactionId,
        }))
    );
    for (const { interactionId, owners } of duplicateIds) {
        interactionErrors++;
        errors++;
        const msg = `Duplicate interactionId '${interactionId}' declared by: ${owners.join(", ")}`;
        interactionErrorMessages.push(msg);
        if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.red(msg)}`);
        for (const owner of owners) {
            const result = results.find((entry) => entry.plugin === owner);
            if (result && result.valid) {
                result.valid = false;
                result.errors.push(msg);
                passed--;
            }
        }
    }

    // Check for order collisions within the same (phase, event) bucket.
    const phaseBuckets = {};
    for (const p of interactionPlugins) {
        const m = p.manifest;
        if (!m.phase || m.phase === "main" || m.order === undefined) continue;
        const events = Array.isArray(m.applicableEvents) ? m.applicableEvents : ["click"];
        for (const evt of events) {
            const key = `${m.phase}:${evt}`;
            if (!phaseBuckets[key]) phaseBuckets[key] = [];
            phaseBuckets[key].push({ id: p.id, interactionId: m.interactionId, order: m.order });
        }
    }
    for (const [bucket, entries] of Object.entries(phaseBuckets)) {
        const orderMap = {};
        for (const e of entries) {
            if (!orderMap[e.order]) orderMap[e.order] = [];
            orderMap[e.order].push(e.interactionId || e.id);
        }
        for (const [order, ids] of Object.entries(orderMap)) {
            if (ids.length > 1) {
                interactionWarnings++;
                const msg = `Order collision in ${bucket}: interactions ${ids.join(", ")} share order ${order}`;
                interactionWarningMessages.push(msg);
                if (!FLAG_JSON) console.log(`  ${c.yellow("⚠")} ${c.yellow("Order collision")} in ${c.cyan(bucket)}: ${ids.map((i) => c.magenta(i)).join(", ")} share order ${c.yellow(order)}`);
            }
        }
    }

    // Check suppression targets exist.
    for (const p of interactionPlugins) {
        if (!Array.isArray(p.manifest.suppresses)) continue;
        for (const target of p.manifest.suppresses) {
            if (!interactionIds.has(target)) {
                interactionWarnings++;
                const msg = `${p.id} suppresses '${target}' which is not a registered interaction`;
                interactionWarningMessages.push(msg);
                if (!FLAG_JSON) console.log(`  ${c.yellow("⚠")} ${c.cyan(p.id)}: suppresses ${c.red(target)} ${c.yellow("(not found)")}`);
            }
        }
    }

    // Layer-type / layer-attachment renderer contract validation: on top of the
    // manifest check every family gets above, each declared module's
    // `export default {}` operation shape is checked against its surface.
    const {
        validateLayerTypeModuleShape,
        surfaceOfModuleKey,
        flattenLayerModules,
        validateLayerTypeInheritance,
    } = require(
        path.join(__dirname, "..", "API", "pluginValidation")
    );
    const rendererPlugins = plugins.filter(
        (p) =>
            p.manifest &&
            (p.type === "layertypes" || p.type === "layerattachments")
    );

    for (const p of rendererPlugins) {
        const prefix = p.id;
        const pType = PLUGIN_TYPE_SINGULAR[p.type];
        const pluginErrors = [];

        // Validate each declared renderer module's operation shape.
        for (const [key, rel] of Object.entries(flattenLayerModules(p.manifest))) {
            if (typeof rel !== "string") continue;
            const surface = surfaceOfModuleKey(key, pType, p.manifest);
            const modPath = path.join(p.pluginPath, `${rel}.js`);
            let src;
            try {
                src = fs.readFileSync(modPath, "utf8");
            } catch {
                pluginErrors.push(`renderer module '${key}' not found at ${rel}.js`);
                if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(`renderer module '${key}' not found at ${rel}.js`)}`);
                errors++;
                continue;
            }
            // A single-module layer type exports surfaces, not operations,
            // so there is no op vocabulary to check it against.
            if (surface == null) continue;
            const modErrs = validateLayerTypeModuleShape(src, `${prefix} [${key}]`, surface);
            for (const e of modErrs) {
                pluginErrors.push(e);
                if (!FLAG_JSON) console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(e)}`);
            }
            errors += modErrs.length;
        }

        if (pluginErrors.length > 0) {
            const result = results.find((entry) => entry.plugin === prefix);
            if (result && result.valid) {
                result.valid = false;
                passed--;
            }
            if (result) result.errors.push(...pluginErrors);
        }
    }
    // `extends` is cross-plugin, so it can only be checked once every manifest
    // is in hand.
    const layerTypesById = {};
    for (const p of rendererPlugins) {
        if (p.type === "layertypes" && p.manifest.typeId)
            layerTypesById[p.manifest.typeId] = p.manifest;
    }
    for (const e of validateLayerTypeInheritance(layerTypesById)) {
        if (!FLAG_JSON) console.error(`  ${c.red("\u2717")} ${c.red(e)}`);
        errors++;
    }

    const totalPlugins = plugins.length;

    if (FLAG_JSON) {
        console.log(JSON.stringify({ valid: errors === 0, total: totalPlugins, passed, errors, warnings, depWarnings, depWarningMessages, interactionErrors, interactionErrorMessages, interactionWarnings, interactionWarningMessages, results }, null, 2));
        if (errors > 0) process.exit(1);
        return;
    }

    if (errors === 0) {
        console.log(`\n  ${c.green("\u2713")} All ${c.bold(String(totalPlugins))} plugin(s) valid.`);
        if (warnings > 0) console.log(`  ${c.yellow(String(warnings))} disabled plugin(s).`);
        if (depWarnings > 0) console.log(`  ${c.yellow(String(depWarnings))} plugin dependency warning(s).`);
        if (interactionWarnings > 0) console.log(`  ${c.yellow(String(interactionWarnings))} interaction warning(s).`);
    } else {
        console.error(`\n  ${c.red(`${errors} error(s)`)} across ${c.bold(String(totalPlugins))} plugin(s). ${c.green(`${passed} passed`)}.`);
        process.exit(1);
    }
    console.log("");
}

function cmdDeps() {
    const { mergeNpm, mergePython, checkPeerDependencies } = require(
        path.join(__dirname, "..", "scripts", "resolve-plugin-deps")
    );

    const plugins = discoverAll();
    const state = loadState();

    // Filter to enabled plugins only.
    const active = plugins.filter((p) => isPluginEnabled(p, state));

    // Build sources for mergeNpm / mergePython.
    const sources = active
        .filter((p) => p.manifest && p.manifest.dependencies)
        .map((p) => ({
            plugin: `${p.type}:${p.name}`,
            deps: p.manifest.dependencies,
        }));

    const { merged: npmMerged, conflicts: npmConflicts } = mergeNpm(sources);
    const npmKeys = Object.keys(npmMerged);
    const { merged: pipMerged, conflicts: pipConflicts } = mergePython(sources, "pip");
    const { merged: condaMerged, conflicts: condaConflicts } = mergePython(sources, "conda");
    const peerWarnings = checkPeerDependencies(active);

    // Build inter-plugin dependency graph.
    const pluginDepGraph = [];
    const pluginDepWarnings = [];
    for (const p of active) {
        if (p.manifest && Array.isArray(p.manifest.pluginDependencies) && p.manifest.pluginDependencies.length > 0) {
            pluginDepGraph.push({ plugin: p.id, dependsOn: p.manifest.pluginDependencies });
            for (const depId of p.manifest.pluginDependencies) {
                const depPlugin = plugins.find((pp) => pp.id === depId);
                if (!depPlugin) {
                    pluginDepWarnings.push(`${p.id} depends on '${depId}' which was not found`);
                } else if (!isPluginEnabled(depPlugin, state)) {
                    pluginDepWarnings.push(`${p.id} depends on '${depId}' which is disabled`);
                }
            }
        }
    }

    if (FLAG_JSON) {
        console.log(JSON.stringify({
            npm: { merged: npmMerged, conflicts: npmConflicts },
            pip: { merged: pipMerged, conflicts: pipConflicts },
            conda: { merged: condaMerged, conflicts: condaConflicts },
            peerWarnings,
            pluginDependencies: { graph: pluginDepGraph, warnings: pluginDepWarnings },
        }, null, 2));
        return;
    }

    console.log(`\n  ${c.bold(c.white("npm dependencies:"))}`);
    if (npmKeys.length === 0) {
        console.log(`    ${c.dim("(none)")}`);
    } else {
        for (const [pkg, ver] of Object.entries(npmMerged)) {
            console.log(`    ${c.cyan(pkg)}: ${c.yellow(ver)}`);
        }
    }

    if (npmConflicts.length > 0) {
        console.log(`\n  ${c.yellow("⚠ npm conflicts:")}`);
        for (const cf of npmConflicts) {
            console.log(`    ${c.red(cf.package)}:`);
            for (const claim of cf.claims) {
                console.log(`      ${c.dim(claim.plugin)}: ${c.yellow(claim.version)}`);
            }
        }
    }

    // Python deps — pip.
    if (pipMerged.length > 0) {
        console.log(`\n  ${c.bold(c.white("pip dependencies:"))}`);
        for (const dep of pipMerged) {
            console.log(`    ${c.cyan(dep)}`);
        }
    }

    if (pipConflicts.length > 0) {
        console.log(`\n  ${c.yellow("⚠ pip conflicts:")}`);
        for (const cf of pipConflicts) {
            console.log(`    ${c.red(cf.package)}:`);
            for (const claim of cf.claims) {
                console.log(`      ${c.dim(claim.plugin)}: ${c.yellow(claim.entry)}`);
            }
        }
    }

    // Python deps — conda.
    if (condaMerged.length > 0) {
        console.log(`\n  ${c.bold(c.white("conda dependencies:"))}`);
        for (const dep of condaMerged) {
            console.log(`    ${c.cyan(dep)}`);
        }
    }

    if (condaConflicts.length > 0) {
        console.log(`\n  ${c.yellow("⚠ conda conflicts:")}`);
        for (const cf of condaConflicts) {
            console.log(`    ${c.red(cf.package)}:`);
            for (const claim of cf.claims) {
                console.log(`      ${c.dim(claim.plugin)}: ${c.yellow(claim.entry)}`);
            }
        }
    }

    // Peer dependencies.
    if (peerWarnings.length > 0) {
        console.log(`\n  ${c.yellow("⚠ peerDependency warnings:")}`);
        for (const w of peerWarnings) {
            console.log(`    ${c.yellow(w)}`);
        }
    }

    // Inter-plugin dependencies.
    if (pluginDepGraph.length > 0) {
        console.log(`\n  ${c.bold(c.white("Plugin dependencies:"))}`);
        for (const entry of pluginDepGraph) {
            console.log(`    ${c.cyan(entry.plugin)} ${c.dim("→")} ${entry.dependsOn.map((d) => c.yellow(d)).join(", ")}`);
        }
    }
    if (pluginDepWarnings.length > 0) {
        console.log(`\n  ${c.yellow("⚠ plugin dependency warnings:")}`);
        for (const w of pluginDepWarnings) {
            console.log(`    ${c.yellow(w)}`);
        }
    }

    const totalConflicts = npmConflicts.length + pipConflicts.length + condaConflicts.length;
    const conflictStr = totalConflicts > 0 ? c.red(`${totalConflicts} conflict(s)`) : c.green("0 conflicts");
    const peerStr = peerWarnings.length > 0 ? c.yellow(`${peerWarnings.length} peer warning(s)`) : c.green("0 peer warnings");
    console.log(`\n  ${c.bold(String(npmKeys.length))} npm, ${c.bold(String(pipMerged.length))} pip, ${c.bold(String(condaMerged.length))} conda dep(s). ${conflictStr}. ${peerStr}.\n`);
}

function cmdInfo(pluginIdStr) {
    if (!pluginIdStr) {
        jsonError("Usage: plugin-cli info <plugin-id>");
        console.error(c.red("Usage: plugin-cli info <plugin-id>"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const state = loadState();
    const match = findPlugin(plugins, pluginIdStr);

    if (!match) {
        jsonError(`Plugin '${pluginIdStr}' not found.`);
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        process.exit(1);
    }

    // --json: structured output
    if (FLAG_JSON) {
        const m = match.manifest || {};
        const out = {
            id: match.id, name: match.name, type: singularType(match.type, match.manifest),
            container: match.container,
            enabled: isPluginEnabled(match, state),
            core: isCore(match),
            required: isRequired(match),
            manifest: m,
            path: match.pluginPath,
        };
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    const enabled = isPluginEnabled(match, state);
    const m = match.manifest || {};

    console.log(`\n  ${c.bold("Plugin:")} ${c.cyan(match.id)}`);
    console.log(`  ${c.dim("─────────────────────────────")}`);
    console.log(`  ${c.dim("Name:")}        ${m.name || match.name}`);
    if (m.display_name) console.log(`  ${c.dim("Display:")}     ${m.display_name}`);
    const displayType = m.type || (match.type === "tools" ? "tool" : match.type === "components" ? "component" : match.type);
    console.log(`  ${c.dim("Type:")}        ${c.yellow(displayType)}`);
    console.log(`  ${c.dim("Container:")}   ${match.container}`);
    const statusStr = enabled
        ? c.green("enabled") + (isRequired(match) ? c.gray(" (required — cannot be disabled)") : "")
        : c.red("disabled");
    console.log(`  ${c.dim("Status:")}      ${statusStr}`);
    if (m.version) console.log(`  ${c.dim("Version:")}     ${c.yellow(resolveVersion(m.version))}`);
    if (m.author) console.log(`  ${c.dim("Author:")}      ${typeof m.author === "object" ? m.author.name || JSON.stringify(m.author) : m.author}`);
    if (m.license) console.log(`  ${c.dim("License:")}     ${m.license}`);
    if (m.repository) console.log(`  ${c.dim("Repository:")}  ${c.cyan(m.repository)}`);
    if (m.tier) console.log(`  ${c.dim("Tier:")}        ${m.tier}`);
    if (m.id) console.log(`  ${c.dim("Manifest ID:")} ${m.id}`);
    if (m.uuid) console.log(`  ${c.dim("UUID:")}        ${m.uuid}`);
    if (m.overridable !== undefined) console.log(`  ${c.dim("Overridable:")} ${m.overridable ? c.green("yes") : c.red("no")}`);
    if (m.interactionId) console.log(`  ${c.dim("Hook ID:")}     ${c.magenta(m.interactionId)}`);
    if (m.phase) console.log(`  ${c.dim("Phase:")}       ${c.magenta(m.phase)}${m.order !== undefined ? c.dim(` (order: ${m.order})`) : ""}`);
    if (m.suppresses && m.suppresses.length > 0) console.log(`  ${c.dim("Suppresses:")}  ${m.suppresses.map((s) => c.red(s)).join(", ")}`);
    if (m.kindAlias && m.kindAlias.length > 0) console.log(`  ${c.dim("Kind Alias:")}  ${m.kindAlias.map((k) => c.cyan(k)).join(", ")}`);
    if (m.applicableEvents && m.applicableEvents.length > 0) console.log(`  ${c.dim("Events:")}      ${m.applicableEvents.join(", ")}`);
    if (m.applicableLayerTypes && m.applicableLayerTypes.length > 0) console.log(`  ${c.dim("Layer Types:")} ${m.applicableLayerTypes.join(", ")}`);
    if (m.description) console.log(`  ${c.dim("Description:")} ${m.description}`);
    if (m.keywords && m.keywords.length > 0) console.log(`  ${c.dim("Keywords:")}    ${m.keywords.map((k) => c.cyan(k)).join(", ")}`);
    if (m.engines) console.log(`  ${c.dim("Engines:")}     ${JSON.stringify(m.engines)}`);
    if (m.aliases && m.aliases.length > 0) console.log(`  ${c.dim("Aliases:")}     ${m.aliases.join(", ")}`);
    if (m.pluginDependencies && m.pluginDependencies.length > 0) {
        console.log(`  ${c.dim("Depends on:")}`);
        for (const dep of m.pluginDependencies) {
            console.log(`    ${c.dim("\u2192")} ${c.cyan(dep)}`);
        }
    }
    const revDeps = plugins.filter((p) =>
        p.manifest && Array.isArray(p.manifest.pluginDependencies) && p.manifest.pluginDependencies.includes(match.id)
    );
    if (revDeps.length > 0) {
        console.log(`  ${c.dim("Depended on by:")}`);
        for (const dep of revDeps) {
            console.log(`    ${c.dim("\u2190")} ${c.cyan(dep.id)}`);
        }
    }
    if (m.peerDependencies) {
        console.log(`  ${c.dim("Peer Deps:")}`);
        for (const [peer, range] of Object.entries(m.peerDependencies)) {
            console.log(`    ${c.cyan(peer)}: ${c.yellow(range)}`);
        }
    }
    if (m.dependencies) {
        if (m.dependencies.npm) {
            console.log(`  ${c.dim("npm Deps:")}`);
            for (const [pkg, ver] of Object.entries(m.dependencies.npm)) {
                console.log(`    ${c.cyan(pkg)}: ${c.yellow(ver)}`);
            }
        }
        if (m.dependencies.python) {
            if (m.dependencies.python.pip) {
                console.log(`  ${c.dim("pip Deps:")}    ${m.dependencies.python.pip.join(", ")}`);
            }
            if (m.dependencies.python.conda) {
                console.log(`  ${c.dim("conda Deps:")}  ${m.dependencies.python.conda.join(", ")}`);
            }
        }
    }
    console.log(`  ${c.dim("Path:")}        ${c.dim(match.pluginPath)}`);
    console.log("");
}

function cmdRegistry(subcommand, arg) {
    const registries = loadRegistries();

    if (subcommand === "add") {
        if (!arg) {
            jsonError("Usage: plugin-cli registry add <git-url|local-path>");
            console.error(c.red("Usage: plugin-cli registry add <git-url|local-path>"));
            process.exit(1);
        }

        // Determine type and validate.
        const isURL = /^(https?:\/\/|git@|ssh:\/\/)/.test(arg);
        let type = "git";
        if (!isURL) {
            // Treat as local path — resolve and verify it exists.
            const resolved = path.resolve(arg);
            if (!fs.existsSync(resolved)) {
                jsonError(`Path not found: ${resolved}`);
                console.error(c.red(`Path not found: ${resolved}`));
                process.exit(1);
            }
            try {
                if (!fs.statSync(resolved).isDirectory()) {
                    jsonError(`Not a directory: ${resolved}`);
                    console.error(c.red(`Not a directory: ${resolved}`));
                    process.exit(1);
                }
            } catch {
                jsonError(`Cannot access: ${resolved}`);
                console.error(c.red(`Cannot access: ${resolved}`));
                process.exit(1);
            }
            type = "local";
        }

        const name = repoNameFromURL(arg);
        const existing = registries.registries.find((r) => r.url === arg || r.name === name);
        if (existing) {
            if (FLAG_JSON) {
                console.log(JSON.stringify({ command: "registry", action: "add", noop: true, reason: "already_registered", name }));
                return;
            }
            console.log(c.yellow(`Registry '${name}' already registered.`));
            return;
        }
        const entry = { name, url: arg, type };
        if (FLAG_TIER) entry.tier = FLAG_TIER;
        if (FLAG_DESCRIPTION) entry.description = FLAG_DESCRIPTION;
        if (FLAG_LICENSE) entry.license = FLAG_LICENSE;
        if (FLAG_AUTHOR) entry.author = FLAG_AUTHOR;
        registries.registries.push(entry);
        saveRegistries(registries);
        if (FLAG_JSON) {
            console.log(JSON.stringify({ command: "registry", action: "add", ...entry }));
        } else {
            let line = `  ${c.green("✓")} Added registry: ${c.cyan(name)} ${c.dim(`(${arg})`)} ${c.dim(`[${type}]`)}`;
            if (entry.tier) line += ` ${c.dim(`tier=${entry.tier}`)}`;
            if (entry.description) line += `\n    ${c.dim(entry.description)}`;
            console.log(line);
        }
    } else if (subcommand === "remove") {
        if (!arg) {
            jsonError("Usage: plugin-cli registry remove <name>");
            console.error(c.red("Usage: plugin-cli registry remove <name>"));
            process.exit(1);
        }
        const before = registries.registries.length;
        registries.registries = registries.registries.filter(
            (r) => r.name !== arg && r.url !== arg
        );
        if (registries.registries.length === before) {
            jsonError(`Registry '${arg}' not found.`);
            console.error(c.red(`Registry '${arg}' not found.`));
            process.exit(1);
        }
        saveRegistries(registries);
        if (FLAG_JSON) {
            console.log(JSON.stringify({ command: "registry", action: "remove", name: arg }));
        } else {
            console.log(`  ${c.green("✓")} Removed registry: ${c.cyan(arg)}`);
        }
    } else if (subcommand === "list" || !subcommand) {
        if (FLAG_JSON) {
            console.log(JSON.stringify({ command: "registry", action: "list", registries: registries.registries }));
            return;
        }
        if (registries.registries.length === 0) {
            console.log(c.yellow("No registries configured."));
            return;
        }
        console.log(`\n  ${c.bold(c.white("Registered plugin sources:"))}`);
        for (const r of registries.registries) {
            let line = `    ${c.cyan(r.name)}: ${c.white(r.url)} ${c.dim(`[${r.type}]`)}`;
            if (r.tier) line += ` ${c.dim(`(${r.tier})`)}`;
            console.log(line);
            if (r.description) console.log(`      ${c.dim(r.description)}`);
            const meta = [r.author, r.license].filter(Boolean).join(" · ");
            if (meta) console.log(`      ${c.dim(meta)}`);
        }
        console.log("");
    } else {
        jsonError(`Unknown registry subcommand: ${subcommand}`);
        console.error(c.red(`Unknown registry subcommand: ${subcommand}`));
        console.error(c.dim("Available: add, remove, list"));
        process.exit(1);
    }
}

function cmdCreate(type, name) {
    const typeDir = TYPE_DIRS[type] || type;

    if (!type || !VALID_TYPES.includes(type)) {
        jsonError(`Invalid type. Usage: plugin-cli create <${VALID_TYPES.join("|")}> <Name> --container <container>`);
        console.error(c.red(`Usage: plugin-cli create <${VALID_TYPES.join("|")}> <Name> --container <container>`));
        process.exit(1);
    }
    if (!name) {
        jsonError(`Missing plugin name. Usage: plugin-cli create ${type} <Name> --container <container>`);
        console.error(c.red("Missing plugin name."));
        console.error(c.dim(`Usage: plugin-cli create ${type} <Name> --container <container>`));
        process.exit(1);
    }
    if (!FLAG_CONTAINER) {
        jsonError(`Missing --container flag. Usage: plugin-cli create ${type} ${name} --container <container>`);
        console.error(c.red("Missing --container flag."));
        console.error(c.dim(`Usage: plugin-cli create ${type} ${name} --container <container>`));
        process.exit(1);
    }

    if (FLAG_CONTAINER === CORE_CONTAINER && !FLAG_FORCE) {
        jsonError("Cannot create plugins in the core container without --force.");
        console.error(c.red("Cannot create plugins in the core container without --force."));
        console.error(c.dim("Core plugins are maintained as part of the main MMGIS repository."));
        process.exit(1);
    }

    const container = FLAG_CONTAINER;
    const pluginDir = path.join(PLUGINS_ROOT, container, typeDir, name);

    if (fs.existsSync(pluginDir)) {
        jsonError(`Plugin already exists: ${container}/${typeDir}/${name}`);
        console.error(c.red(`Plugin already exists: ${pluginDir}`));
        process.exit(1);
    }

    // Ensure container directory exists.
    const containerDir = path.join(PLUGINS_ROOT, container);
    if (!fs.existsSync(containerDir)) {
        fs.mkdirSync(containerDir, { recursive: true });
        if (!FLAG_JSON) console.log(`  ${c.green("✓")} Created container: ${c.cyan(container + "/")}`);
    }

    const files = scaffold(type, name);

    // Write all files.
    const created = [];
    for (const [relPath, content] of Object.entries(files)) {
        const fullPath = path.join(pluginDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf8");
        created.push(relPath);
    }

    if (FLAG_JSON) {
        let activated = null;
        if (type !== "backend") {
            activated = activate({ expectChanges: true, silent: true });
        }
        console.log(JSON.stringify({
            command: "create", type, name,
            container, path: `${container}/${typeDir}/${name}`,
            files: created,
            activated: activated ? { added: activated.added, removed: activated.removed } : null,
        }, null, 2));
        return;
    }

    console.log(`\n  ${c.green("Created")} ${c.cyan(`${container}/${typeDir}/${name}`)}:`);
    for (const f of created) {
        console.log(`    ${c.dim("+")} ${f}`);
    }

    // Auto-activate for frontend plugins (everything but backend, which the
    // server discovers at startup rather than through a generated registry).
    if (type !== "backend") {
        activate({ expectChanges: true });
    }

    console.log(`\n  ${c.dim("Next steps:")}`);
    if (type === "tool") {
        console.log(`    ${c.dim("1.")} Edit ${c.cyan(`${name}Tool.js`)} to build your tool UI`);
        console.log(`    ${c.dim("2.")} Configure variables in ${c.cyan("plugin.json")} under ${c.cyan('"config"')}`);
    } else if (type === "backend") {
        console.log(`    ${c.dim("1.")} Edit ${c.cyan(`routes/${name[0].toLowerCase() + name.slice(1)}.js`)} to add your API routes`);
        console.log(`    ${c.dim("2.")} Edit ${c.cyan("plugin.js")} to configure middleware and lifecycle hooks`);
        console.log(`    ${c.dim("3.")} Restart the server to load the backend`);
    } else if (type === "interaction") {
        console.log(`    ${c.dim("1.")} Edit ${c.cyan(`${name}.js`)} to implement the ${c.cyan("use(ctx)")} handler`);
        console.log(`    ${c.dim("2.")} Set ${c.cyan("interactionId")}, ${c.cyan("phase")}, and ${c.cyan("order")} in ${c.cyan("plugin.json")}`);
        console.log(`    ${c.dim("3.")} Run ${c.cyan("npm run build")} to regenerate interactions`);
    } else if (type === "layertype") {
        console.log(`    ${c.dim("1.")} Implement ${c.cyan("make")}/${c.cyan("destroy")} in ${c.cyan("map.js")} (for the globe, add ${c.cyan("globe/<engine>.js")} and declare it under ${c.cyan('"modules": {"globe": …}')} in ${c.cyan("plugin.json")} — see ${c.cyan("plugins/core/layertypes/README.md")})`);
        console.log(`    ${c.dim("2.")} Fill in ${c.cyan("supportedData")}, ${c.cyan("color")}/${c.cyan("defaultIcon")}, and the ${c.cyan("config")} fields in ${c.cyan("plugin.json")}`);
        console.log(`    ${c.dim("3.")} Re-run ${c.cyan("npm run plugins -- activate")} after changing ${c.cyan("modules")} to regenerate the layer registries`);
        console.log(`    ${c.dim("4.")} Run ${c.cyan("npm run plugins -- validate")} to check the contract`);
    } else if (type === "layerattachment") {
        const lower = name[0].toLowerCase() + name.slice(1);
        console.log(`    ${c.dim("1.")} Implement ${c.cyan("make")} in ${c.cyan(`${lower}.js`)} (add the other operations only where a core default is wrong)`);
        console.log(`    ${c.dim("2.")} Set ${c.cyan("configPath")}, ${c.cyan("applicableLayerTypes")} and ${c.cyan("capabilities.host.order")} in ${c.cyan("plugin.json")}, and the ${c.cyan("config")} rows that write under that path`);
        console.log(`    ${c.dim("3.")} Re-run ${c.cyan("npm run plugins -- activate")} after changing ${c.cyan("module")} to regenerate the layer registries`);
        console.log(`    ${c.dim("4.")} Run ${c.cyan("npm run plugins -- validate")} to check the contract`);
    } else {
        console.log(`    ${c.dim("1.")} Edit ${c.cyan(`${name}.js`)} to build your component`);
        console.log(`    ${c.dim("2.")} Configure variables in ${c.cyan("plugin.json")} under ${c.cyan('"config"')}`);
    }
    console.log("");
}

function cmdDestroy(pluginIdStr) {
    if (!pluginIdStr) {
        jsonError("Usage: plugin-cli destroy <plugin-id> [--force]");
        console.error(c.red("Usage: plugin-cli destroy <plugin-id> [--force]"));
        console.error(c.dim("Plugin IDs look like: my-plugins/tools/CustomTool"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = findPlugin(plugins, pluginIdStr);

    if (!match) {
        jsonError(`Plugin '${pluginIdStr}' not found.`);
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        console.error(c.dim("Run 'npm run plugins -- list' to see available plugins."));
        process.exit(1);
    }

    if (isCore(match)) {
        jsonError(`Cannot destroy core plugin '${match.id}'.`);
        console.error(c.red(`Cannot destroy core plugin '${match.id}'.`));
        process.exit(1);
    }

    if (isRequired(match)) {
        jsonError(`Cannot destroy required plugin '${match.id}' (required: true or overridable: false).`);
        console.error(c.red(`Cannot destroy required plugin '${match.id}' (required: true or overridable: false).`));
        process.exit(1);
    }

    if (!FLAG_FORCE && !FLAG_JSON) {
        const readline = require("readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`  ${c.yellow("Are you sure you want to destroy")} ${c.cyan(match.id)}${c.yellow("?")} ${c.dim("[y/N]")} `, (answer) => {
            rl.close();
            if (answer.trim().toLowerCase() !== "y" && answer.trim().toLowerCase() !== "yes") {
                console.log(c.dim("  Aborted."));
                process.exit(0);
            }
            _performDestroy(match);
        });
    } else {
        _performDestroy(match);
    }
}

function _performDestroy(match) {
    const pluginDir = match.pluginPath;

    // Remove from state file.
    const state = loadState();
    if (state.plugins[match.id]) {
        delete state.plugins[match.id];
        saveState(state);
    }

    // Delete the plugin directory.
    fs.rmSync(pluginDir, { recursive: true, force: true });

    // Check if the container type directory is now empty and clean up.
    const typeDir = path.dirname(pluginDir);
    try {
        const remaining = fs.readdirSync(typeDir).filter((f) => f[0] !== "." && f[0] !== "_");
        if (remaining.length === 0) {
            fs.rmSync(typeDir, { recursive: true, force: true });
            // Check if the container itself is now empty.
            const containerDir = path.dirname(typeDir);
            const containerRemaining = fs.readdirSync(containerDir).filter((f) => f[0] !== "." && f[0] !== "_");
            if (containerRemaining.length === 0) {
                fs.rmSync(containerDir, { recursive: true, force: true });
            }
        }
    } catch { /* ignore cleanup errors */ }

    if (FLAG_JSON) {
        const isFrontend = match.type !== "backend";
        let activated = null;
        if (isFrontend) {
            activated = activate({ expectChanges: true, silent: true });
        }
        console.log(JSON.stringify({
            command: "destroy", plugin: match.id,
            activated: activated ? { added: activated.added, removed: activated.removed } : null,
        }, null, 2));
    } else {
        console.log(`\n  ${c.green("Destroyed:")} ${c.cyan(match.id)}`);
        const isFrontend = match.type !== "backend";
        if (isFrontend) {
            activate({ expectChanges: true });
            console.log(`  ${c.yellow("Note:")} If webpack-dev-server is running, restart it to clear its module cache.`);
        } else {
            console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
        }
        console.log("");
    }
}

function cmdHelp() {
    const h = (cmd, desc) => `    ${c.cyan(cmd.padEnd(30))} ${c.dim(desc)}`;
    console.log(`
  ${c.bold(c.white("MMGIS Plugin CLI"))} ${c.dim(`v${getMMGISVersion()}`)}

  ${c.dim("Usage:")} npm run plugins -- ${c.cyan("<command>")} [options]
         node plugin-cli/cli.js ${c.cyan("<command>")} [options]

  ${c.bold(c.white("Commands:"))}
${h("list", "List all plugins with status")}
${h("install <git-url|path|name>", "Install a plugin repo (git clone, copy, or registry name)")}
${h("uninstall <repo-name>", "Uninstall an installed plugin repo (not core)")}
${h("enable <plugin-id>", "Enable a disabled plugin")}
${h("disable <plugin-id>", "Disable a plugin (not core)")}
${h("enable-all", "Enable all plugins (use --container to scope)")}
${h("disable-all", "Disable all non-required plugins (use --container to scope)")}
${h("update [repo-name]", "Pull latest for repo(s)")}
${h("create <type> <Name>", `Scaffold a new plugin (${VALID_TYPES.join(", ")})`)}
${h("destroy <plugin-id>", "Delete a plugin (prompts for confirmation, --force to skip)")}
${h("activate", "Regenerate frontend plugin imports (no full build needed)")}
${h("validate", "Validate all plugin manifests")}
${h("deps", "Show dependency graph and conflicts")}
${h("info <plugin-id>", "Show detailed plugin info")}
${h("registry add <git-url>", "Add a registry URL")}
${h("registry remove <name>", "Remove a registry URL")}
${h("registry list", "List registered URLs")}
${h("help", "Show this help")}

  ${c.bold(c.white("Flags:"))}
    ${c.cyan("--no-color".padEnd(30))} ${c.dim("Disable colored output (also respects NO_COLOR env)")}
    ${c.cyan("--json".padEnd(30))} ${c.dim("Output machine-readable JSON (all commands)")}
    ${c.cyan("--link".padEnd(30))} ${c.dim("Symlink local paths instead of copy (falls back to junction on Windows)")}
    ${c.cyan("--container <name>".padEnd(30))} ${c.dim("Target container (create, enable-all, disable-all)")}
    ${c.cyan("--force".padEnd(30))} ${c.dim("Allow core scaffolding; skip confirmation prompts (destroy)")}
    ${c.cyan("--tier <tier>".padEnd(30))} ${c.dim("Set tier when adding a registry (core, official, community, private, experimental, deprecated)")}
    ${c.cyan("--description <text>".padEnd(30))} ${c.dim("Set description when adding a registry")}
    ${c.cyan("--license <spdx>".padEnd(30))} ${c.dim("Set license when adding a registry (e.g. Apache-2.0)")}
    ${c.cyan("--author <name>".padEnd(30))} ${c.dim("Set author when adding a registry")}
    ${c.cyan("--only <names>".padEnd(30))} ${c.dim("Comma-separated plugin names to keep enabled (install)")}

  ${c.bold(c.white("Plugin IDs:"))}
    ${c.dim("<container>/<type>/<name>")}     e.g. ${c.cyan("core/tools/Draw")}
    ${c.dim("<name>")}                        Short form (matches first found)

  ${c.bold(c.white("Examples:"))}
    ${c.dim("$")} npm run plugins -- list
    ${c.dim("$")} npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git
    ${c.dim("$")} npm run plugins -- install mmgis-geo-plugins --only ToolX,ToolY
    ${c.dim("$")} npm run plugins -- disable-all --container my-plugins
    ${c.dim("$")} npm run plugins -- enable my-plugins/tools/SpectralTool
    ${c.dim("$")} npm run plugins -- info Draw
    ${c.dim("$")} npm run plugins -- list --json
    ${c.dim("$")} npm run plugins -- create tool SpectralAnalysis --container my-plugins
    ${c.dim("$")} npm run plugins -- create backend DataIngest --container my-plugins
    ${c.dim("$")} npm run plugins -- create interaction FeatureHighlight --container my-plugins
    ${c.dim("$")} npm run plugins -- create interaction CoreInteraction --container core --force
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const command = args[0];

switch (command) {
    case "list":
        cmdList();
        break;
    case "install":
        cmdInstall(args[1]);
        break;
    case "uninstall":
        cmdUninstall(args[1]);
        break;
    case "enable":
        cmdEnable(args[1]);
        break;
    case "disable":
        cmdDisable(args[1]);
        break;
    case "enable-all":
        cmdEnableAll();
        break;
    case "disable-all":
        cmdDisableAll();
        break;
    case "update":
        cmdUpdate(args[1]);
        break;
    case "create":
        cmdCreate(args[1], args[2]);
        break;
    case "destroy":
    case "delete":
        cmdDestroy(args[1]);
        break;
    case "activate":
        if (FLAG_JSON) {
            const act = activate({ silent: true });
            console.log(JSON.stringify(act, null, 2));
        } else {
            activate();
        }
        break;
    case "validate":
        cmdValidate();
        break;
    case "deps":
        cmdDeps();
        break;
    case "info":
        cmdInfo(args[1]);
        break;
    case "registry":
        cmdRegistry(args[1], args[2]);
        break;
    case "help":
    case "--help":
    case "-h":
        cmdHelp();
        break;
    default:
        if (command) {
            console.error(c.red(`Unknown command: ${command}`));
        }
        cmdHelp();
        if (command) process.exit(1);
        break;
}
