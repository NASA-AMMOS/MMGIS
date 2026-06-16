/**
 * E2E tests for plugin-cli.js commands that modify state:
 * install, remove, enable, disable, create, destroy, activate.
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

const CLI_PATH = path.resolve(__dirname, '../../plugins/plugin-cli.js');
const REPO_ROOT = path.resolve(__dirname, '../..');
const PLUGINS_ROOT = path.resolve(REPO_ROOT, 'plugins');
const FIXTURE_REPO = path.resolve(__dirname, '../fixtures/test-plugin-repo');
const STATE_PATH = path.join(PLUGINS_ROOT, 'plugin-state.json');
const TOOLS_JS = path.resolve(REPO_ROOT, 'src', 'pre', 'tools.js');

function runCli(args, opts = {}) {
    const cmd = `node "${CLI_PATH}" ${args}`;
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

// ─── install / remove ───────────────────────────────────────────────────────

test.describe('CLI install and remove', () => {

    test.afterAll(() => {
        cleanupContainer('test-plugin-repo');
        cleanupState(['test-plugin-repo/tools/TestPlugin']);
        // Re-activate to restore clean tools.js
        runCli('activate');
    });

    test('install from local fixture directory', () => {
        const { stdout, exitCode } = runCli(`install "${FIXTURE_REPO}"`);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Discovered 1 plugin(s)');
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

    test('remove installed plugin repo', () => {
        const { stdout, exitCode } = runCli('remove test-plugin-repo');
        expect(exitCode).toBe(0);

        // Directory should be gone
        expect(fs.existsSync(path.join(PLUGINS_ROOT, 'test-plugin-repo'))).toBe(false);

        // tools.js should no longer include it
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).not.toContain('TestPluginTool');
    });

    test('remove nonexistent repo fails', () => {
        const { exitCode } = runCli('remove nonexistent-repo');
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

    test.afterAll(() => {
        cleanupContainer(CONTAINER);
        cleanupState([`${CONTAINER}/tools/E2eTool`]);
        runCli('activate');
    });

    test('create tool scaffolds correct structure', () => {
        const { stdout, exitCode } = runCli(`create tool E2eTool --container ${CONTAINER}`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2eTool');
        expect(fs.existsSync(pluginDir)).toBe(true);

        // plugin.json exists and is valid
        const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
        expect(manifest.name).toBe('E2eTool');
        expect(manifest.type).toBe('tool');
        expect(manifest.paths).toBeDefined();
        expect(manifest.defaultIcon).toBe('puzzle-outline');

        // Entry point exists
        expect(fs.existsSync(path.join(pluginDir, 'E2eToolTool.js'))).toBe(true);

        // CSS exists
        expect(fs.existsSync(path.join(pluginDir, 'E2eToolTool.css'))).toBe(true);

        // Test spec exists
        const testDir = path.join(pluginDir, 'tests');
        expect(fs.existsSync(testDir)).toBe(true);

        // tools.js should include the new tool
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).toContain('E2eTool');
    });

    test('create --json returns structured output', () => {
        // Destroy first, then re-create with --json
        runCli(`destroy ${CONTAINER}/tools/E2eTool --force`);
        const { stdout, exitCode } = runCli(`create tool E2eTool --container ${CONTAINER} --json`);
        expect(exitCode).toBe(0);

        const result = JSON.parse(stdout);
        expect(result.command).toBe('create');
        expect(result.name).toBe('E2eTool');
        expect(result.type).toBe('tool');
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

    test('destroy with --force removes plugin', () => {
        const { stdout, exitCode } = runCli(`destroy ${CONTAINER}/tools/E2eTool --force`);
        expect(exitCode).toBe(0);

        const pluginDir = path.join(PLUGINS_ROOT, CONTAINER, 'tools', 'E2eTool');
        expect(fs.existsSync(pluginDir)).toBe(false);

        // tools.js should no longer include it
        const toolsJs = fs.readFileSync(TOOLS_JS, 'utf8');
        expect(toolsJs).not.toContain('E2eTool');
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

    test.afterAll(() => {
        // Ensure registries are clean
        runCli('registry remove test-plugin-repo');
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
        // Clean up
        runCli('registry remove mmgis-test-plugins');
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
