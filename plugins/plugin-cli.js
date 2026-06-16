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

/**
 * Read the MMGIS version from package.json.  Used to resolve
 * `"version": "core"` in plugin manifests.
 */
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

/**
 * Resolve a plugin version string.  `"core"` is replaced with the
 * current MMGIS version; everything else is returned as-is.
 */
function resolveVersion(version) {
    if (version === "core") return `${getMMGISVersion()} (core)`;
    return version;
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
                    // No valid manifest — still track as discovered but without metadata.
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

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdList() {
    const plugins = discoverAll();
    const state = loadState();

    if (plugins.length === 0) {
        console.log("No plugins found.");
        return;
    }

    // Group by container.
    const groups = {};
    for (const p of plugins) {
        if (!groups[p.container]) groups[p.container] = [];
        groups[p.container].push(p);
    }

    for (const [container, items] of Object.entries(groups)) {
        console.log(`\n  ${container}/`);
        for (const p of items) {
            const enabled = isPluginEnabled(p, state);
            const status = enabled ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
            const version = p.manifest && p.manifest.version ? `v${resolveVersion(p.manifest.version)}` : "";
            const tier = p.manifest && p.manifest.tier ? `[${p.manifest.tier}]` : "";
            const core = isCore(p) ? " (core)" : "";
            console.log(`    ${status} ${p.type}/${p.name}  ${version} ${tier}${core}`);
        }
    }
    console.log(`\n  Total: ${plugins.length} plugin(s)\n`);
}

function cmdInstall(target) {
    if (!target) {
        console.error("Usage: plugin-cli install <git-url|local-path>");
        process.exit(1);
    }

    const isGit = target.startsWith("http://") || target.startsWith("https://") ||
                  target.startsWith("git@") || target.endsWith(".git");

    if (isGit) {
        const repoName = repoNameFromURL(target);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
            console.error(`Plugin repo '${repoName}' already exists at ${dest}`);
            console.error("Use 'update' to pull latest, or 'remove' first.");
            process.exit(1);
        }

        console.log(`Cloning ${target} → plugins/${repoName}/`);
        try {
            execSync(`git clone "${target}" "${dest}"`, { stdio: "inherit" });
        } catch (err) {
            console.error(`Failed to clone: ${err.message}`);
            process.exit(1);
        }

        // Auto-register in registries if not already present.
        const registries = loadRegistries();
        const existing = registries.registries.find((r) => r.url === target);
        if (!existing) {
            registries.registries.push({
                name: repoName,
                url: target,
                type: "git",
            });
            saveRegistries(registries);
            console.log(`Registered ${repoName} in plugin-registries.json`);
        }

        // Discover what was installed and report.
        const plugins = discoverAll().filter((p) => p.container === repoName);
        if (plugins.length > 0) {
            console.log(`\nDiscovered ${plugins.length} plugin(s):`);
            for (const p of plugins) {
                console.log(`  ${p.type}/${p.name}`);
            }
        } else {
            console.log("\nWarning: No plugins found in the cloned repo.");
            console.log("Ensure the repo has the structure: <repo>/{tools,backend,components}/<Name>/plugin.json");
        }
    } else {
        // Local path — copy or symlink.
        const absPath = path.resolve(target);
        if (!fs.existsSync(absPath)) {
            console.error(`Path not found: ${absPath}`);
            process.exit(1);
        }

        const repoName = path.basename(absPath);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
            console.error(`Plugin directory '${repoName}' already exists at ${dest}`);
            process.exit(1);
        }

        console.log(`Symlinking ${absPath} → plugins/${repoName}/`);
        fs.symlinkSync(absPath, dest, "dir");

        const plugins = discoverAll().filter((p) => p.container === repoName);
        console.log(`Discovered ${plugins.length} plugin(s).`);
    }

    console.log("\nRun 'npm run build' to activate frontend plugins.");
    console.log("Restart the server to activate backend plugins.");
}

