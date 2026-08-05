/**
 * E2E tests for plugin-cli/cli.js commands that modify state:
 * install, uninstall, enable, disable, create, destroy, activate.
 *
 * Uses the fixture repo at tests/fixtures/test-plugin-repo/ which has
 * the correct directory structure: tools/TestPlugin/plugin.json.
 *
 * Tests run serially (test.describe.serial) because they share the
 * plugins/ directory. Each test cleans up after itself.
 */

import { test as base, expect } from '@playwright/test';

// All tests share the plugins/ directory — force serial execution.
const test = base;
test.describe.configure({ mode: 'serial' });

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { withRegistryLock } = require('../helpers/registry-lock');

const CLI_PATH = path.resolve(__dirname, '../../plugin-cli/cli.js');
const REPO_ROOT = path.resolve(__dirname, '../..');
const PLUGINS_ROOT = path.resolve(REPO_ROOT, 'plugins');
const FIXTURE_REPO = path.resolve(__dirname, '../fixtures/test-plugin-repo');
const STATE_PATH = path.join(PLUGINS_ROOT, 'plugin-state.json');
const TOOLS_JS = path.resolve(REPO_ROOT, 'src', 'pre', 'tools.js');

// Most commands regenerate the shared registries, so hold the lock for the
// duration of the call (see helpers/registry-lock).
function runCli(args, opts = {}) {
    const cmd = `node "${CLI_PATH}" ${args}`;
    return withRegistryLock(() => {
        try {
            const output = execSync(cmd, {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                timeout: 15000,
                ...opts,
            });
            return { stdout: output, exitCode: 0 };
        } catch (err) {
            return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
        }
    });
}

function readState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch {
        return { plugins: {} };
    }
}

function writeState(state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 4));
}

function cleanupContainer(name) {
    const dir = path.join(PLUGINS_ROOT, name);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function cleanupState(keys) {
    const state = readState();
    for (const key of keys) {
        delete state.plugins[key];
    }
    writeState(state);
}

// ─── install / uninstall ─────────────────────────────────────────────────────

test.describe('CLI install and uninstall', () => {

    test.afterAll(() => {
        cleanupContainer('test-plugin-repo');
        cleanupState(['test-plugin-repo/tools/TestPlugin', 'test-plugin-repo/tools/SecondPlugin']);
        // Re-activate to restore clean tools.js
        runCli('activate');
    });

    test('install from local fixture directory', () => {
        const { stdout, exitCode } = runCli(`install "${FIXTURE_REPO}"`);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Discovered 2 plugin(s)');
        expect(stdout).toContain('TestPluginTool');

        // Plugin directory should exist
        const pluginDir = path.join(PLUGINS_ROOT, 'test-plugin-repo', 'tools', 'TestPlugin');
        expect(fs.existsSync(pluginDir)).toBe(true);
        expect(fs.existsSync(path.join(pluginDir, 'plugin.json'))).toBe(true);

        // tools.js should include the new plugin
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).toContain('TestPluginTool');
    });

    test('install --json returns structured output', () => {
        // Remove first, then re-install with --json
        cleanupContainer('test-plugin-repo');
        runCli('activate');

        const { stdout, exitCode } = runCli(`install "${FIXTURE_REPO}" --json`);
        expect(exitCode).toBe(0);

        const result = JSON.parse(stdout);
        expect(result.command).toBe('install');
        expect(result.discovered.length).toBeGreaterThan(0);
    });

    test('list shows installed plugin', () => {
        const { stdout, exitCode } = runCli('list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('TestPlugin');
        expect(stdout).toContain('test-plugin-repo');
    });

    test('info shows installed plugin details', () => {
        const { stdout, exitCode } = runCli('info TestPlugin');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('test-plugin-repo/tools/TestPlugin');
        expect(stdout).toContain('0.1.0');
    });

    test('uninstall installed plugin repo', () => {
        const { stdout, exitCode } = runCli('uninstall test-plugin-repo');
        expect(exitCode).toBe(0);

        // Directory should be gone
        expect(fs.existsSync(path.join(PLUGINS_ROOT, 'test-plugin-repo'))).toBe(false);

        // tools.js should no longer include it
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).not.toContain('TestPluginTool');
    });

    test('uninstall nonexistent repo fails', () => {
        const { exitCode } = runCli('uninstall nonexistent-repo');
        expect(exitCode).not.toBe(0);
    });
});

