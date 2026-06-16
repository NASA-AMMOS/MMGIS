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

// ---------------------------------------------------------------------------
// CLI flags — parsed early so colour helpers can reference them.
// ---------------------------------------------------------------------------

const RAW_ARGS = process.argv.slice(2);
const FLAG_NO_COLOR = RAW_ARGS.includes("--no-color") || !!process.env.NO_COLOR;
const FLAG_JSON = RAW_ARGS.includes("--json");
const FLAG_LINK = RAW_ARGS.includes("--link");
// Strip flags so positional command parsing still works.
const args = RAW_ARGS.filter((a) => a !== "--no-color" && a !== "--json" && a !== "--link");

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

    if (isGit) {
        const repoName = repoNameFromURL(target);
        const dest = path.join(PLUGINS_ROOT, repoName);

        if (fs.existsSync(dest)) {
            console.error(c.red(`Plugin repo '${repoName}' already exists at ${dest}`));
            console.error(c.yellow("Use 'update' to pull latest, or 'remove' first."));
            process.exit(1);
        }

        step(1, 3, `Cloning ${c.cyan(target)} → ${c.cyan(`plugins/${repoName}/`)}`);
        try {
            execSync(`git clone "${target}" "${dest}"`, { stdio: "inherit" });
        } catch (err) {
            console.error(c.red(`Failed to clone: ${err.message}`));
            process.exit(1);
        }

        // Auto-register in registries if not already present.
        step(2, 3, "Registering in plugin-registries.json");
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
        step(3, 3, "Discovering plugins");
        const plugins = discoverAll().filter((p) => p.container === repoName);
        if (plugins.length > 0) {
            console.log(`\n  ${c.green(`Discovered ${plugins.length} plugin(s):`)}`)
            for (const p of plugins) {
                console.log(`    ${c.cyan(p.type + "/" + p.name)}`);
            }
        } else {
            console.log(`\n  ${c.yellow("Warning: No plugins found in the cloned repo.")}`);
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
            step(1, 2, `Linking ${c.cyan(absPath)} → ${c.cyan(`plugins/${repoName}/`)}`);
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
            step(1, 2, `Copying ${c.cyan(absPath)} → ${c.cyan(`plugins/${repoName}/`)}`);
            cpDirSync(absPath, dest);
        }

        step(2, 2, "Discovering plugins");
        const plugins = discoverAll().filter((p) => p.container === repoName);
        console.log(`  ${c.green(`Discovered ${plugins.length} plugin(s).`)}`);
    }

    console.log(`\n  ${c.dim("Run")} ${c.cyan("npm run build")} ${c.dim("to activate frontend plugins.")}`);
    console.log(`  ${c.dim("Restart the server to activate backend plugins.")}\n`);
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

    step(1, 3, "Removing from state file");
    const state = loadState();
    const keysToRemove = Object.keys(state.plugins).filter((k) => k.startsWith(repoName + "/"));
    for (const k of keysToRemove) {
        delete state.plugins[k];
    }
    saveState(state);

    step(2, 3, "Removing from registries");
    const registries = loadRegistries();
    registries.registries = registries.registries.filter((r) => r.name !== repoName);
    saveRegistries(registries);

    step(3, 3, "Deleting directory");
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
        fs.unlinkSync(dest);
    } else {
        fs.rmSync(dest, { recursive: true, force: true });
    }

    console.log(`\n  ${c.green(`Removed plugin repo '${repoName}'.`)}`);
    console.log(`  ${c.dim("Run")} ${c.cyan("npm run build")} ${c.dim("and restart the server to apply changes.")}\n`);
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
        console.error(c.dim("Run 'plugin-cli list' to see available plugins."));
        process.exit(1);
    }

    if (isCore(match)) {
        console.log(c.yellow(`Plugin '${match.id}' is a core plugin and is always enabled.`));
        return;
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: true };
    saveState(state);
    console.log(`  ${c.green("✓")} Enabled: ${c.cyan(match.id)}`);
    console.log(`  ${c.dim("Run")} ${c.cyan("npm run build")} ${c.dim("and restart the server to apply changes.")}`);
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

    if (isCore(match)) {
        console.error(c.red(`Cannot disable core plugin '${match.id}'.`));
        process.exit(1);
    }

    const state = loadState();
    state.plugins[match.id] = { enabled: false };
    saveState(state);
    console.log(`  ${c.red("✗")} Disabled: ${c.cyan(match.id)}`);
    console.log(`  ${c.dim("Run")} ${c.cyan("npm run build")} ${c.dim("and restart the server to apply changes.")}`);
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
        step(1, 1, `Pulling latest for ${c.cyan(repoName)}`);
        try {
            execSync("git pull", { cwd: dest, stdio: "inherit" });
            console.log(`  ${c.green("Done.")}`);
        } catch (err) {
            console.error(c.red(`Failed to update ${repoName}: ${err.message}`));
            process.exit(1);
        }
    } else {
        const repos = registries.registries;
        if (repos.length === 0) {
            console.log(c.yellow("No registered plugin repos to update."));
            return;
        }
        let updated = 0;
        for (let i = 0; i < repos.length; i++) {
            const reg = repos[i];
            const dest = path.join(PLUGINS_ROOT, reg.name);
            if (!fs.existsSync(dest) || !fs.existsSync(path.join(dest, ".git"))) {
                step(i + 1, repos.length, `Skipping ${c.dim(reg.name)} (not a git repo on disk)`);
                continue;
            }
            step(i + 1, repos.length, `Pulling latest for ${c.cyan(reg.name)}`);
            try {
                execSync("git pull", { cwd: dest, stdio: "inherit" });
                updated++;
            } catch (err) {
                console.error(`    ${c.red("Failed:")} ${err.message}`);
            }
        }
        console.log(`\n  ${c.green(`Updated ${updated} repo(s).`)}`);
    }

    console.log(`  ${c.dim("Run")} ${c.cyan("npm run build")} ${c.dim("and restart the server to apply changes.")}\n`);
}

