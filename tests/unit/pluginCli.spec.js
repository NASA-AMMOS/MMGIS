/**
 * Unit tests for plugin-cli/cli.js commands and plugin-state.json integration
 * with discoverPlugins().
 *
 * Tests build temporary directory trees to simulate plugin containers,
 * and invoke the CLI as a subprocess.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { discoverPlugins } = require('../../API/pluginDiscovery');
const { withRegistryLock } = require('../helpers/registry-lock');

const CLI_PATH = path.resolve(__dirname, '../../plugin-cli/cli.js');
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

// Most commands regenerate the shared registries, so hold the lock for the
// duration of the call (see helpers/registry-lock).
function runCli(args, opts = {}) {
    const cmd = `node "${CLI_PATH}" ${args}`;
    return withRegistryLock(() => {
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
    });
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
        expect(stdout).toContain('Draw');
        expect(stdout).toContain('(core)');
        expect(stdout).toContain('plugin(s)');
    });

    test('info command shows plugin details', () => {
        const { stdout, exitCode } = runCli('info Draw');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('core/tools/Draw');
        expect(stdout).toContain('Name:');
        expect(stdout).toContain('Type:');
        expect(stdout).toContain('Status:');
    });

    test('info command with full ID', () => {
        const { stdout, exitCode } = runCli('info core/tools/Draw');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('core/tools/Draw');
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
        expect(stdout).toContain('npm dep');
        expect(stdout).toContain('conflict');
    });

    test('remove core is rejected', () => {
        const { exitCode, stderr, stdout } = runCli('remove core');
        expect(exitCode).not.toBe(0);
    });

    test('disable required plugin is rejected', () => {
        const { exitCode } = runCli('disable core/backend/Users');
        expect(exitCode).not.toBe(0);
    });

    test('enable required plugin is a no-op', () => {
        const { stdout, exitCode } = runCli('enable core/backend/Users');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('always enabled');
    });

    test('registry list shows empty when no registries', () => {
        const regPath = path.join(REPO_ROOT, 'plugin-cli', 'registries.json');
        const saved = fs.readFileSync(regPath, 'utf8');
        fs.writeFileSync(regPath, JSON.stringify({ registries: [] }, null, 4));
        try {
            const { stdout, exitCode } = runCli('registry list');
            expect(exitCode).toBe(0);
            expect(stdout).toContain('No registries configured');
        } finally {
            fs.writeFileSync(regPath, saved);
        }
    });

    test('unknown command shows help and exits with error', () => {
        const { exitCode } = runCli('foobar');
        expect(exitCode).not.toBe(0);
    });
});

// ─── discoverPlugins + plugin-state.json ─────────────────────────────

test.describe('discoverPlugins with plugin-state.json', () => {

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

            const found = discoverPlugins(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Alpha');
            expect(names).not.toContain('Beta');
        } finally {
            rmDir(root);
        }
    });

    test('does not skip required plugins even if state says disabled', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'tools', 'Alpha', 'plugin.json'),
                JSON.stringify({ name: 'Alpha', display_name: 'Alpha', type: 'tool', required: true })
            );
            // Try to disable a required plugin via state file.
            writeFile(
                path.join(root, 'plugin-state.json'),
                JSON.stringify({ plugins: { 'core/tools/Alpha': { enabled: false } } })
            );

            const found = discoverPlugins(root, 'tools');
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

            const found = discoverPlugins(root, 'tools');
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

            const found = discoverPlugins(root, 'tools');
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

            const found = discoverPlugins(root, 'tools');
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

            const found = discoverPlugins(root, 'tools');
            const names = found.map((p) => p.name);
            expect(names).toContain('Zeta');
        } finally {
            rmDir(root);
        }
    });

    test('discovers interaction plugins', () => {
        const root = makeTmpDir();
        try {
            writeFile(
                path.join(root, 'core', 'interactions', 'TestHook', 'plugin.json'),
                JSON.stringify({
                    name: 'TestHook',
                    type: 'interaction',
                    interactionId: 'test:hook',
                    phase: 'main',
                    paths: { TestHook: './TestHook' },
                })
            );

            const found = discoverPlugins(root, 'interactions');
            const names = found.map((p) => p.name);
            expect(names).toContain('TestHook');
        } finally {
            rmDir(root);
        }
    });
});

// ─── CLI interaction support ──────────────────────────────────────────

test.describe('plugin-cli interaction support', () => {

    test('list command shows interaction plugins', () => {
        const { stdout, exitCode } = runCli('list');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Interactions');
        expect(stdout).toContain('Select');
        expect(stdout).toContain('InfoOpen');
    });

    test('list --json includes interaction plugins', () => {
        const { stdout, exitCode } = runCli('list --json');
        expect(exitCode).toBe(0);
        const plugins = JSON.parse(stdout);
        const interactions = plugins.filter((p) => p.type === 'interaction');
        expect(interactions.length).toBeGreaterThan(0);
        const names = interactions.map((p) => p.name);
        expect(names).toContain('Select');
        expect(names).toContain('InfoOpen');
    });

    test('info command shows interaction-specific fields', () => {
        const { stdout, exitCode } = runCli('info InfoOpen');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('interaction');
        expect(stdout).toContain('info:open');
        expect(stdout).toContain('Phase:');
        expect(stdout).toContain('Suppresses:');
    });

    test('info --json includes interaction manifest fields', () => {
        const { stdout, exitCode } = runCli('info core/interactions/InfoOpen --json');
        expect(exitCode).toBe(0);
        const info = JSON.parse(stdout);
        expect(info.type).toBe('interaction');
        expect(info.manifest.interactionId).toBe('info:open');
        expect(info.manifest.phase).toBe('main');
        expect(info.manifest.suppresses).toEqual(['info:silent']);
    });

    test('validate passes with interactions included', () => {
        const { stdout, exitCode } = runCli('validate');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('valid');
    });

    test('validate --json includes interaction plugins', () => {
        const { stdout, exitCode } = runCli('validate --json');
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        const interactionResults = result.results.filter((r) => r.plugin.includes('interactions/'));
        expect(interactionResults.length).toBeGreaterThan(0);
        expect(interactionResults.every((r) => r.valid)).toBe(true);
    });

    test('validate --json reports no order collisions for core interactions', () => {
        const { stdout, exitCode } = runCli('validate --json');
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.interactionWarnings).toBe(0);
    });

    test('create interaction requires --container flag', () => {
        const { exitCode } = runCli('create interaction TestHook');
        expect(exitCode).not.toBe(0);
    });

    test('create interaction requires --force for the core container', () => {
        const { stderr, exitCode } = runCli(
            'create interaction TestHook --container core'
        );
        expect(exitCode).not.toBe(0);
        expect(stderr).toContain(
            'Cannot create plugins in the core container without --force.'
        );
    });

    test('help mentions interaction type', () => {
        const { stdout, exitCode } = runCli('help');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('interaction');
        expect(stdout).toContain('--container core --force');
    });

    test('create and destroy interaction scaffold', () => {
        const container = 'testint' + Date.now();
        const pluginDir = path.join(REPO_ROOT, 'plugins', container, 'interactions', 'FeatureGlow');
        try {
            const createResult = runCli(`create interaction FeatureGlow --container ${container} --json`);
            expect(createResult.exitCode).toBe(0);
            const created = JSON.parse(createResult.stdout);
            expect(created.type).toBe('interaction');
            expect(created.files).toContain('plugin.json');
            expect(created.files).toContain('FeatureGlow.js');

            // Verify generated manifest
            const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
            expect(manifest.type).toBe('interaction');
            expect(manifest.interactionId).toBeDefined();
            expect(manifest.phase).toBe('main');
            expect(manifest.paths.FeatureGlow).toBe('./FeatureGlow');

            // Verify handler module
            const handler = fs.readFileSync(path.join(pluginDir, 'FeatureGlow.js'), 'utf8');
            expect(handler).toContain('use(ctx)');
            expect(handler).toContain('export default FeatureGlow');

            // Verify test file
            expect(fs.existsSync(path.join(pluginDir, 'tests', 'featureGlow.spec.js'))).toBe(true);

            // Destroy
            const destroyResult = runCli(`destroy ${container}/interactions/FeatureGlow --force --json`);
            expect(destroyResult.exitCode).toBe(0);
            expect(fs.existsSync(pluginDir)).toBe(false);
        } finally {
            // Cleanup in case test failed
            const containerDir = path.join(REPO_ROOT, 'plugins', container);
            if (fs.existsSync(containerDir)) {
                fs.rmSync(containerDir, { recursive: true, force: true });
            }
        }
    });
});

// ─── scaffolds ───────────────────────────────────────────────────────────────

test.describe('scaffold templates', () => {
    // Scaffolds are real files under plugin-cli/scaffolds/, so a broken one
    // fails here rather than in someone's first plugin. Materialized through the
    // loader rather than `create` so nothing touches the shared plugins tree.
    const { scaffold } = require('../../plugin-cli/lib/scaffolds');
    const { validatePluginConfig, validateLayerTypeModuleShape } = require('../../API/pluginValidation.js');

    const TYPES = [
        'tool',
        'backend',
        'component',
        'interaction',
        'layertype',
        'layerattachment',
    ];

    for (const type of TYPES) {
        test(`the ${type} scaffold is a valid plugin`, () => {
            const name = 'MyGriddedThing';
            const files = scaffold(type, name);

            expect(Object.keys(files)).toContain('plugin.json');
            for (const [relPath, contents] of Object.entries(files)) {
                // Every token was substituted, in paths as well as contents.
                expect(relPath).not.toMatch(/__[A-Za-z_]+__/);
                expect(contents).not.toMatch(/__[A-Za-z_]+__/);
            }

            const manifest = JSON.parse(files['plugin.json']);
            expect(manifest.name).toBe(name);
            expect(manifest.type).toBe(type);
            expect(validatePluginConfig(manifest, name, type)).toEqual([]);
        });
    }

    test('name variants reach the ids each family keys on', () => {
        expect(JSON.parse(scaffold('layertype', 'MyGriddedThing')['plugin.json']).typeId)
            .toBe('mygriddedthing');

        const attachment = JSON.parse(scaffold('layerattachment', 'MyGriddedThing')['plugin.json']);
        expect(attachment.attachmentId).toBe('my_gridded_thing');
        expect(attachment.module).toBe('./myGriddedThing');
        // The form must write where core resolves this attachment's settings.
        for (const row of attachment.config.rows)
            for (const component of row.components)
                expect(component.field.startsWith(attachment.configPath)).toBe(true);

        expect(JSON.parse(scaffold('interaction', 'MyGriddedThing')['plugin.json']).interactionId)
            .toBe('my:gridded:thing');
    });

    test('an acronym in a name is one word', () => {
        // Otherwise `FOVWedges` becomes `f_ovwedges` / `fOVWedges`, which is
        // both wrong and inconsistent between the id and the module.
        const attachment = JSON.parse(scaffold('layerattachment', 'FOVWedges')['plugin.json']);
        expect(attachment.attachmentId).toBe('fov_wedges');
        expect(attachment.module).toBe('./fovWedges');
        expect(attachment.configPath).toBe('variables.layerAttachments.fovWedges');

        expect(JSON.parse(scaffold('interaction', 'FOVWedges')['plugin.json']).interactionId)
            .toBe('fov:wedges');
        expect(JSON.parse(scaffold('layertype', 'FOVWedges')['plugin.json']).typeId)
            .toBe('fovwedges');

        // A digit belongs to the word it is written in.
        expect(JSON.parse(scaffold('layerattachment', 'HTML5Parser')['plugin.json']).attachmentId)
            .toBe('html5_parser');
        expect(JSON.parse(scaffold('layerattachment', 'E2eHalos')['plugin.json']).attachmentId)
            .toBe('e2e_halos');
    });

    test('the attachment scaffold joins an existing Configure tab', () => {
        // A tab name of its own becomes a one-row tab no admin opens, which is
        // the failure mode the family docs warn about.
        const attachment = JSON.parse(scaffold('layerattachment', 'MyGriddedThing')['plugin.json']);
        expect(attachment.config.tab).not.toContain('MyGriddedThing');
        const coreTabs = fs
            .readdirSync(path.join(REPO_ROOT, 'plugins', 'core', 'layerattachments'))
            .map((dir) => path.join(REPO_ROOT, 'plugins', 'core', 'layerattachments', dir, 'plugin.json'))
            .filter((file) => fs.existsSync(file))
            .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
            .map((manifest) => manifest.config && manifest.config.tab);
        expect(coreTabs).toContain(attachment.config.tab);
    });

    test('the layer scaffolds implement only what core has no default for', () => {
        // Over-implementation is the failure mode here: an empty setOpacity
        // silently replaces a working core default, so the stubs stay commented.
        const layertype = scaffold('layertype', 'MyGriddedThing')['map.js'];
        expect(validateLayerTypeModuleShape(layertype, 'x', 'map')).toEqual([]);
        expect(layertype).toContain('make');

        const attachment = scaffold('layerattachment', 'MyGriddedThing')['myGriddedThing.js'];
        expect(validateLayerTypeModuleShape(attachment, 'x', 'attachment')).toEqual([]);
        for (const op of ['setOpacity', 'setVisibility', 'syncData']) {
            expect(attachment).not.toMatch(new RegExp(`^\\s*${op}[,(]`, 'm'));
        }
    });
});
