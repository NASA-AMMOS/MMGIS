#!/usr/bin/env node

/**
 * MMGIS Plugin CLI
 *
 * Manages plugin installation, activation, and inspection.
 *
 * Usage:
 *   node plugins/plugin-cli.js <command> [options]
 *
 * Commands:
 *   list                          List all plugins with status
 *   install <git-url|local-path>  Install a plugin repo
 *   remove <repo-name>            Remove an installed plugin repo
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

const PLUGINS_ROOT = path.resolve(__dirname);
const REGISTRIES_PATH = path.join(PLUGINS_ROOT, "plugin-registries.json");
const STATE_PATH = path.join(PLUGINS_ROOT, "plugin-state.json");
const CORE_CONTAINER = "core";

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
// Strip flags so positional command parsing still works.
const args = RAW_ARGS.filter((a, i) =>
    a !== "--no-color" && a !== "--json" && a !== "--link" && a !== "--force" &&
    a !== "--container" && (i === 0 || RAW_ARGS[i - 1] !== "--container")
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
            fs.readFileSync(path.join(PLUGINS_ROOT, "..", "package.json"), "utf8")
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
 * Derive a container name from a git URL.
 * e.g. "https://github.com/org/mmgis-geo-plugins.git" → "mmgis-geo-plugins"
 */
function repoNameFromURL(url) {
    const basename = path.basename(url.replace(/\.git$/, ""));
    return basename || url;
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
        const toolsFile = path.join(repoRoot, "src", "pre", "tools.js");
        const componentsFile = path.join(repoRoot, "src", "pre", "components.js");

        const beforeTools = parsePreImports(toolsFile);
        const beforeComponents = parsePreImports(componentsFile);

        // Suppress logger console output during regeneration.
        const origWrite = process.stdout.write;
        const origLog = console.log;
        const origError = console.error;
        try {
            process.stdout.write = () => true;
            console.log = () => {};
            console.error = () => {};

            const { updateTools, updateComponents } = require("../API/updateTools");
            updateTools();
            updateComponents();
        } finally {
            process.stdout.write = origWrite;
            console.log = origLog;
            console.error = origError;
        }

        const afterTools = parsePreImports(toolsFile);
        const afterComponents = parsePreImports(componentsFile);

        // Compute diffs.
        const added = [];
        const removed = [];
        for (const name of afterTools) {
            if (!beforeTools.has(name)) added.push({ name, type: "tool" });
        }
        for (const name of afterComponents) {
            if (!beforeComponents.has(name)) added.push({ name, type: "component" });
        }
        for (const name of beforeTools) {
            if (!afterTools.has(name)) removed.push({ name, type: "tool" });
        }
        for (const name of beforeComponents) {
            if (!afterComponents.has(name)) removed.push({ name, type: "component" });
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
    const TYPES = ["tools", "backend", "components"];

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
 * Core plugins are always enabled and cannot be disabled.
 */
function isPluginEnabled(plugin, state) {
    if (plugin.container === CORE_CONTAINER) return true;
    const entry = state.plugins[plugin.id];
    // Default: enabled (new plugins are active unless explicitly disabled).
    if (entry === undefined) return true;
    return entry.enabled !== false;
}

function isCore(plugin) {
    return plugin.container === CORE_CONTAINER;
}

function isRequired(plugin) {
    if (!plugin.manifest) return false;
    return plugin.manifest.required === true || plugin.manifest.overridable === false;
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
            type: p.type,
            container: p.container,
            enabled: isPluginEnabled(p, state),
            core: isCore(p),
            version: (p.manifest && p.manifest.version) || null,
            tier: (p.manifest && p.manifest.tier) || null,
            author: (p.manifest && p.manifest.author) || null,
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
    const TYPE_LABELS = { tools: "Tools", backend: "Backend", components: "Components" };
    const TYPE_COLOR = { tools: c.cyan, backend: c.yellow, components: c.green };

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
    const TYPE_ORDER = ["tools", "backend", "components"];

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
        console.error(c.red("Usage: plugin-cli install <git-url|local-path>"));
        process.exit(1);
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
            console.error(c.yellow("Use 'update' to pull latest, or 'remove' first."));
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
        if (!FLAG_JSON) step(2, 3, "Registering in plugin-registries.json");
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
            jsonResult.discovered = plugins.map((p) => ({ id: p.id, type: p.type, name: p.name }));
        } else if (plugins.length > 0) {
            console.log(`\n  ${c.green(`Discovered ${plugins.length} plugin(s):`)}`)
            for (const p of plugins) {
                console.log(`    ${c.cyan(p.type + "/" + p.name)}`);
            }
        } else {
            console.log(`\n  ${c.red("Discovered 0 plugin(s).")}`);
            console.log(c.dim("  Ensure the repo has the structure: <repo>/{tools,backend,components}/<Name>/plugin.json"));
        }
    } else {
        // Local path — copy or symlink.
        const absPath = path.resolve(target);
        if (!fs.existsSync(absPath)) {
            console.error(c.red(`Path not found: ${absPath}`));
            process.exit(1);
        }

        const repoName = path.basename(absPath);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
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
            jsonResult.discovered = plugins.map((p) => ({ id: p.id, type: p.type, name: p.name }));
        } else if (plugins.length === 0) {
            console.log(`  ${c.red(`Discovered ${plugins.length} plugin(s).`)}`);
        } else {
            console.log(`  ${c.green(`Discovered ${plugins.length} plugin(s).`)}`);
        }

        // Warn about flat repo structure (no tools/backend/components subdir).
        if (plugins.length === 0) {
            const TYPES = ["tools", "backend", "components"];
            const hasTypeDir = TYPES.some((t) =>
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
                    if (jsonResult) jsonResult.warnings.push("Repo has flat structure — no tools/backend/components subdirectory");
                    if (!FLAG_JSON) {
                        console.log(
                            `\n  ${c.yellow("Warning:")} This repo appears to have plugins directly under the root ` +
                            `without a ${c.cyan("tools/")}, ${c.cyan("backend/")}, or ${c.cyan("components/")} subdirectory.\n` +
                            `  The plugin system expects: ${c.cyan("<repo>/tools/<PluginName>/plugin.json")}\n` +
                            `  See ${c.cyan("plugins/README.md")} for the expected directory structure.`
                        );
                    }
                }
            }
        }
    }

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        jsonResult.activated = { added: act.added, removed: act.removed };
        if (act.error) jsonResult.warnings.push(act.error);
        console.log(JSON.stringify(jsonResult, null, 2));
    } else {
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to activate backend plugins.")}\n`);
    }
}