function cmdRemove(repoName) {
    if (!repoName) {
        console.error("Usage: plugin-cli remove <repo-name>");
        process.exit(1);
    }

    if (repoName === CORE_CONTAINER) {
        console.error("Cannot remove core plugins.");
        process.exit(1);
    }

    const dest = path.join(PLUGINS_ROOT, repoName);
    if (!fs.existsSync(dest)) {
        console.error(`Plugin repo '${repoName}' not found.`);
        process.exit(1);
    }

    // Remove from state.
    const state = loadState();
    const keysToRemove = Object.keys(state.plugins).filter((k) => k.startsWith(repoName + "/"));
    for (const k of keysToRemove) {
        delete state.plugins[k];
    }
    saveState(state);

    // Remove from registries.
    const registries = loadRegistries();
    registries.registries = registries.registries.filter((r) => r.name !== repoName);
    saveRegistries(registries);

    // Delete the directory.
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
        fs.unlinkSync(dest);
    } else {
        fs.rmSync(dest, { recursive: true, force: true });
    }

    console.log(`Removed plugin repo '${repoName}'.`);
    console.log("Run 'npm run build' and restart the server to apply changes.");
}

function cmdEnable(pluginIdStr) {
    if (!pluginIdStr) {
        console.error("Usage: plugin-cli enable <plugin-id>");
        console.error("Plugin IDs look like: my-plugins/tools/CustomTool");
        process.exit(1);
    }

    // Find the plugin.
    const plugins = discoverAll();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(`Plugin '${pluginIdStr}' not found.`);
        console.error("Run 'plugin-cli list' to see available plugins.");
        process.exit(1);
    }

    if (isCore(match)) {
        console.log(`Plugin '${match.id}' is a core plugin and is always enabled.`);
        return;
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: true };
    saveState(state);
    console.log(`Enabled: ${match.id}`);
    console.log("Run 'npm run build' and restart the server to apply changes.");
}

function cmdDisable(pluginIdStr) {
    if (!pluginIdStr) {
        console.error("Usage: plugin-cli disable <plugin-id>");
        process.exit(1);
    }

    const plugins = discoverAll();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(`Plugin '${pluginIdStr}' not found.`);
        process.exit(1);
    }

    if (isCore(match)) {
        console.error(`Cannot disable core plugin '${match.id}'.`);
        process.exit(1);
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: false };
    saveState(state);
    console.log(`Disabled: ${match.id}`);
    console.log("Run 'npm run build' and restart the server to apply changes.");
}

function cmdUpdate(repoName) {
    const registries = loadRegistries();

    if (repoName) {
        // Update a specific repo.
        const dest = path.join(PLUGINS_ROOT, repoName);
        if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
            console.error(`'${repoName}' is not a git-based plugin repo.`);
            process.exit(1);
        }
        if (repoName === CORE_CONTAINER) {
            console.error("Core plugins are updated with the main MMGIS repo.");
            process.exit(1);
        }
        console.log(`Updating ${repoName}...`);
        try {
            execSync("git pull", { cwd: dest, stdio: "inherit" });
        } catch (err) {
            console.error(`Failed to update ${repoName}: ${err.message}`);
            process.exit(1);
        }
    } else {
        // Update all registered repos.
        let updated = 0;
        for (const reg of registries.registries) {
            const dest = path.join(PLUGINS_ROOT, reg.name);
            if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
                console.log(`Skipping ${reg.name} (not a git repo on disk)`);
                continue;
            }
            console.log(`Updating ${reg.name}...`);
            try {
                execSync("git pull", { cwd: dest, stdio: "inherit" });
                updated++;
            } catch (err) {
                console.error(`  Failed: ${err.message}`);
            }
        }
        if (updated === 0 && registries.registries.length === 0) {
            console.log("No registered plugin repos to update.");
        } else {
            console.log(`\nUpdated ${updated} repo(s).`);
        }
    }

    console.log("Run 'npm run build' and restart the server to apply changes.");
}

