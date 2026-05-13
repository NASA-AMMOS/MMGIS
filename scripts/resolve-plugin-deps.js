/**
 * Aggregate per-plugin dependencies into generated build artifacts.
 *
 * Scans every tool, component, and backend plugin for an optional
 * `dependencies` block in its config.json (or `setup.js` for backends)
 * and writes three files at the repo root:
 *
 *   - `plugin-package.json`              — npm deps in package.json shape
 *   - `plugin-python-requirements.txt`   — pip deps, one per line
 *   - `plugin-conda-deps.txt`            — conda deps, one per line
 *
 * The generated files are gitignored and are intended to be consumed by
 * `scripts/build.js`, the Dockerfile (`npm install` from
 * `plugin-package.json` and `pip install -r plugin-python-requirements.txt`),
 * and developers who want to inspect the aggregated dependency set.
 *
 * Version conflict detection: if two plugins declare the same npm
 * package with different version specifiers (or the same pip/conda
 * package with different versions), this script fails with a clear
 * error describing every conflict.
 */

const fs = require("fs");
const path = require("path");

const { discoverPlugins } = require("../API/pluginDiscovery");
const { validateDependencies } = require("../API/pluginValidation");

const REPO_ROOT = path.resolve(__dirname, "..");
const ESSENCE_PATH = path.join(REPO_ROOT, "src", "essence");
const API_PATH = path.join(REPO_ROOT, "API");

const OUTPUT_NPM = path.join(REPO_ROOT, "plugin-package.json");
const OUTPUT_PIP = path.join(REPO_ROOT, "plugin-python-requirements.txt");
const OUTPUT_CONDA = path.join(REPO_ROOT, "plugin-conda-deps.txt");

/**
 * Read `dependencies` from a tool/component config.json.
 */
function depsFromManifest(manifest) {
    return (manifest && manifest.dependencies) || null;
}

/**
 * For backend plugins: dependencies live in a sibling `config.json`
 * next to `setup.js`. We do **not** `require()` `setup.js` during
 * dep aggregation because backend setup modules typically connect to
 * the database and have other runtime side-effects at import time.
 */
function depsForBackend(plugin) {
    const cfgPath = path.join(plugin.pluginPath, "config.json");
    if (!fs.existsSync(cfgPath)) return null;
    try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        return cfg && cfg.dependencies ? cfg.dependencies : null;
    } catch {
        return null;
    }
}

/**
 * Merge npm deps from many plugins. Conflicts are surfaced via the
 * returned `conflicts` array; the caller decides whether to fail.
 */
function mergeNpm(sources) {
    /** @type {Record<string, string>} */
    const merged = {};
    /** @type {Record<string, Array<{plugin:string, version:string}>>} */
    const seen = {};
    for (const { plugin, deps } of sources) {
        if (!deps || !deps.npm) continue;
        for (const [pkg, version] of Object.entries(deps.npm)) {
            if (!seen[pkg]) seen[pkg] = [];
            seen[pkg].push({ plugin, version: String(version) });
            // First-seen wins; later sources may flag a conflict.
            if (merged[pkg] === undefined) merged[pkg] = String(version);
        }
    }
    const conflicts = [];
    for (const [pkg, claims] of Object.entries(seen)) {
        const versions = Array.from(new Set(claims.map((c) => c.version)));
        if (versions.length > 1) {
            conflicts.push({
                kind: "npm",
                package: pkg,
                claims,
            });
        }
    }
    return { merged, conflicts };
}

/**
 * Merge a python.pip or python.conda list across plugins. Each entry is
 * a string of the form `package==version`, `package>=version`, or just
 * `package`. Conflicts are detected when the same package (the prefix
 * before the version specifier) appears with different specifiers.
 */
function mergePython(sources, kind /* "pip" | "conda" */) {
    /** @type {Record<string, Array<{plugin:string, entry:string}>>} */
    const seen = {};
    for (const { plugin, deps } of sources) {
        if (!deps || !deps.python || !Array.isArray(deps.python[kind])) continue;
        for (const entry of deps.python[kind]) {
            const pkg = String(entry)
                .split(/[<>=!~ ]/)[0]
                .trim()
                .toLowerCase();
            if (!pkg) continue;
            if (!seen[pkg]) seen[pkg] = [];
            seen[pkg].push({ plugin, entry });
        }
    }
    const merged = [];
    const conflicts = [];
    for (const [pkg, claims] of Object.entries(seen)) {
        const uniqEntries = Array.from(new Set(claims.map((c) => c.entry)));
        if (uniqEntries.length > 1) {
            conflicts.push({
                kind,
                package: pkg,
                claims,
            });
        }
        merged.push(uniqEntries[0]);
    }
    merged.sort();
    return { merged, conflicts };
}

/**
 * Apply override semantics that mirror `API/updateTools.js` and
 * `API/setups.js`: a plugin/private entry with the same directory
 * name as a standard entry replaces the standard one entirely.
 *
 * Returns the post-override set of plugin records — the standard
 * entries that were *not* overridden, plus all plugin/private
 * entries. Aggregating dependencies from this set (rather than from
 * `standard.concat(overrides)`) prevents an override that bumps a
 * package version from spuriously conflicting with the standard
 * entry it's intended to replace.
 *
 * @template T
 * @param {Array<{name:string} & T>} standard  Standard plugins.
 * @param {Array<{name:string} & T>} overrides  Plugin/private plugins
 *   that override standard entries by directory name.
 * @returns {Array<{name:string} & T>}
 */
function winnersByName(standard, overrides) {
    const byName = new Map();
    for (const p of standard) byName.set(p.name, p);
    for (const p of overrides) byName.set(p.name, p);
    return Array.from(byName.values());
}

