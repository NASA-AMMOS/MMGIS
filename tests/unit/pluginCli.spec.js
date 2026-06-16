/**
 * Unit tests for plugin-cli.js commands and plugin-state.json integration
 * with discoverPluginsUnified().
 *
 * Tests build temporary directory trees to simulate plugin containers,
 * and invoke the CLI as a subprocess.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { discoverPluginsUnified } = require('../../API/pluginDiscovery');

const CLI_PATH = path.resolve(__dirname, '../../plugins/plugin-cli.js');
const REPO_ROOT = path.resolve(__dirname, '../..');

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-plugin-cli-'));
}

function rmDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // best-effort cleanup
    }
}

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function runCli(args, opts = {}) {
    const cmd = `node "${CLI_PATH}" ${args}`;
    try {
        const output = execSync(cmd, {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 10000,
            ...opts,
        });
        return { stdout: output, exitCode: 0 };
    } catch (err) {
        return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
    }
}

// ─── CLI command tests ──────────────────────────────────────────────────────

test.describe('plugin-cli', () => {

    test('help command outputs usage info', () => {
        const { stdout, exitCode } = runCli('help');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('MMGIS Plugin CLI');
        expect(stdout).toContain('Commands:');
    });

    test('list command shows core plugins', () => {
        const { stdout, exitCode } = runCli('list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('core/');
        expect(stdout).toContain('tools/Draw');
        expect(stdout).toContain('(core)');
        expect(stdout).toContain('Total:');
    });

    test('info command shows plugin details', () => {
        const { stdout, exitCode } = runCli('info Draw');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Plugin: core/tools/Draw');
        expect(stdout).toContain('Name:');
        expect(stdout).toContain('Type:');
        expect(stdout).toContain('Status:');
    });

    test('info command with full ID', () => {
        const { stdout, exitCode } = runCli('info core/tools/Draw');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Plugin: core/tools/Draw');
    });

    test('info fails for nonexistent plugin', () => {
        const { exitCode, stderr } = runCli('info NonExistentPlugin');
        expect(exitCode).not.toBe(0);
    });

    test('validate command passes for core plugins', () => {
        const { stdout, exitCode } = runCli('validate');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('valid');
    });

    test('deps command shows dependency info', () => {
        const { stdout, exitCode } = runCli('deps');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('npm dependencies:');
        expect(stdout).toContain('conflict(s)');
    });

    test('remove core is rejected', () => {
        const { exitCode, stderr, stdout } = runCli('remove core');
        expect(exitCode).not.toBe(0);
    });

    test('disable core plugin is rejected', () => {
        const { exitCode } = runCli('disable core/tools/Draw');
        expect(exitCode).not.toBe(0);
    });

    test('enable core plugin is a no-op', () => {
        const { stdout, exitCode } = runCli('enable core/tools/Draw');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('always enabled');
    });

    test('registry list shows empty when no registries', () => {
        const { stdout, exitCode } = runCli('registry list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('No registries configured');
    });

    test('unknown command shows help and exits with error', () => {
        const { exitCode } = runCli('foobar');
        expect(exitCode).not.toBe(0);
    });
});

// ─── discoverPluginsUnified + plugin-state.json ─────────────────────────────

test.describe('discoverPluginsUnified with plugin-state.json', () => {

    test('skips disabled non-core plugins', () => {
        const root = makeTmpDir();
        try {
            // Create a "core" plugin.
            writeFile(
                path.join(root, 'core', 'tools', 'Alpha', 'plugin.json'),
                JSON.stringify({ name: 'Alpha', display_name: 'Alpha', type: 'tool' })
            );
            // Create an "external" plugin.
            writeFile(
                path.join(root, 'external-repo', 'tools', 'Beta', 'plugin.json'),
                JSON.stringify({ name: 'Beta', display_name: 'Beta', type: 'tool' })
            );
            // Disable the external plugin.
            writeFile(
                path.join(root, 'plugin-state.json'),
                JSON.stringify({ plugins: { 'external-repo/tools/Beta': { enabled: false } } })
            );

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Alpha');
            expect(names).not.toContain('Beta');
        } finally {
            rmDir(root);
        }
    });

    test('does not skip core plugins even if state says disabled', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'tools', 'Alpha', 'plugin.json'),
                JSON.stringify({ name: 'Alpha', display_name: 'Alpha', type: 'tool' })
            );
            // Try to disable a core plugin via state file.
            writeFile(
                path.join(root, 'plugin-state.json'),
                JSON.stringify({ plugins: { 'core/tools/Alpha': { enabled: false } } })
            );

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Alpha');
        } finally {
            rmDir(root);
        }
    });

    test('includes plugins when no state file exists', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'external-repo', 'tools', 'Gamma', 'plugin.json'),
                JSON.stringify({ name: 'Gamma', display_name: 'Gamma', type: 'tool' })
            );

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Gamma');
        } finally {
            rmDir(root);
        }
    });

    test('includes enabled non-core plugins', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'external-repo', 'tools', 'Delta', 'plugin.json'),
                JSON.stringify({ name: 'Delta', display_name: 'Delta', type: 'tool' })
            );
            writeFile(
                path.join(root, 'plugin-state.json'),
                JSON.stringify({ plugins: { 'external-repo/tools/Delta': { enabled: true } } })
            );

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Delta');
        } finally {
            rmDir(root);
        }
    });

    test('handles malformed state file gracefully', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'external-repo', 'tools', 'Epsilon', 'plugin.json'),
                JSON.stringify({ name: 'Epsilon', display_name: 'Epsilon', type: 'tool' })
            );
            writeFile(path.join(root, 'plugin-state.json'), '{ invalid json }}}');

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Epsilon');
        } finally {
            rmDir(root);
        }
    });

    test('handles state file without plugins key gracefully', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'external-repo', 'tools', 'Zeta', 'plugin.json'),
                JSON.stringify({ name: 'Zeta', display_name: 'Zeta', type: 'tool' })
            );
            // Valid JSON but missing "plugins" key
            writeFile(path.join(root, 'plugin-state.json'), '{"version": 1}');

            const found = discoverPluginsUnified(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Zeta');
        } finally {
            rmDir(root);
        }
    });
});