function cmdValidate() {
    // Import the validation module.
    const { validatePluginConfig, validateDependencies } = require(
        path.join(__dirname, "..", "API", "pluginValidation")
    );

    const plugins = discoverAll();
    const state = loadState();
    let errors = 0;
    let warnings = 0;

    for (const p of plugins) {
        const enabled = isPluginEnabled(p, state);
        const prefix = `${p.id}`;

        if (!p.manifest) {
            console.error(`  ✗ ${prefix}: missing or invalid plugin.json`);
            errors++;
            continue;
        }

        // Map plugin type directory name to validation type.
        const typeMap = { tools: "tool", components: "component", backend: "backend" };
        const validationType = typeMap[p.type] || p.type;

        const errs = validatePluginConfig(p.manifest, p.name, validationType);
        if (errs.length > 0) {
            for (const e of errs) {
                console.error(`  ✗ ${prefix}: ${e}`);
            }
            errors += errs.length;
        }

        if (p.manifest.dependencies) {
            const depErrs = validateDependencies(p.manifest.dependencies, p.name);
            for (const e of depErrs) {
                console.error(`  ✗ ${prefix}: ${e}`);
            }
            errors += depErrs.length;
        }

        if (!enabled) {
            console.log(`  ⚠ ${prefix}: disabled`);
            warnings++;
        }
    }

    if (errors === 0) {
        console.log(`\n  All ${plugins.length} plugin(s) valid.`);
        if (warnings > 0) console.log(`  ${warnings} disabled plugin(s).`);
    } else {
        console.error(`\n  ${errors} error(s) across ${plugins.length} plugin(s).`);
        process.exit(1);
    }
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

    console.log("\n  npm dependencies:");
    const { merged: npmMerged, conflicts: npmConflicts } = mergeNpm(sources);
    const npmKeys = Object.keys(npmMerged);
    if (npmKeys.length === 0) {
        console.log("    (none)");
    } else {
        for (const [pkg, ver] of Object.entries(npmMerged)) {
            console.log(`    ${pkg}: ${ver}`);
        }
    }

    if (npmConflicts.length > 0) {
        console.log("\n  ⚠ npm conflicts:");
        for (const c of npmConflicts) {
            console.log(`    ${c.package}:`);
            for (const claim of c.claims) {
                console.log(`      ${claim.plugin}: ${claim.version}`);
            }
        }
    }

    // Python deps.
    const { merged: pipMerged, conflicts: pipConflicts } = mergePython(sources, "pip");
    if (pipMerged.length > 0) {
        console.log("\n  pip dependencies:");
        for (const dep of pipMerged) {
            console.log(`    ${dep}`);
        }
    }

    if (pipConflicts.length > 0) {
        console.log("\n  ⚠ pip conflicts:");
        for (const c of pipConflicts) {
            console.log(`    ${c.package}:`);
            for (const claim of c.claims) {
                console.log(`      ${claim.plugin}: ${claim.entry}`);
            }
        }
    }

    // Peer dependencies.
    const peerWarnings = checkPeerDependencies(active);
    if (peerWarnings.length > 0) {
        console.log("\n  ⚠ peerDependency warnings:");
        for (const w of peerWarnings) {
            console.log(`    ${w}`);
        }
    }

    const totalConflicts = npmConflicts.length + pipConflicts.length;
    console.log(`\n  ${npmKeys.length} npm, ${pipMerged.length} pip dep(s). ${totalConflicts} conflict(s). ${peerWarnings.length} peer warning(s).\n`);
}

function cmdInfo(pluginIdStr) {
    if (!pluginIdStr) {
        console.error("Usage: plugin-cli info <plugin-id>");
        process.exit(1);
    }

    const plugins = discoverAll();
    const state = loadState();
    const match = plugins.find((p) => p.id === pluginIdStr || p.name === pluginIdStr);

    if (!match) {
        console.error(`Plugin '${pluginIdStr}' not found.`);
        process.exit(1);
    }

    const enabled = isPluginEnabled(match, state);
    const m = match.manifest || {};

    console.log(`\n  Plugin: ${match.id}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Name:        ${m.name || match.name}`);
    if (m.display_name) console.log(`  Display:     ${m.display_name}`);
    console.log(`  Type:        ${match.type}`);
    console.log(`  Container:   ${match.container}`);
    console.log(`  Status:      ${enabled ? "enabled" : "disabled"}${isCore(match) ? " (core — always enabled)" : ""}`);
    if (m.version) console.log(`  Version:     ${resolveVersion(m.version)}`);
    if (m.author) console.log(`  Author:      ${typeof m.author === "object" ? m.author.name || JSON.stringify(m.author) : m.author}`);
    if (m.license) console.log(`  License:     ${m.license}`);
    if (m.repository) console.log(`  Repository:  ${m.repository}`);
    if (m.tier) console.log(`  Tier:        ${m.tier}`);
    if (m.id) console.log(`  Manifest ID: ${m.id}`);
    if (m.uuid) console.log(`  UUID:        ${m.uuid}`);
    if (m.overridable !== undefined) console.log(`  Overridable: ${m.overridable}`);
    if (m.description) console.log(`  Description: ${m.description}`);
    if (m.keywords && m.keywords.length > 0) console.log(`  Keywords:    ${m.keywords.join(", ")}`);
    if (m.engines) console.log(`  Engines:     ${JSON.stringify(m.engines)}`);
    if (m.aliases && m.aliases.length > 0) console.log(`  Aliases:     ${m.aliases.join(", ")}`);
    if (m.peerDependencies) {
        console.log(`  Peer Deps:`);
        for (const [peer, range] of Object.entries(m.peerDependencies)) {
            console.log(`    ${peer}: ${range}`);
        }
    }
    if (m.dependencies) {
        if (m.dependencies.npm) {
            console.log(`  npm Deps:`);
            for (const [pkg, ver] of Object.entries(m.dependencies.npm)) {
                console.log(`    ${pkg}: ${ver}`);
            }
        }
        if (m.dependencies.python) {
            if (m.dependencies.python.pip) {
                console.log(`  pip Deps:    ${m.dependencies.python.pip.join(", ")}`);
            }
            if (m.dependencies.python.conda) {
                console.log(`  conda Deps:  ${m.dependencies.python.conda.join(", ")}`);
            }
        }
    }
    console.log(`  Path:        ${match.pluginPath}`);
    console.log("");
}