function cmdRemove(repoName) {
    if (!repoName) {
        console.error(c.red("Usage: plugin-cli remove <repo-name>"));
        process.exit(1);
    }

    if (repoName === CORE_CONTAINER) {
        console.error(c.red("Cannot remove core plugins."));
        process.exit(1);
    }

    const dest = path.join(PLUGINS_ROOT, repoName);
    if (!fs.existsSync(dest)) {
        console.error(c.red(`Plugin repo '${repoName}' not found.`));
        process.exit(1);
    }

    if (!FLAG_JSON) step(1, 3, "Removing from state file");
    const state = loadState();
    const keysToRemove = Object.keys(state.plugins).filter((k) => k.startsWith(repoName + "/"));
    for (const k of keysToRemove) {
        delete state.plugins[k];
    }
    saveState(state);

    if (!FLAG_JSON) step(2, 3, "Removing from registries");
    const registries = loadRegistries();
    registries.registries = registries.registries.filter((r) => r.name !== repoName);
    saveRegistries(registries);

    if (!FLAG_JSON) step(3, 3, "Deleting directory");
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
        fs.unlinkSync(dest);
    } else {
        fs.rmSync(dest, { recursive: true, force: true });
    }

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "remove", repo: repoName, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`\n  ${c.green(`Removed plugin repo '${repoName}'.`)}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}\n`);
    }
}