function cmdValidate() {
    const { validatePluginConfig, validateDependencies } = require(
        path.join(__dirname, "..", "API", "pluginValidation")
    );

    const plugins = discoverAll();
    const state = loadState();
    let errors = 0;
    let warnings = 0;
    let passed = 0;

    console.log("");
    for (const p of plugins) {
        const enabled = isPluginEnabled(p, state);
        const prefix = p.id;

        if (!p.manifest) {
            console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red("missing or invalid plugin.json")}`);
            errors++;
            continue;
        }

        const typeMap = { tools: "tool", components: "component", backend: "backend" };
        const validationType = typeMap[p.type] || p.type;

        const errs = validatePluginConfig(p.manifest, p.name, validationType);
        if (errs.length > 0) {
            for (const e of errs) {
                console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(e)}`);
            }
            errors += errs.length;
        }

        if (p.manifest.dependencies) {
            const depErrs = validateDependencies(p.manifest.dependencies, p.name);
            for (const e of depErrs) {
                console.error(`  ${c.red("✗")} ${c.cyan(prefix)}: ${c.red(e)}`);
            }
            errors += depErrs.length;
        }

        if (!enabled) {
            console.log(`  ${c.yellow("⚠")} ${c.cyan(prefix)}: ${c.yellow("disabled")}`);
            warnings++;
        } else if (errs.length === 0) {
            passed++;
        }
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

    console.log(`\n  ${c.bold(c.white("npm dependencies:"))}`);
    const { merged: npmMerged, conflicts: npmConflicts } = mergeNpm(sources);
    const npmKeys = Object.keys(npmMerged);
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
    const { merged: pipMerged, conflicts: pipConflicts } = mergePython(sources, "pip");
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
    const { merged: condaMerged, conflicts: condaConflicts } = mergePython(sources, "conda");
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
    const peerWarnings = checkPeerDependencies(active);
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
${h("validate", "Validate all plugin manifests")}
${h("deps", "Show dependency graph and conflicts")}
${h("info <plugin-id>", "Show detailed plugin info")}
${h("registry add <git-url>", "Add a registry URL")}
${h("registry remove <name>", "Remove a registry URL")}
${h("registry list", "List registered URLs")}
${h("help", "Show this help")}

  ${c.bold(c.white("Flags:"))}
    ${c.cyan("--no-color".padEnd(30))} ${c.dim("Disable colored output (also respects NO_COLOR env)")}
    ${c.cyan("--json".padEnd(30))} ${c.dim("Output machine-readable JSON (list, info)")}
    ${c.cyan("--link".padEnd(30))} ${c.dim("Symlink local paths instead of copy (falls back to junction on Windows)")}

  ${c.bold(c.white("Plugin IDs:"))}
    ${c.dim("<container>/<type>/<name>")}     e.g. ${c.cyan("core/tools/Draw")}
    ${c.dim("<name>")}                        Short form (matches first found)

  ${c.bold(c.white("Examples:"))}
    ${c.dim("$")} npm run plugins -- list
    ${c.dim("$")} npm run plugins -- install https://github.com/org/mmgis-geo-plugins.git
    ${c.dim("$")} npm run plugins -- enable my-plugins/tools/SpectralTool
    ${c.dim("$")} npm run plugins -- info Draw
    ${c.dim("$")} npm run plugins -- list --json
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