function cmdRegistry(subcommand, arg) {
    const registries = loadRegistries();

    if (subcommand === "add") {
        if (!arg) {
            console.error("Usage: plugin-cli registry add <git-url>");
            process.exit(1);
        }
        const name = repoNameFromURL(arg);
        const existing = registries.registries.find((r) => r.url === arg || r.name === name);
        if (existing) {
            console.log(`Registry '${name}' already registered.`);
            return;
        }
        registries.registries.push({ name, url: arg, type: "git" });
        saveRegistries(registries);
        console.log(`Added registry: ${name} (${arg})`);
    } else if (subcommand === "remove") {
        if (!arg) {
            console.error("Usage: plugin-cli registry remove <name>");
            process.exit(1);
        }
        const before = registries.registries.length;
        registries.registries = registries.registries.filter(
            (r) => r.name !== arg && r.url !== arg
        );
        if (registries.registries.length === before) {
            console.error(`Registry '${arg}' not found.`);
            process.exit(1);
        }
        saveRegistries(registries);
        console.log(`Removed registry: ${arg}`);
    } else if (subcommand === "list" || !subcommand) {
        if (registries.registries.length === 0) {
            console.log("No registries configured.");
            return;
        }
        console.log("\n  Registered plugin sources:");
        for (const r of registries.registries) {
            console.log(`    ${r.name}: ${r.url} [${r.type}]`);
        }
        console.log("");
    } else {
        console.error(`Unknown registry subcommand: ${subcommand}`);
        console.error("Available: add, remove, list");
        process.exit(1);
    }
}

function cmdHelp() {
    console.log(`
  MMGIS Plugin CLI

  Usage: node plugins/plugin-cli.js <command> [options]
         npm run plugins -- <command> [options]

  Commands:
    list                          List all plugins with status
    install <git-url|local-path>  Install a plugin repo (git clone or symlink)
    remove <repo-name>            Remove an installed plugin repo (not core)
    enable <plugin-id>            Enable a disabled plugin
    disable <plugin-id>           Disable a plugin (not core)
    update [repo-name]            Pull latest for repo(s)
    validate                      Validate all plugin manifests
    deps                          Show dependency graph and conflicts
    info <plugin-id>              Show detailed plugin info
    registry add <git-url>        Add a registry URL
    registry remove <name>        Remove a registry URL
    registry list                 List registered URLs
    help                          Show this help

  Plugin IDs:
    <container>/<type>/<name>     e.g. core/tools/Draw
    <name>                        Short form (matches first found)

  Examples:
    node plugins/plugin-cli.js list
    node plugins/plugin-cli.js install https://github.com/org/mmgis-geo-plugins.git
    node plugins/plugin-cli.js enable my-plugins/tools/SpectralTool
    node plugins/plugin-cli.js disable SpectralTool
    node plugins/plugin-cli.js info Draw
    node plugins/plugin-cli.js registry add https://github.com/org/mmgis-plugins.git
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
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
            console.error(`Unknown command: ${command}`);
        }
        cmdHelp();
        if (command) process.exit(1);
        break;
}