function cmdEnable(pluginIdStr) {
    if (!pluginIdStr) {
        console.error(c.red("Usage: plugin-cli enable <plugin-id>"));
        console.error(c.dim("Plugin IDs look like: my-plugins/tools/CustomTool"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        console.error(c.dim("Run 'npm run plugins -- list' to see available plugins."));
        process.exit(1);
    }

    if (isCore(match)) {
        console.log(c.yellow(`Plugin '${match.id}' is a core plugin and is always enabled.`));
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
        console.error(c.red("Usage: plugin-cli disable <plugin-id>"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        process.exit(1);
    }

    if (isRequired(match)) {
        console.error(c.red(`Cannot disable required plugin '${match.id}'.`));
        process.exit(1);
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: false };
    saveState(state);

    if (FLAG_JSON) {
        const act = activate({ expectChanges: true, silent: true });
        console.log(JSON.stringify({ command: "disable", plugin: match.id, activated: { added: act.added, removed: act.removed } }, null, 2));
    } else {
        console.log(`  ${c.red("✗")} Disabled: ${c.cyan(match.id)}`);
        activate({ expectChanges: true });
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}`);
    }
}

function cmdUpdate(repoName) {
    const registries = loadRegistries();

    if (repoName) {
        const dest = path.join(PLUGINS_ROOT, repoName);
        if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
            console.error(c.red(`'${repoName}' is not a git-based plugin repo.`));
            process.exit(1);
        }
        if (repoName === CORE_CONTAINER) {
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
            const dest = path.join(PLUGINS_ROOT, reg.name);
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
        console.log(`  ${c.dim("Restart the server to apply backend changes.")}\n`);
    }
}

function cmdValidate() {
    const { validatePluginConfig, validateDependencies } = require(
        path.join(__dirname, "..", "API", "pluginValidation")
    );

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

        const typeMap = { tools: "tool", components: "component", backend: "backend" };
        const validationType = typeMap[p.type] || p.type;

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

    if (FLAG_JSON) {
        console.log(JSON.stringify({ valid: errors === 0, total: plugins.length, passed, errors, warnings, results }, null, 2));
        if (errors > 0) process.exit(1);
        return;
    }

    if (errors === 0) {
        console.log(`\n  ${c.green("✓")} All ${c.bold(String(plugins.length))} plugin(s) valid.`);
        if (warnings > 0) console.log(`  ${c.yellow(String(warnings))} disabled plugin(s).`);
    } else {
        console.error(`\n  ${c.red(`${errors} error(s)`)} across ${c.bold(String(plugins.length))} plugin(s). ${c.green(`${passed} passed`)}.`);
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

    if (FLAG_JSON) {
        console.log(JSON.stringify({
            npm: { merged: npmMerged, conflicts: npmConflicts },
            pip: { merged: pipMerged, conflicts: pipConflicts },
            conda: { merged: condaMerged, conflicts: condaConflicts },
            peerWarnings,
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

    const totalConflicts = npmConflicts.length + pipConflicts.length + condaConflicts.length;
    const conflictStr = totalConflicts > 0 ? c.red(`${totalConflicts} conflict(s)`) : c.green("0 conflicts");
    const peerStr = peerWarnings.length > 0 ? c.yellow(`${peerWarnings.length} peer warning(s)`) : c.green("0 peer warnings");
    console.log(`\n  ${c.bold(String(npmKeys.length))} npm, ${c.bold(String(pipMerged.length))} pip, ${c.bold(String(condaMerged.length))} conda dep(s). ${conflictStr}. ${peerStr}.\n`);
}

function cmdInfo(pluginIdStr) {
    if (!pluginIdStr) {
        console.error(c.red("Usage: plugin-cli info <plugin-id>"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const state = loadState();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        process.exit(1);
    }

    // --json: structured output
    if (FLAG_JSON) {
        const m = match.manifest || {};
        const out = {
            id: match.id, name: match.name, type: match.type,
            container: match.container,
            enabled: isPluginEnabled(match, state),
            core: isCore(match),
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
    console.log(`  ${c.dim("Type:")}        ${c.yellow(match.type)}`);
    console.log(`  ${c.dim("Container:")}   ${match.container}`);
    const statusStr = enabled
        ? c.green("enabled") + (isCore(match) ? c.gray(" (core — always enabled)") : "")
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
    if (m.description) console.log(`  ${c.dim("Description:")} ${m.description}`);
    if (m.keywords && m.keywords.length > 0) console.log(`  ${c.dim("Keywords:")}    ${m.keywords.map((k) => c.cyan(k)).join(", ")}`);
    if (m.engines) console.log(`  ${c.dim("Engines:")}     ${JSON.stringify(m.engines)}`);
    if (m.aliases && m.aliases.length > 0) console.log(`  ${c.dim("Aliases:")}     ${m.aliases.join(", ")}`);
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
            console.error(c.red("Usage: plugin-cli registry add <git-url>"));
            process.exit(1);
        }
        const name = repoNameFromURL(arg);
        const existing = registries.registries.find((r) => r.url === arg || r.name === name);
        if (existing) {
            console.log(c.yellow(`Registry '${name}' already registered.`));
            return;
        }
        registries.registries.push({ name, url: arg, type: "git" });
        saveRegistries(registries);
        console.log(`  ${c.green("✓")} Added registry: ${c.cyan(name)} ${c.dim(`(${arg})`)}`);
    } else if (subcommand === "remove") {
        if (!arg) {
            console.error(c.red("Usage: plugin-cli registry remove <name>"));
            process.exit(1);
        }
        const before = registries.registries.length;
        registries.registries = registries.registries.filter(
            (r) => r.name !== arg && r.url !== arg
        );
        if (registries.registries.length === before) {
            console.error(c.red(`Registry '${arg}' not found.`));
            process.exit(1);
        }
        saveRegistries(registries);
        console.log(`  ${c.green("✓")} Removed registry: ${c.cyan(arg)}`);
    } else if (subcommand === "list" || !subcommand) {
        if (registries.registries.length === 0) {
            console.log(c.yellow("No registries configured."));
            return;
        }
        console.log(`\n  ${c.bold(c.white("Registered plugin sources:"))}`);
        for (const r of registries.registries) {
            console.log(`    ${c.cyan(r.name)}: ${c.white(r.url)} ${c.dim(`[${r.type}]`)}`);

        }
        console.log("");
    } else {
        console.error(c.red(`Unknown registry subcommand: ${subcommand}`));
        console.error(c.dim("Available: add, remove, list"));
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// Scaffold templates
// ---------------------------------------------------------------------------

function _scaffoldTool(name) {
    return {
        "plugin.json": JSON.stringify({
            name,
            type: "tool",
            defaultIcon: "puzzle-outline",
            paths: {}  // placeholder — filled dynamically below
        }, null, 4) + "\n",
        [`${name}Tool.js`]: [
            `import React from 'react'`,
            `import { createRoot } from 'react-dom/client'`,
            ``,
            `import ToolController_ from '@basics/ToolController_/ToolController_'`,
            `import L_ from '@basics/Layers_/Layers_'`,
            `import Map_ from '@basics/Map_/Map_'`,
            `import { IconButton } from '@design/components'`,
            ``,
            `import './${name}Tool.css'`,
            ``,
            `let ${name}Tool = {`,
            `    height: 0,`,
            `    width: 300,`,
            `    _root: null,`,
            ``,
            `    make: function () {`,
            `        const toolPanel = document.getElementById('toolPanel')`,
            `        if (toolPanel) toolPanel.innerHTML = ''`,
            ``,
            `        ${name}Tool._root = createRoot(toolPanel)`,
            `        ${name}Tool._root.render(`,
            `            <div className='${name[0].toLowerCase() + name.slice(1)}Tool'>`,
            `                <div className='mmgisToolHeader'>`,
            `                    <div>`,
            `                        <div>`,
            `                            <div className='mmgisToolTitle'>${name}</div>`,
            `                        </div>`,
            `                        <div>`,
            `                            <IconButton`,
            `                                size='sm'`,
            `                                onClick={() => ToolController_.closeActiveTool()}`,
            `                                title='Close Tool'`,
            `                            >`,
            `                                <i className='mdi mdi-close mdi-18px' />`,
            `                            </IconButton>`,
            `                        </div>`,
            `                    </div>`,
            `                </div>`,
            `                <div className='${name[0].toLowerCase() + name.slice(1)}Tool_content'>`,
            `                    {/* Tool content goes here */}`,
            `                </div>`,
            `            </div>`,
            `        )`,
            `    },`,
            ``,
            `    destroy: function () {`,
            `        if (${name}Tool._root) {`,
            `            ${name}Tool._root.unmount()`,
            `            ${name}Tool._root = null`,
            `        }`,
            `    },`,
            `}`,
            ``,
            `export default ${name}Tool`,
            ``,
        ].join("\n"),
        [`${name}Tool.css`]: [
            `.${name[0].toLowerCase() + name.slice(1)}Tool {`,
            `}`,
            `.${name[0].toLowerCase() + name.slice(1)}Tool_content {`,
            `    padding: 8px;`,
            `}`,
            ``,
        ].join("\n"),
        [`tests/${name[0].toLowerCase() + name.slice(1)}Tool.spec.js`]: [
            `const { test, expect } = require('@playwright/test')`,
            `const path = require('path')`,
            ``,
            `test.describe('${name}Tool', () => {`,
            `    test('plugin.json is valid', () => {`,
            `        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))`,
            `        expect(manifest.name).toBe('${name}')`,
            `        expect(manifest.type).toBe('tool')`,
            `        expect(manifest.paths).toBeDefined()`,
            `        expect(manifest.paths['${name}Tool']).toBeDefined()`,
            `    })`,
            `})`,
            ``,
        ].join("\n"),
    };
}

function _scaffoldBackend(name) {
    const lower = name[0].toLowerCase() + name.slice(1);
    return {
        "plugin.json": JSON.stringify({
            name,
            type: "backend",
        }, null, 4) + "\n",
        "plugin.js": [
            `const router = require('./routes/${lower}')`,
            ``,
            `let setup = {`,
            `    onceInit: (s) => {`,
            `        s.app.use(`,
            `            s.ROOT_PATH + '/api/${lower}',`,
            `            s.checkHeadersCodeInjection,`,
            `            s.setContentType,`,
            `            router`,
            `        )`,
            `    },`,
            `    onceStarted: (s) => {},`,
            `    onceSynced: (s) => {},`,
            `}`,
            ``,
            `module.exports = setup`,
            ``,
        ].join("\n"),
        [`routes/${lower}.js`]: [
            `const express = require('express')`,
            `const router = express.Router()`,
            ``,
            `router.get('/', (req, res) => {`,
            `    res.json({ status: 'ok' })`,
            `})`,
            ``,
            `module.exports = router`,
            ``,
        ].join("\n"),
        [`tests/${lower}.spec.js`]: [
            `const { test, expect } = require('@playwright/test')`,
            `const path = require('path')`,
            ``,
            `test.describe('${name} backend', () => {`,
            `    test('plugin.json is valid', () => {`,
            `        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))`,
            `        expect(manifest.name).toBe('${name}')`,
            `        expect(manifest.type).toBe('backend')`,
            `    })`,
            `})`,
            ``,
        ].join("\n"),
    };
}

function _scaffoldComponent(name) {
    const lower = name[0].toLowerCase() + name.slice(1);
    return {
        "plugin.json": JSON.stringify({
            name,
            type: "component",
            defaultIcon: "puzzle-outline",
            paths: {}  // placeholder — filled dynamically below
        }, null, 4) + "\n",
        [`${name}.js`]: [
            `import L_ from '@basics/Layers_/Layers_'`,
            ``,
            `import './${name}.css'`,
            ``,
            `const ${name} = {`,
            `    state: {},`,
            ``,
            `    init: function (vars) {`,
            `        // Called when the component is initialized.`,
            `        // 'vars' contains configuration from the Configure page.`,
            `    },`,
            `}`,
            ``,
            `export default ${name}`,
            ``,
        ].join("\n"),
        [`${name}.css`]: `.${lower} {\n}\n`,
        [`tests/${lower}.spec.js`]: [
            `const { test, expect } = require('@playwright/test')`,
            `const path = require('path')`,
            ``,
            `test.describe('${name} component', () => {`,
            `    test('plugin.json is valid', () => {`,
            `        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))`,
            `        expect(manifest.name).toBe('${name}')`,
            `        expect(manifest.type).toBe('component')`,
            `        expect(manifest.paths).toBeDefined()`,
            `        expect(manifest.paths['${name}']).toBeDefined()`,
            `    })`,
            `})`,
            ``,
        ].join("\n"),
    };
}

