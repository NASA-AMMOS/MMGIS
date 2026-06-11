/**
 * Install the npm dependencies aggregated by `scripts/resolve-plugin-deps.js`
 * into the root `node_modules` WITHOUT touching `package.json` or
 * `package-lock.json`.
 *
 * Intended to run from the `postinstall` script of the root
 * `package.json` so that a plain `npm install` on a fresh clone (or
 * after a plugin is added/removed) automatically pulls in every
 * plugin's declared npm deps.
 *
 * Behaviour:
 *   - Reads `plugin-package.json` from the repo root.
 *   - If the file is missing, empty, or has no `dependencies`, exits 0
 *     silently (no plugins declared npm deps — normal state for stock
 *     MMGIS).
 *   - Otherwise invokes
 *     `npm install <pkg@ver> ... --no-save --no-package-lock --ignore-scripts`.
 *     `--no-save` / `--no-package-lock` keep the root lockfile clean.
 *     `--ignore-scripts` prevents re-entering this postinstall (and
 *     also skips the lifecycle scripts of the installed packages,
 *     matching the Dockerfile's behaviour).
 *
 * This script is safe to run repeatedly: re-installing the same
 * versions is a no-op for npm.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(REPO_ROOT, "plugin-package.json");

function done(msg) {
    if (msg) console.log(msg);
    process.exit(0);
}

if (!fs.existsSync(MANIFEST)) {
    done(
        "[install-plugin-deps] plugin-package.json not found — skipping. " +
            "Run `node scripts/resolve-plugin-deps.js` first if you have " +
            "plugin tools that declare dependencies."
    );
}

let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
} catch (err) {
    console.error(
        "[install-plugin-deps] Failed to parse plugin-package.json:",
        err.message
    );
    // Don't fail the parent `npm install` — the user can re-run
    // `scripts/resolve-plugin-deps.js` to regenerate the file.
    process.exit(0);
}

const deps = (manifest && manifest.dependencies) || {};
const entries = Object.entries(deps);

if (entries.length === 0) {
    done("[install-plugin-deps] No plugin npm dependencies to install.");
}

// Skip plugin deps already declared (with the same version specifier)
// in the root package.json. This avoids churning the dependency tree
// for transitional cases where a tool's deps are mirrored in both
// places.
const ROOT_PKG = path.join(REPO_ROOT, "package.json");
let rootDeps = {};
let rootOverriddenNames = new Set();
try {
    const rootPkg = JSON.parse(fs.readFileSync(ROOT_PKG, "utf8"));
    rootDeps = Object.assign(
        {},
        rootPkg.dependencies || {},
        rootPkg.devDependencies || {},
        rootPkg.optionalDependencies || {}
    );
    // Collect package names covered by root overrides (keys may be bare names
    // like "ajv" or versioned selectors like "ajv@^8" — extract the name part).
    for (const key of Object.keys(rootPkg.overrides || {})) {
        rootOverriddenNames.add(key.split("@")[0] || key);
    }
} catch {
    // Fall through with empty rootDeps — we'll install everything.
}

const filtered = entries.filter(([name, version]) => {
    // Skip if already a direct dep with the same specifier.
    if (rootDeps[name] === version) return false;
    // Skip if the root package.json already has an override for this package —
    // installing it as a direct dep would conflict with that override.
    if (rootOverriddenNames.has(name)) return false;
    return true;
});
const skipped = entries.length - filtered.length;

if (filtered.length === 0) {
    done(
        `[install-plugin-deps] All ${entries.length} plugin npm dependenc${
            entries.length === 1 ? "y is" : "ies are"
        } already satisfied by the root package.json — nothing to do.`
    );
}

if (skipped > 0) {
    console.log(
        `[install-plugin-deps] ${skipped} plugin npm dependenc${
            skipped === 1 ? "y" : "ies"
        } already satisfied by the root package.json; skipping ${
            skipped === 1 ? "it" : "them"
        }.`
    );
}

const specs = filtered.map(([name, version]) => `${name}@${version}`);
console.log(
    `[install-plugin-deps] Installing ${specs.length} plugin npm dependenc${
        specs.length === 1 ? "y" : "ies"
    }:`
);
for (const spec of specs) console.log("  -", spec);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
    npmCmd,
    [
        "install",
        "--no-save",
        "--no-package-lock",
        "--ignore-scripts",
        ...specs,
    ],
    {
        stdio: "inherit",
        cwd: REPO_ROOT,
        // Forward inherited env. No special vars needed because
        // --ignore-scripts already prevents the inner install from
        // re-entering postinstall.
        env: process.env,
        // On Windows, .cmd files require shell:true to be invocable via spawnSync.
        shell: process.platform === "win32",
    }
);

if (result.error) {
    console.error("[install-plugin-deps] npm install failed:", result.error);
    process.exit(1);
}
process.exit(result.status || 0);