/**
 * Discover all plugin manifests and return an array of
 * `{ plugin: <displayName>, deps: <dependencies-block-or-null> }`.
 *
 * Validation of `dependencies` happens here so a malformed block is
 * surfaced clearly rather than producing weird merge output.
 */
function gatherDependencies() {
    const out = [];
    const errors = [];

    const toolStandard = discoverPlugins(
        ESSENCE_PATH,
        ["__exact:Tools"],
        "config.json",
        { loggerCategory: "PluginDeps" }
    );
    const toolPlugins = discoverPlugins(
        ESSENCE_PATH,
        ["Private-Tools", "Plugin-Tools"],
        "config.json",
        { loggerCategory: "PluginDeps" }
    );
    const componentStandard = discoverPlugins(
        ESSENCE_PATH,
        ["__exact:Components"],
        "config.json",
        { loggerCategory: "PluginDeps" }
    );
    const componentPlugins = discoverPlugins(
        ESSENCE_PATH,
        ["Private-Components", "Plugin-Components"],
        "config.json",
        { loggerCategory: "PluginDeps" }
    );
    // For backends we scan by setup.js presence but don't `require()`
    // the modules — see depsForBackend() for the rationale.
    const backendStandard = discoverPlugins(
        API_PATH,
        ["__exact:Backend"],
        "setup.js",
        { loader: "none", loggerCategory: "PluginDeps" }
    );
    const backendPlugins = discoverPlugins(
        API_PATH,
        ["Private-Backend", "Plugin-Backend"],
        "setup.js",
        { loader: "none", loggerCategory: "PluginDeps" }
    );

    const pushManifest = (label, plugin, deps) => {
        if (!deps) return;
        const verrors = validateDependencies(deps, label);
        if (verrors.length > 0) {
            errors.push(...verrors);
            return;
        }
        out.push({ plugin: label, deps });
    };

    // Only aggregate dependencies from the *winning* (post-override)
    // entry per plugin name — see `winnersByName` for the rationale.
    for (const p of winnersByName(toolStandard, toolPlugins)) {
        pushManifest(`tool:${p.name}`, p, depsFromManifest(p.manifest));
    }
    for (const p of winnersByName(componentStandard, componentPlugins)) {
        pushManifest(`component:${p.name}`, p, depsFromManifest(p.manifest));
    }
    for (const p of winnersByName(backendStandard, backendPlugins)) {
        pushManifest(`backend:${p.name}`, p, depsForBackend(p));
    }

    return { sources: out, errors };
}

function formatConflicts(conflicts) {
    return conflicts
        .map((c) => {
            const lines = c.claims
                .map((claim) => `      - ${claim.plugin}: ${claim.entry || claim.version}`)
                .join("\n");
            return `  * ${c.kind} package '${c.package}' declared with conflicting versions:\n${lines}`;
        })
        .join("\n");
}

/**
 * Main entry point. Returns the resolved-plugin-deps summary object
 * (useful in tests). Throws on validation errors or version conflicts.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.write=true]  Whether to write the output files.
 * @param {(msg:string) => void} [opts.log]  Optional logger override.
 */
function resolvePluginDeps(opts = {}) {
    const { write = true, log = (m) => console.log(m) } = opts;

    const { sources, errors } = gatherDependencies();
    if (errors.length > 0) {
        const msg =
            "Plugin dependency validation failed:\n" +
            errors.map((e) => `  * ${e}`).join("\n");
        throw new Error(msg);
    }

    const npm = mergeNpm(sources);
    const pip = mergePython(sources, "pip");
    const conda = mergePython(sources, "conda");

    const allConflicts = [
        ...npm.conflicts,
        ...pip.conflicts,
        ...conda.conflicts,
    ];
    if (allConflicts.length > 0) {
        throw new Error(
            "Plugin dependency conflicts detected:\n" +
                formatConflicts(allConflicts) +
                "\nResolve by aligning version specifiers across plugins, or removing the duplicated declaration."
        );
    }

    const npmPackageJson = {
        name: "mmgis-plugin-deps",
        private: true,
        description:
            "Generated by scripts/resolve-plugin-deps.js — aggregates npm dependencies declared by MMGIS plugins. Do not edit by hand.",
        dependencies: Object.keys(npm.merged)
            .sort()
            .reduce((acc, k) => {
                acc[k] = npm.merged[k];
                return acc;
            }, {}),
    };

    if (write) {
        fs.writeFileSync(
            OUTPUT_NPM,
            JSON.stringify(npmPackageJson, null, 4) + "\n"
        );
        fs.writeFileSync(
            OUTPUT_PIP,
            "# Generated by scripts/resolve-plugin-deps.js — do not edit.\n" +
                pip.merged.join("\n") +
                (pip.merged.length ? "\n" : "")
        );
        fs.writeFileSync(
            OUTPUT_CONDA,
            "# Generated by scripts/resolve-plugin-deps.js — do not edit.\n" +
                conda.merged.join("\n") +
                (conda.merged.length ? "\n" : "")
        );
        log(
            `Wrote ${Object.keys(npm.merged).length} npm dep(s), ${pip.merged.length} pip dep(s), ${conda.merged.length} conda dep(s).`
        );
    }

    return {
        npm: npmPackageJson,
        pip: pip.merged,
        conda: conda.merged,
    };
}

if (require.main === module) {
    try {
        resolvePluginDeps();
    } catch (err) {
        console.error(err.message || err);
        process.exit(1);
    }
}

module.exports = {
    resolvePluginDeps,
    mergeNpm,
    mergePython,
    winnersByName,
    gatherDependencies,
    OUTPUT_NPM,
    OUTPUT_PIP,
    OUTPUT_CONDA,
};
