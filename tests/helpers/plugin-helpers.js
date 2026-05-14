/**
 * Test helpers for installing fixture plugins into the live MMGIS source
 * tree (`src/essence/*Plugin-Tools*`, `src/essence/*Plugin-Components*`,
 * `API/*Plugin-Backend*`) and cleaning them up afterwards.
 *
 * These helpers are designed for **unit and E2E tests only** — they
 * physically copy directories into the source tree, so tests that use
 * them must run sequentially or in a context where the working tree is
 * otherwise undisturbed. Always pair `installFixturePlugin` with
 * `uninstallFixturePlugin` in a `finally` block (or a Playwright
 * `afterEach`/`afterAll` hook) to avoid leaving stray plugin directories
 * behind.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

/**
 * Recursively copy a directory. Uses `fs.cpSync` when available
 * (Node >= 16.7) and falls back to a manual walk otherwise.
 */
function copyDir(src, dest) {
    if (typeof fs.cpSync === 'function') {
        fs.cpSync(src, dest, { recursive: true });
        return;
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Recursively delete a directory if it exists. Wraps `fs.rmSync` with a
 * safety guard so callers can't accidentally pass paths outside of
 * `src/essence/` or `API/`.
 */
function safeRmDir(target) {
    const resolved = path.resolve(target);
    const allowedRoots = [
        path.resolve(repoRoot, 'src', 'essence'),
        path.resolve(repoRoot, 'API'),
    ];
    const inside = allowedRoots.some((root) =>
        resolved === root || resolved.startsWith(root + path.sep)
    );
    if (!inside) {
        throw new Error(
            `safeRmDir refusing to delete ${resolved} — outside allowed plugin roots`
        );
    }
    if (!fs.existsSync(resolved)) return;
    fs.rmSync(resolved, { recursive: true, force: true });
}

/**
 * Resolve the on-disk plugin directory for a given plugin type. The
 * returned path is the *container* directory (e.g.
 * `src/essence/Plugin-Tools-Test`) that holds individual plugin
 * subdirectories.
 *
 * @param {"tool"|"component"|"backend"} pluginType
 * @param {string} containerName  Container directory name. Must match
 *   the MMGIS plugin-discovery patterns (see CONTRIBUTING.md).
 */
function pluginContainerPath(pluginType, containerName) {
    if (pluginType === 'tool') {
        if (!/(Private-Tools|Plugin-Tools)/.test(containerName)) {
            throw new Error(
                `Tool plugin container '${containerName}' must include 'Private-Tools' or 'Plugin-Tools'`
            );
        }
        return path.join(repoRoot, 'src', 'essence', containerName);
    }
    if (pluginType === 'component') {
        if (!/(Private-Components|Plugin-Components)/.test(containerName)) {
            throw new Error(
                `Component plugin container '${containerName}' must include 'Private-Components' or 'Plugin-Components'`
            );
        }
        return path.join(repoRoot, 'src', 'essence', containerName);
    }
    if (pluginType === 'backend') {
        if (!/(Private-Backend|Plugin-Backend)/.test(containerName)) {
            throw new Error(
                `Backend plugin container '${containerName}' must include 'Private-Backend' or 'Plugin-Backend'`
            );
        }
        return path.join(repoRoot, 'API', containerName);
    }
    throw new Error(`Unknown plugin type: ${pluginType}`);
}

/**
 * Install a fixture plugin into the live source tree.
 *
 * @param {object} opts
 * @param {"tool"|"component"|"backend"} opts.pluginType
 * @param {string} opts.containerName  Container directory name, e.g.
 *   `'Plugin-Tools-Test'`.
 * @param {string} opts.fixtureName  Name of the fixture directory under
 *   `tests/fixtures/test-plugin-tools/` (or another fixture root).
 * @param {string} [opts.installAs]  Optional override for the installed
 *   directory name. Defaults to `fixtureName`. Use this when you want a
 *   fixture to be discovered under a different name (e.g. to override a
 *   standard tool by installing `OverridePlugin` as `Identifier`).
 * @param {string} [opts.fixturesDir]  Override fixtures root. Defaults
 *   to `tests/fixtures/test-plugin-tools`.
 * @returns {string} Absolute path to the installed plugin directory.
 */
function installFixturePlugin(opts) {
    const {
        pluginType,
        containerName,
        fixtureName,
        installAs,
        fixturesDir = path.join(fixturesRoot, 'test-plugin-tools'),
    } = opts;

    const src = path.join(fixturesDir, fixtureName);
    if (!fs.existsSync(src)) {
        throw new Error(`Fixture plugin not found at ${src}`);
    }
    const container = pluginContainerPath(pluginType, containerName);
    const dest = path.join(container, installAs || fixtureName);
    fs.mkdirSync(container, { recursive: true });
    copyDir(src, dest);
    return dest;
}

/**
 * Remove an installed fixture plugin (and, optionally, its empty
 * container directory).
 */
function uninstallFixturePlugin(opts) {
    const { pluginType, containerName, fixtureName, removeContainer = true } = opts;
    const container = pluginContainerPath(pluginType, containerName);
    safeRmDir(path.join(container, fixtureName));
    if (removeContainer && fs.existsSync(container)) {
        try {
            const remaining = fs.readdirSync(container);
            if (remaining.length === 0) safeRmDir(container);
        } catch {
            // ignore — best-effort cleanup
        }
    }
}

/**
 * Remove an entire plugin container directory (and everything inside).
 * Useful when a test suite installed several fixtures under the same
 * container and wants to wipe them all in one shot.
 */
function uninstallContainer(pluginType, containerName) {
    safeRmDir(pluginContainerPath(pluginType, containerName));
}

module.exports = {
    installFixturePlugin,
    uninstallFixturePlugin,
    uninstallContainer,
    pluginContainerPath,
    repoRoot,
    fixturesRoot,
};