function cmdCreate(type, name) {
    const VALID_TYPES = ["tool", "backend", "component"];
    const typeDir = type === "tool" ? "tools" : type === "backend" ? "backend" : "components";

    if (!type || !VALID_TYPES.includes(type)) {
        console.error(c.red(`Usage: plugin-cli create <${VALID_TYPES.join("|")}> <Name> --container <container>`));
        process.exit(1);
    }
    if (!name) {
        console.error(c.red("Missing plugin name."));
        console.error(c.dim(`Usage: plugin-cli create ${type} <Name> --container <container>`));
        process.exit(1);
    }
    if (!FLAG_CONTAINER) {
        console.error(c.red("Missing --container flag."));
        console.error(c.dim(`Usage: plugin-cli create ${type} ${name} --container <container>`));
        process.exit(1);
    }

    const container = FLAG_CONTAINER;
    const pluginDir = path.join(PLUGINS_ROOT, container, typeDir, name);

    if (fs.existsSync(pluginDir)) {
        console.error(c.red(`Plugin already exists: ${pluginDir}`));
        process.exit(1);
    }

    // Ensure container directory exists.
    const containerDir = path.join(PLUGINS_ROOT, container);
    if (!fs.existsSync(containerDir)) {
        fs.mkdirSync(containerDir, { recursive: true });
        if (!FLAG_JSON) console.log(`  ${c.green("✓")} Created container: ${c.cyan(container + "/")}`);
    }

    // Generate scaffold files.
    let files;
    switch (type) {
        case "tool":      files = _scaffoldTool(name); break;
        case "backend":   files = _scaffoldBackend(name); break;
        case "component": files = _scaffoldComponent(name); break;
    }

    // Fix the paths field in plugin.json to use the actual relative path.
    if (type === "tool") {
        const manifest = JSON.parse(files["plugin.json"]);
        manifest.paths = { [`${name}Tool`]: `../plugins/${container}/tools/${name}/${name}Tool` };
        files["plugin.json"] = JSON.stringify(manifest, null, 4) + "\n";
    } else if (type === "component") {
        const manifest = JSON.parse(files["plugin.json"]);
        manifest.paths = { [name]: `../plugins/${container}/components/${name}/${name}` };
        files["plugin.json"] = JSON.stringify(manifest, null, 4) + "\n";
    }

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
        if (type === "tool" || type === "component") {
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

    // Auto-activate for frontend plugins.
    if (type === "tool" || type === "component") {
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
    } else {
        console.log(`    ${c.dim("1.")} Edit ${c.cyan(`${name}.js`)} to build your component`);
        console.log(`    ${c.dim("2.")} Configure variables in ${c.cyan("plugin.json")} under ${c.cyan('"config"')}`);
    }
    console.log("");
}

function cmdDestroy(pluginIdStr) {
    if (!pluginIdStr) {
        console.error(c.red("Usage: plugin-cli destroy <plugin-id> [--force]"));
        console.error(c.dim("Plugin IDs look like: my-plugins/tools/CustomTool"));
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(c.red(`Plugin '${pluginIdStr}' not found.`));
        console.error(c.dim("Run 'npm run plugins -- list' to see available plugins."));
        process.exit(1);
    }

    if (isCore(match)) {
        console.error(c.red(`Cannot destroy core plugin '${match.id}'.`));
        process.exit(1);
    }

    if (isRequired(match)) {
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
        const isFrontend = match.type === "tools" || match.type === "components";
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
        const isFrontend = match.type === "tools" || match.type === "components";
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

  ${c.dim("Usage:")} node plugins/plugin-cli.js ${c.cyan("<command>")} [options]
         npm run plugins -- ${c.cyan("<command>")} [options]

  ${c.bold(c.white("Commands:"))}
${h("list", "List all plugins with status")}
${h("install <git-url|local-path>", "Install a plugin repo (git clone or copy)")}
${h("remove <repo-name>", "Remove an installed plugin repo (not core)")}
${h("enable <plugin-id>", "Enable a disabled plugin")}
${h("disable <plugin-id>", "Disable a plugin (not core)")}
${h("update [repo-name]", "Pull latest for repo(s)")}
${h("create <type> <Name>", "Scaffold a new plugin (tool, backend, component)")}
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
    ${c.cyan("--container <name>".padEnd(30))} ${c.dim("Target container for create command")}
    ${c.cyan("--force".padEnd(30))} ${c.dim("Skip confirmation prompts (destroy)")}

  ${c.bold(c.white("Plugin IDs:"))}
    ${c.dim("<container>/<type>/<name>")}     e.g. ${c.cyan("core/tools/Draw")}
    ${c.dim("<name>")}                        Short form (matches first found)

  ${c.bold(c.white("Examples:"))}
    ${c.dim("$")} npm run plugins -- list
    ${c.dim("$")} npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git
    ${c.dim("$")} npm run plugins -- enable my-plugins/tools/SpectralTool
    ${c.dim("$")} npm run plugins -- info Draw
    ${c.dim("$")} npm run plugins -- list --json
    ${c.dim("$")} npm run plugins -- create tool SpectralAnalysis --container my-plugins
    ${c.dim("$")} npm run plugins -- create backend DataIngest --container core
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
    case "remove":
        cmdRemove(args[1]);
        break;
    case "enable":
        cmdEnable(args[1]);
        break;
    case "disable":
        cmdDisable(args[1]);
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