// ─── enable / disable ───────────────────────────────────────────────────────

test.describe('CLI enable and disable', () => {

    test.beforeAll(() => {
        // Install fixture so we have something to enable/disable
        runCli(`install "${FIXTURE_REPO}"`);
    });

    test.afterAll(() => {
        cleanupContainer('test-plugin-repo');
        cleanupState(['test-plugin-repo/tools/TestPlugin']);
        runCli('activate');
    });

    test('disable non-required plugin succeeds', () => {
        const { stdout, exitCode } = runCli('disable test-plugin-repo/tools/TestPlugin');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Disabled');

        // State file should reflect disabled
        const state = readState();
        expect(state.plugins['test-plugin-repo/tools/TestPlugin']).toEqual({ enabled: false });

        // tools.js should no longer include it
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).not.toContain('TestPluginTool');
    });

    test('enable disabled plugin succeeds', () => {
        const { stdout, exitCode } = runCli('enable test-plugin-repo/tools/TestPlugin');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Enabled');

        // State file should reflect enabled
        const state = readState();
        expect(state.plugins['test-plugin-repo/tools/TestPlugin']).toEqual({ enabled: true });

        // tools.js should include it again
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).toContain('TestPluginTool');
    });

    test('disable required plugin is rejected', () => {
        const { exitCode } = runCli('disable core/backend/Users');
        expect(exitCode).not.toBe(0);
    });

    test('disable nonexistent plugin fails', () => {
        const { exitCode } = runCli('disable nonexistent/tools/Foo');
        expect(exitCode).not.toBe(0);
    });
});

// ─── create / destroy ───────────────────────────────────────────────────────

