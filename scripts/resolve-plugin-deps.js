/**
 * Aggregate per-plugin dependencies into generated build artifacts.
 *
 * Scans every tool, component, and backend plugin for an optional
 * `dependencies` block in its plugin.json manifest
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
const PLUGINS_ROOT = path.join(REPO_ROOT, "plugins");

const OUTPUT_NPM = path.join(REPO_ROOT, "plugin-package.json");
const OUTPUT_PIP = path.join(REPO_ROOT, "plugin-python-requirements.txt");
const OUTPUT_CONDA = path.join(REPO_ROOT, "plugin-conda-deps.txt");

/**
 * Read `dependencies` from a plugin's parsed plugin.json manifest.
 */
function depsFromManifest(manifest) {
    return (manifest && manifest.dependencies) || null;
}

/**
 * For backend plugins: dependencies now live directly in the backend's
 * `plugin.json` manifest (which is parsed during discovery).
 */
function depsForBackend(plugin) {
    return depsFromManifest(plugin.manifest);
}

/**
 * Merge npm deps from many plugins using semver-aware conflict resolution.
 *
 * When multiple plugins request the same package:
 *   - If their version ranges intersect, pick the narrowest satisfying range.
 *   - If ranges are incompatible, flag as a conflict.
 */
function mergeNpm(sources) {
    const semver = require("semver");

    /** @type {Record<string, string>} */
    const merged = {};
    /** @type {Record<string, Array<{plugin:string, version:string}>>} */
    const seen = {};
    for (const { plugin, deps } of sources) {
        if (!deps || !deps.npm) continue;
        for (const [pkg, version] of Object.entries(deps.npm)) {
            if (!seen[pkg]) seen[pkg] = [];
            seen[pkg].push({ plugin, version: String(version) });
        }
    }

    const conflicts = [];
    for (const [pkg, claims] of Object.entries(seen)) {
        const versions = Array.from(new Set(claims.map((c) => c.version)));
        if (versions.length === 1) {
            merged[pkg] = versions[0];
        } else {
            // Check pairwise compatibility using semver.intersects().
            let compatible = true;
            for (let i = 0; i < versions.length && compatible; i++) {
                for (let j = i + 1; j < versions.length && compatible; j++) {
                    if (!semver.intersects(versions[i], versions[j])) {
                        compatible = false;
                    }
                }
            }
            if (compatible) {
                // Ranges intersect — pick the one with the highest lower bound.
                const sorted = [...versions].sort((a, b) => {
                    const minA = semver.minVersion(a);
                    const minB = semver.minVersion(b);
                    if (minA && minB) return semver.compare(minB, minA);
                    return 0;
                });
                merged[pkg] = sorted[0];
            } else {
                // Ranges are incompatible — use first-seen and flag conflict.
                merged[pkg] = versions[0];
                conflicts.push({
                    kind: "npm",
                    package: pkg,
                    claims,
                });
            }
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
 * Discover all plugin manifests and return an array of
 * `{ plugin: <displayName>, deps: <dependencies-block-or-null> }`.
 *
 * Uses discoverPlugins() for a single-pass scan of the
 * three-level plugins/ hierarchy. The unified scan already handles
 * ordering (core first, then alphabetical) so later entries
 * naturally override earlier ones by name.
 *
 * Validation of `dependencies` happens here so a malformed block is
 * surfaced clearly rather than producing weird merge output.
 */
function gatherDependencies() {
    const out = [];
    const errors = [];

    const allTools = discoverPlugins(
        PLUGINS_ROOT, "tools", "plugin.json",
        { loggerCategory: "PluginDeps" }
    );
    const allComponents = discoverPlugins(
        PLUGINS_ROOT, "components", "plugin.json",
        { loggerCategory: "PluginDeps" }
    );
    const allBackends = discoverPlugins(
        PLUGINS_ROOT, "backend", "plugin.json",
        { loggerCategory: "PluginDeps" }
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

    // Deduplicate by name (last scanned wins — matches unified ordering).
    const dedup = (plugins) => {
        const byName = new Map();
        for (const p of plugins) byName.set(p.name, p);
        return Array.from(byName.values());
    };

    for (const p of dedup(allTools)) {
        pushManifest(`tool:${p.name}`, p, depsFromManifest(p.manifest));
    }
    for (const p of dedup(allComponents)) {
        pushManifest(`component:${p.name}`, p, depsFromManifest(p.manifest));
    }
    for (const p of dedup(allBackends)) {
        pushManifest(`backend:${p.name}`, p, depsForBackend(p));
    }

    const allPlugins = [...dedup(allTools), ...dedup(allComponents), ...dedup(allBackends)];
    return { sources: out, errors, allPlugins };
}

/**
 * Check peerDependencies across all plugins.
 *
 * peerDependencies declare inter-plugin relationships:
 *   "peerDependencies": { "core-draw": ">=5.0.0" }
 *
 * This validates that every referenced peer plugin exists and its
 * version satisfies the declared range.
 */
function checkPeerDependencies(allPlugins) {
    const semver = require("semver");
    const warnings = [];

    // Resolve "core" → actual MMGIS version so semver checks work.
    let mmgisVersion;
    try {
        mmgisVersion = require(path.join(__dirname, "..", "package.json")).version;
    } catch {
        mmgisVersion = "0.0.0";
    }

    // Build a lookup of all plugin IDs to their versions.
    const pluginVersions = new Map();
    for (const p of allPlugins) {
        if (p.manifest && p.manifest.id) {
            const v = p.manifest.version === "core" ? mmgisVersion : (p.manifest.version || "0.0.0");
            pluginVersions.set(p.manifest.id, v);
        }
    }

    for (const p of allPlugins) {
        if (!p.manifest || !p.manifest.peerDependencies) continue;
        const pluginLabel = p.manifest.id || p.name;

        for (const [peerId, versionRange] of Object.entries(p.manifest.peerDependencies)) {
            if (!pluginVersions.has(peerId)) {
                warnings.push(
                    `Plugin '${pluginLabel}' declares peerDependency on '${peerId}' which is not installed`
                );
                continue;
            }
            const peerVersion = semver.coerce(pluginVersions.get(peerId));
            if (peerVersion && versionRange && !semver.satisfies(peerVersion, versionRange)) {
                warnings.push(
                    `Plugin '${pluginLabel}' requires peer '${peerId}' ${versionRange} but found ${pluginVersions.get(peerId)}`
                );
            }
        }
    }

    return warnings;
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

    const { sources, errors, allPlugins } = gatherDependencies();
    if (errors.length > 0) {
        const msg =
            "Plugin dependency validation failed:\n" +
            errors.map((e) => `  * ${e}`).join("\n");
        throw new Error(msg);
    }

    // Check peerDependencies (warn but don't fail).
    const peerWarnings = checkPeerDependencies(allPlugins);
    for (const w of peerWarnings) {
        log(`  ⚠ ${w}`);
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
    checkPeerDependencies,
    gatherDependencies,
    OUTPUT_NPM,
    OUTPUT_PIP,
    OUTPUT_CONDA,
};