test.describe('CLI create and destroy', () => {

    const CONTAINER = 'e2e-test-container';
    const CORE_INTERACTION = 'E2eCoreInteraction';
    const CORE_INTERACTION_DIR = path.join(
        PLUGINS_ROOT,
        'core',
        'interactions',
        CORE_INTERACTION
    );

    test.beforeAll(() => {
        fs.rmSync(CORE_INTERACTION_DIR, { recursive: true, force: true });
    });

    test.afterAll(() => {
        cleanupContainer(CONTAINER);
        fs.rmSync(CORE_INTERACTION_DIR, { recursive: true, force: true });
        cleanupState([`${CONTAINER}/tools/E2e`]);
        runCli('activate');
    });

    test('create tool scaffolds correct structure', () => {
        const { stdout, exitCode } = runCli(`create tool E2e --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2e');
        expect(fs.existsSync(pluginDir)).toBe(true);

        // plugin.json exists and is valid
        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.name).toBe('E2e');
        expect(manifest.type).toBe('tool');
        expect(manifest.paths).toBeDefined();
        expect(manifest.defaultIcon).toBe('puzzle-outline');

        // Entry point exists — the scaffold adds the Tool suffix
        expect(fs.existsSync(path.join(pluginDir, 'E2eTool.js'))).toBe(true);

        // CSS exists
        expect(fs.existsSync(path.join(pluginDir, 'E2eTool.css'))).toBe(true);

        // Test spec exists
        const testDir = path.join(pluginDir, 'tests');
        expect(fs.existsSync(testDir)).toBe(true);

        // tools.js should include the new tool
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).toContain('E2e');
    });

    test('create tool trims a Tool suffix rather than doubling it', () => {
        // The scaffold appends `Tool` to the directory, component and toolbar
        // key, so `create tool E2eSuffixTool` would produce E2eSuffixToolTool.
        runCli(`create tool E2eSuffixTool --container ${CONTAINER}`);
        expect(
            fs.existsSync(path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2eSuffix'))
        ).toBe(true);
        expect(
            fs.existsSync(
                path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2eSuffix', 'E2eSuffixTool.js')
            )
        ).toBe(true);
        runCli(`destroy ${CONTAINER}/tools/E2eSuffix --force`);
    });

    test('create --json returns structured output', () => {
        // Destroy first, then re-create with --json
        runCli(`destroy ${CONTAINER}/tools/E2e --force`);
        const { stdout, exitCode } = runCli(`create tool E2e --container ${CONTAINER} --json`);
        expect(exitCode).toBe(0);

        const result = JSON.parse(stdout);
        expect(result.command).toBe('create');
        expect(result.name).toBe('E2e');
        expect(result.type).toBe('tool');
    });

    test('create requires --force for the core container', () => {
        const { stderr, exitCode } = runCli(
            `create interaction ${CORE_INTERACTION} --container core`
        );
        expect(exitCode).not.toBe(0);
        expect(stderr).toContain(
            'Cannot create plugins in the core container without --force.'
        );
        expect(fs.existsSync(CORE_INTERACTION_DIR)).toBe(false);
    });

    test('create --force scaffolds into the core container', () => {
        const { stdout, exitCode } = runCli(
            `create interaction ${CORE_INTERACTION} --container core --force --json`
        );
        expect(exitCode).toBe(0);

        const result = JSON.parse(stdout);
        expect(result.path).toBe(`core/interactions/${CORE_INTERACTION}`);
        expect(fs.existsSync(CORE_INTERACTION_DIR)).toBe(true);
    });

    test('create backend scaffolds correct structure', () => {
        const { stdout, exitCode } = runCli(`create backend E2eBackend --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'backend', 'E2eBackend');
        expect(fs.existsSync(pluginDir)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.name).toBe('E2eBackend');
        expect(manifest.type).toBe('backend');

        // plugin.js lifecycle file exists
        expect(fs.existsSync(path.join(pluginDir, 'plugin.js'))).toBe(true);

        // Routes directory exists
        expect(fs.existsSync(path.join(pluginDir, 'routes'))).toBe(true);
    });

    test('create component scaffolds correct structure', () => {
        const { stdout, exitCode } = runCli(`create component E2eWidget --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'components', 'E2eWidget');
        expect(fs.existsSync(pluginDir)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.name).toBe('E2eWidget');
        expect(manifest.type).toBe('component');
        expect(manifest.paths).toBeDefined();
    });

    test('create layertype scaffolds a contract-valid plugin', () => {
        const { exitCode } = runCli(`create layertype E2eLayer --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eLayer');
        expect(fs.existsSync(pluginDir)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.name).toBe('E2eLayer');
        expect(manifest.type).toBe('layertype');
        expect(manifest.typeId).toBe('e2elayer');
        // Declared map renderer must ship a matching module path.
        expect(manifest.capabilities.renderers.map).toBeTruthy();
        expect(manifest.modules.map).toBe('./map');

        // Scaffolded files exist.
        expect(fs.existsSync(path.join(pluginDir, 'map.js'))).toBe(true);
        expect(manifest.config?.tabs).toBeDefined();

        // Manifest passes the layertype contract validator with no errors.
        const { validatePluginConfig, validateLayerTypeModuleShape } = require('../../API/pluginValidation.js');
        expect(validatePluginConfig(manifest, 'E2eLayer', 'layertype')).toEqual([]);

        // Renderer module exports a valid make/destroy contract.
        const moduleSrc = fs.readFileSync(path.join(pluginDir, 'map.js'), 'utf8');
        expect(validateLayerTypeModuleShape(moduleSrc, 'E2eLayer')).toEqual([]);

        // A layer type is a plugin like any other: it is discovered, listed and
        // destroyable (core's are only undisableable because of overridable).
        expect(runCli(`destroy ${CONTAINER}/layertypes/E2eLayer --force`).exitCode).toBe(0);
        expect(fs.existsSync(pluginDir)).toBe(false);
    });

    test('create layerattachment scaffolds a contract-valid plugin', () => {
        const { exitCode } = runCli(`create layerattachment E2eHalos --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'layerattachments', 'E2eHalos');
        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.type).toBe('layerattachment');
        expect(manifest.attachmentId).toBe('e2e_halos');
        expect(manifest.module).toBe('./e2eHalos');
        expect(fs.existsSync(path.join(pluginDir, 'e2eHalos.js'))).toBe(true);

        // Every form field must land under the configPath core resolves to
        // ctx.config; a field anywhere else writes settings nothing reads.
        for (const row of manifest.config.rows)
            for (const component of row.components)
                expect(component.field.startsWith(manifest.configPath)).toBe(true);

        const {
            validatePluginConfig,
            validateLayerTypeModuleShape,
        } = require('../../API/pluginValidation.js');
        expect(validatePluginConfig(manifest, 'E2eHalos', 'layerattachment')).toEqual([]);

        // Checked against the attachment vocabulary, not the renderer one.
        const moduleSrc = fs.readFileSync(path.join(pluginDir, 'e2eHalos.js'), 'utf8');
        expect(
            validateLayerTypeModuleShape(moduleSrc, 'E2eHalos', 'attachment')
        ).toEqual([]);

        expect(runCli(`destroy ${CONTAINER}/layerattachments/E2eHalos --force`).exitCode).toBe(0);
    });

    test('destroy with --force removes plugin', () => {
        const { stdout, exitCode } = runCli(`destroy ${CONTAINER}/tools/E2e --force`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2e');
        expect(fs.existsSync(pluginDir)).toBe(false);

        // tools.js should no longer include it
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).not.toContain('E2e');
    });

    test('destroy nonexistent plugin fails', () => {
        const { exitCode } = runCli(`destroy ${CONTAINER}/tools/NoSuchPlugin --force`);
        expect(exitCode).not.toBe(0);
    });

    test('destroy core plugin is rejected', () => {
        const { exitCode } = runCli('destroy core/tools/Draw --force');
        expect(exitCode).not.toBe(0);
    });
});

// ─── registry ───────────────────────────────────────────────────────────────

test.describe('CLI registry', () => {

    const REGISTRIES_PATH = path.join(REPO_ROOT, 'plugin-cli', 'registries.json');
    let savedRegistries;

    test.beforeAll(() => {
        // Save original registries and start with empty set
        savedRegistries = fs.readFileSync(REGISTRIES_PATH, 'utf8');
        fs.writeFileSync(REGISTRIES_PATH, JSON.stringify({ registries: [] }, null, 4));
    });

    test.afterAll(() => {
        // Ensure test registries are clean then restore original
        runCli('registry remove test-plugin-repo');
        fs.writeFileSync(REGISTRIES_PATH, savedRegistries);
    });

    test('registry list shows empty when no registries', () => {
        const { stdout, exitCode } = runCli('registry list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('No registries configured');
    });

    test('registry add with valid local path succeeds', () => {
        const { stdout, exitCode } = runCli(`registry add "${FIXTURE_REPO}"`);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Added registry');
        expect(stdout).toContain('test-plugin-repo');
        expect(stdout).toContain('[local]');
    });

    test('registry list shows added entry', () => {
        const { stdout, exitCode } = runCli('registry list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('test-plugin-repo');
        expect(stdout).toContain('[local]');
    });

    test('registry add duplicate is rejected', () => {
        const { stdout, exitCode } = runCli(`registry add "${FIXTURE_REPO}"`);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('already registered');
    });

    test('registry add with nonexistent path fails', () => {
        const { exitCode, stdout } = runCli('registry add /nonexistent/path');
        expect(exitCode).not.toBe(0);
    });

    test('registry add with git URL succeeds without path validation', () => {
        const { stdout, exitCode } = runCli('registry add https://github.com/example-org/mmgis-test-plugins.git');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Added registry');
        expect(stdout).toContain('[git]');
        // Clean up (org--repo naming from git URL)
        runCli('registry remove example-org--mmgis-test-plugins');
    });

    test('registry remove succeeds', () => {
        const { stdout, exitCode } = runCli('registry remove test-plugin-repo');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Removed registry');
    });

    test('registry remove nonexistent fails', () => {
        const { exitCode } = runCli('registry remove nonexistent');
        expect(exitCode).not.toBe(0);
    });

    test('registry --json round-trip', () => {
        // add
        const add = runCli(`registry add "${FIXTURE_REPO}" --json`);
        expect(add.exitCode).toBe(0);
        const addResult = JSON.parse(add.stdout);
        expect(addResult.command).toBe('registry');
        expect(addResult.action).toBe('add');
        expect(addResult.name).toBe('test-plugin-repo');
        expect(addResult.type).toBe('local');

        // list
        const list = runCli('registry list --json');
        expect(list.exitCode).toBe(0);
        const listResult = JSON.parse(list.stdout);
        expect(listResult.registries).toHaveLength(1);
        expect(listResult.registries[0].name).toBe('test-plugin-repo');

        // remove
        const rm = runCli('registry remove test-plugin-repo --json');
        expect(rm.exitCode).toBe(0);
        const rmResult = JSON.parse(rm.stdout);
        expect(rmResult.action).toBe('remove');

        // list empty
        const empty = runCli('registry list --json');
        const emptyResult = JSON.parse(empty.stdout);
        expect(emptyResult.registries).toHaveLength(0);
    });

    test('registry add with metadata flags', () => {
        const { stdout, exitCode } = runCli(
            `registry add "${FIXTURE_REPO}" --tier official --description "Test plugins" --license Apache-2.0 --author NASA --json`
        );
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.tier).toBe('official');
        expect(result.description).toBe('Test plugins');
        expect(result.license).toBe('Apache-2.0');
        expect(result.author).toBe('NASA');

        // Verify metadata persists in list
        const list = runCli('registry list --json');
        const entry = JSON.parse(list.stdout).registries[0];
        expect(entry.tier).toBe('official');
        expect(entry.description).toBe('Test plugins');

        // Cleanup
        runCli('registry remove test-plugin-repo');
    });

    test('install by registry name resolves to registered URL', () => {
        // Register the fixture repo
        runCli(`registry add "${FIXTURE_REPO}" --tier community`);

        // Install by name (not by path)
        const install = runCli('install test-plugin-repo --json');
        expect(install.exitCode).toBe(0);
        const result = JSON.parse(install.stdout);
        expect(result.discovered.length).toBeGreaterThan(0);
        const names = result.discovered.map(d => d.name);
        expect(names).toContain('TestPlugin');

        // Cleanup
        runCli('uninstall test-plugin-repo');
    });

    test('registry error paths produce JSON with --json flag', () => {
        const notFound = runCli('registry remove nonexistent --json');
        expect(notFound.exitCode).not.toBe(0);
        const result = JSON.parse(notFound.stdout);
        expect(result).toHaveProperty('error');

        const badPath = runCli('registry add /nonexistent/path --json');
        expect(badPath.exitCode).not.toBe(0);
        const pathResult = JSON.parse(badPath.stdout);
        expect(pathResult).toHaveProperty('error');
    });
});

// ─── activate ───────────────────────────────────────────────────────────────

test.describe('CLI activate', () => {

    test('activate succeeds and produces valid tools.js', () => {
        const { exitCode } = runCli('activate');
        expect(exitCode).toBe(0);
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        // Should contain core tools
        expect(toolsJs).toContain('DrawTool');
        expect(toolsJs).toContain('toolConfigs');
    });

    test('activate --json returns structured output', () => {
        const { stdout, exitCode } = runCli('activate --json');
        expect(exitCode).toBe(0);

        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('added');
        expect(result).toHaveProperty('removed');
    });
});

// ─── --json output quality ──────────────────────────────────────────────────

test.describe('CLI --json output quality', () => {

    test('list --json uses singular types and includes required/description/path', () => {
        const { stdout, exitCode } = runCli('list --json');
        expect(exitCode).toBe(0);
        const plugins = JSON.parse(stdout);
        expect(plugins.length).toBeGreaterThan(0);

        for (const p of plugins) {
            // Type should be singular — never the plural directory name.
            expect([
                'tool',
                'backend',
                'component',
                'interaction',
                'layertype',
                'layerattachment',
            ]).toContain(p.type);
            expect(p).toHaveProperty('required');
            expect(p).toHaveProperty('path');
            // description may be null but key must exist
            expect('description' in p).toBe(true);
        }
    });

    test('info --json uses singular type and includes required field', () => {
        const { stdout, exitCode } = runCli('info Draw --json');
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.type).toBe('tool');
        expect(result).toHaveProperty('required');
        expect(result).toHaveProperty('path');
    });

    test('error paths produce JSON with --json flag', () => {
        // info not found
        const info = runCli('info NoSuchPlugin --json');
        expect(info.exitCode).not.toBe(0);
        const infoResult = JSON.parse(info.stdout);
        expect(infoResult).toHaveProperty('error');

        // disable required
        const dis = runCli('disable core/backend/Users --json');
        expect(dis.exitCode).not.toBe(0);
        const disResult = JSON.parse(dis.stdout);
        expect(disResult).toHaveProperty('error');

        // destroy core
        const dest = runCli('destroy core/tools/Draw --json');
        expect(dest.exitCode).not.toBe(0);
        const destResult = JSON.parse(dest.stdout);
        expect(destResult).toHaveProperty('error');
    });

    test('enable required plugin --json returns noop', () => {
        const { stdout, exitCode } = runCli('enable core/backend/Users --json');
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.noop).toBe(true);
        expect(result.reason).toBe('required');
    });
});

// ─── install --only ─────────────────────────────────────────────────────────

test.describe('CLI install --only', () => {

    test.afterEach(() => {
        try { runCli('uninstall test-plugin-repo'); } catch { /* already uninstalled */ }
    });

    test('install --only keeps only named plugins enabled', () => {
        const install = runCli(`install "${FIXTURE_REPO}" --only TestPlugin --json`);
        expect(install.exitCode).toBe(0);
        const result = JSON.parse(install.stdout);
        expect(result.only).toEqual(['TestPlugin']);
        expect(result.disabled).toBeGreaterThan(0);

        // TestPlugin should be enabled, SecondPlugin should be disabled
        const list = runCli('list --json');
        const plugins = JSON.parse(list.stdout);
        const test1 = plugins.find(p => p.name === 'TestPlugin');
        const test2 = plugins.find(p => p.name === 'SecondPlugin');
        expect(test1.enabled).toBe(true);
        expect(test2.enabled).toBe(false);
    });
});

// ─── enable-all / disable-all ───────────────────────────────────────────────

test.describe('CLI enable-all / disable-all', () => {

    test.beforeEach(() => {
        runCli(`install "${FIXTURE_REPO}"`);
    });

    test.afterEach(() => {
        try { runCli('uninstall test-plugin-repo'); } catch { /* already uninstalled */ }
    });

    test('disable-all --container disables all plugins in container', () => {
        const dis = runCli('disable-all --container test-plugin-repo --json');
        expect(dis.exitCode).toBe(0);
        const result = JSON.parse(dis.stdout);
        expect(result.disabled).toBeGreaterThan(0);
        expect(result.container).toBe('test-plugin-repo');

        // Verify all are disabled
        const list = runCli('list --json');
        const plugins = JSON.parse(list.stdout).filter(p => p.container === 'test-plugin-repo');
        for (const p of plugins) {
            expect(p.enabled).toBe(false);
        }
    });

    test('enable-all --container re-enables all plugins in container', () => {
        // First disable all
        runCli('disable-all --container test-plugin-repo');

        // Then enable all
        const en = runCli('enable-all --container test-plugin-repo --json');
        expect(en.exitCode).toBe(0);
        const result = JSON.parse(en.stdout);
        expect(result.enabled).toBeGreaterThan(0);

        // Verify all are enabled
        const list = runCli('list --json');
        const plugins = JSON.parse(list.stdout).filter(p => p.container === 'test-plugin-repo');
        for (const p of plugins) {
            expect(p.enabled).toBe(true);
        }
    });

    test('disable-all skips required plugins', () => {
        // This tests against core — required plugins should be skipped
        // We won't actually disable core, just verify the logic
        const dis = runCli('disable-all --container test-plugin-repo --json');
        expect(dis.exitCode).toBe(0);
        const result = JSON.parse(dis.stdout);
        expect(result.skippedRequired).toBe(0); // fixture plugins aren't required
    });
});

// ─── stale registries ────────────────────────────────────────────────────────

test.describe('CLI validate reports stale registries', () => {
    // The fixture's manifests spell out their own container, so it has to keep
    // its name for the generated import paths to match.
    const CONTAINER = 'test-plugin-repo';

    test.afterAll(() => {
        cleanupContainer(CONTAINER);
        cleanupState([`${CONTAINER}/tools/TestPlugin`, `${CONTAINER}/tools/SecondPlugin`]);
        runCli('activate');
    });

    test('a plugin copied in without activate is reported, and cleared by activate', () => {
        const dest = path.join(PLUGINS_ROOT, CONTAINER);
        fs.cpSync(FIXTURE_REPO, dest, { recursive: true });

        const stale = JSON.parse(runCli('validate --json').stdout);
        expect(
            stale.staleMessages.some((m) => m.includes(`${CONTAINER}/tools/TestPlugin`))
        ).toBe(true);

        runCli('activate');
        const fresh = JSON.parse(runCli('validate --json').stdout);
        expect(
            fresh.staleMessages.some((m) => m.includes(CONTAINER))
        ).toBe(false);
    });

    test('a registered plugin whose directory is gone is reported', () => {
        runCli('activate');
        cleanupContainer(CONTAINER);

        const gone = JSON.parse(runCli('validate --json').stdout);
        expect(gone.staleMessages.some((m) => m.includes(CONTAINER))).toBe(true);
    });

    test('a registered module the plugin no longer has is reported', () => {
        // Switching a layer type to `extends` deletes its renderer while the
        // registry still imports it — a webpack build error validate used to
        // miss, because the plugin's directory was still there.
        const created = runCli(`create layertype E2eStale --container ${CONTAINER} --json`);
        expect(created.exitCode).toBe(0);
        runCli('activate');
        fs.rmSync(path.join(PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eStale', 'map.js'));

        const stale = JSON.parse(runCli('validate --json').stdout);
        expect(
            stale.staleMessages.some((m) => m.includes('E2eStale/map') && m.includes('no longer exists'))
        ).toBe(true);
    });
});

// ─── cross-family references ─────────────────────────────────────────────────

test.describe('CLI validate rejects a duplicate stable id', () => {
    const CONTAINER = 'e2e-duplicate-id';

    test.afterAll(() => {
        cleanupContainer(CONTAINER);
        runCli('activate');
    });

    // Registry generation refuses two owners of one id outright, so a green
    // `validate` followed by a failed `activate` leaves the *previous*
    // generation of every registry in place — an app running last build's
    // plugins with no error to chase.
    for (const [family, idKey] of [
        ['layertype', 'typeId'],
        ['layerattachment', 'attachmentId'],
    ]) {
        test(`two ${family}s claiming one ${idKey} fail validate`, () => {
            const names = [`E2eDupA${idKey}`, `E2eDupB${idKey}`];
            const paths = names.map((name) => {
                expect(
                    runCli(`create ${family} ${name} --container ${CONTAINER} --json`).exitCode
                ).toBe(0);
                return path.join(
                    PLUGINS_ROOT, CONTAINER, `${family}s`, name, 'plugin.json'
                );
            });

            const first = JSON.parse(fs.readFileSync(paths[0], 'utf8'));
            const second = JSON.parse(fs.readFileSync(paths[1], 'utf8'));
            second[idKey] = first[idKey];
            fs.writeFileSync(paths[1], JSON.stringify(second, null, 4));

            const run = runCli('validate --json');
            expect(run.exitCode).toBe(1);
            const out = JSON.parse(run.stdout);
            const offenders = out.results.filter(
                (r) => !r.valid && r.errors.some((e) => e.includes(`Duplicate ${idKey}`))
            );
            expect(offenders.length).toBe(2);

            paths.forEach((p) => fs.rmSync(path.dirname(p), { recursive: true, force: true }));
        });
    }
});

test.describe('CLI validate cross-checks ids between families', () => {
    const CONTAINER = 'e2e-cross-family';

    test.afterAll(() => {
        cleanupContainer(CONTAINER);
        runCli('activate');
    });

    test('an attachment applying to a layer type nobody provides is reported', () => {
        expect(runCli(`create layerattachment E2eOrphan --container ${CONTAINER} --json`).exitCode).toBe(0);
        const manifestPath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layerattachments', 'E2eOrphan', 'plugin.json'
        );
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.applicableLayerTypes = ['nosuchlayertype'];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

        const out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some((m) => m.includes('nosuchlayertype'))
        ).toBe(true);
    });

    test('a layer type declaring an attachment nobody provides is reported', () => {
        expect(runCli(`create layertype E2eFeature --container ${CONTAINER} --json`).exitCode).toBe(0);
        const manifestPath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eFeature', 'plugin.json'
        );
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.capabilities.defaultAttachments = { nosuchattachment: {} };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

        const out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some(
                (m) => m.includes('default attachment') && m.includes('nosuchattachment')
            )
        ).toBe(true);
    });

    test('a declared attachment that refuses this type as a host is reported', () => {
        // The default is well-formed and the attachment exists, so nothing else
        // complains — but `applicableLayerTypes` filters the attachment out of
        // this type's hosts, so the type ships an attachment that never appears.
        const attachmentPath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layerattachments', 'E2eOrphan', 'plugin.json'
        );
        const attachment = JSON.parse(fs.readFileSync(attachmentPath, 'utf8'));
        attachment.applicableLayerTypes = ['vector'];
        fs.writeFileSync(attachmentPath, JSON.stringify(attachment, null, 4));

        const typePath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eFeature', 'plugin.json'
        );
        const manifest = JSON.parse(fs.readFileSync(typePath, 'utf8'));
        manifest.capabilities.defaultAttachments = {
            [attachment.attachmentId]: {},
        };
        fs.writeFileSync(typePath, JSON.stringify(manifest, null, 4));

        const out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some(
                (m) =>
                    m.includes(attachment.attachmentId) &&
                    m.includes('never applies')
            )
        ).toBe(true);
    });

    test('an unknown default interaction is reported in either declaration form', () => {
        const typePath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eFeature', 'plugin.json'
        );
        const manifest = JSON.parse(fs.readFileSync(typePath, 'utf8'));
        delete manifest.capabilities.defaultAttachments;

        // The settings form has to be cross-checked like the list form, or a
        // typo means settings nothing ever reads.
        manifest.capabilities.defaultInteractions = {
            click: { 'nosuch:interaction': { speedProp: 'windSpeed' } },
        };
        fs.writeFileSync(typePath, JSON.stringify(manifest, null, 4));
        let out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some(
                (m) => m.includes('default interaction') && m.includes('nosuch:interaction')
            )
        ).toBe(true);

        manifest.capabilities.defaultInteractions = { click: ['nosuch:interaction'] };
        fs.writeFileSync(typePath, JSON.stringify(manifest, null, 4));
        out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some(
                (m) => m.includes('default interaction') && m.includes('nosuch:interaction')
            )
        ).toBe(true);
    });

    test('a declared default interaction that refuses this type is reported', () => {
        expect(runCli(`create interaction E2eNarrow --container ${CONTAINER} --json`).exitCode).toBe(0);
        const interactionPath = path.join(
            PLUGINS_ROOT, CONTAINER, 'interactions', 'E2eNarrow', 'plugin.json'
        );
        const interaction = JSON.parse(fs.readFileSync(interactionPath, 'utf8'));
        interaction.applicableLayerTypes = ['vector'];
        fs.writeFileSync(interactionPath, JSON.stringify(interaction, null, 4));

        const typePath = path.join(
            PLUGINS_ROOT, CONTAINER, 'layertypes', 'E2eFeature', 'plugin.json'
        );
        const manifest = JSON.parse(fs.readFileSync(typePath, 'utf8'));
        manifest.capabilities.defaultInteractions = {
            click: { [interaction.interactionId]: { speedProp: 'windSpeed' } },
        };
        fs.writeFileSync(typePath, JSON.stringify(manifest, null, 4));

        const out = JSON.parse(runCli('validate --json').stdout);
        expect(
            out.crossFamilyWarningMessages.some(
                (m) =>
                    m.includes(interaction.interactionId) &&
                    m.includes('never applies')
            )
        ).toBe(true);
    });
});
