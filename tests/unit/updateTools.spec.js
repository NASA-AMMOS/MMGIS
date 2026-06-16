/**
 * Unit tests for updateTools() / updateComponents() plugin discovery.
 *
 * Strategy: install fixture plugin directories into the plugins tree
 * (under `plugins/<test-container>/tools/...`), invoke the build
 * function from API/updateTools.js, then assert on the generated
 * artifacts (`configure/public/toolConfigs.json` and `src/pre/tools.js`).
 *
 * Tests are serial — they mutate the plugins tree and must clean up in
 * order to avoid leaking fixtures into subsequent runs.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');

const {
    installFixturePlugin,
    uninstallContainer,
    repoRoot,
} = require('../helpers/plugin-helpers');

const { updateTools, updateComponents } = require('../../API/updateTools');

// The plugin container name is intentionally unique so it cannot collide
// with any real plugin directories on disk during development.
const TOOL_CONTAINER = 'mmgis-test';
const COMPONENT_CONTAINER = 'mmgis-test';

const TOOL_CONFIGS_PATH = path.join(
    repoRoot,
    'configure',
    'public',
    'toolConfigs.json'
);
const COMPONENT_CONFIGS_PATH = path.join(
    repoRoot,
    'configure',
    'public',
    'componentConfigs.json'
);

test.describe.configure({ mode: 'serial' });

test.describe('updateTools - plugin discovery and validation', () => {
    test.afterEach(() => {
        // Always remove the fixture container so a failing test doesn't
        // leak plugins into subsequent tests or developer workspaces.
        uninstallContainer('tool', TOOL_CONTAINER);
        // Regenerate the standard tool registry so the dev environment
        // (and any subsequent test) sees a clean src/pre/tools.js.
        try {
            updateTools();
        } catch {
            // swallow — the test has already asserted what it cares about
        }
    });

    test('valid plugin is discovered and written to toolConfigs.json', () => {
        installFixturePlugin({
            pluginType: 'tool',
            containerName: TOOL_CONTAINER,
            fixtureName: 'TestPlugin',
        });

        updateTools();

        const raw = fs.readFileSync(TOOL_CONFIGS_PATH, 'utf8');
        const cfg = JSON.parse(raw);
        expect(cfg).toHaveProperty('TestPlugin');
        expect(cfg.TestPlugin.name).toBe('TestPlugin');
        expect(cfg.TestPlugin.paths).toBeDefined();
    });

    test('invalid plugin is skipped, valid plugins still registered', () => {
        installFixturePlugin({
            pluginType: 'tool',
            containerName: TOOL_CONTAINER,
            fixtureName: 'InvalidPlugin',
        });
        installFixturePlugin({
            pluginType: 'tool',
            containerName: TOOL_CONTAINER,
            fixtureName: 'TestPlugin',
        });

        updateTools();

        const cfg = JSON.parse(fs.readFileSync(TOOL_CONFIGS_PATH, 'utf8'));
        // Valid plugin must be present
        expect(cfg).toHaveProperty('TestPlugin');
        // Invalid plugin (missing required fields) must NOT be present
        expect(cfg).not.toHaveProperty('InvalidPlugin');
    });

    test('override plugin replaces standard tool of the same name', () => {
        // Install OverridePlugin AS "Identifier" — plugins are keyed by
        // their installed directory name, so this exercises the
        // override path against the standard Identifier tool.
        installFixturePlugin({
            pluginType: 'tool',
            containerName: TOOL_CONTAINER,
            fixtureName: 'OverridePlugin',
            installAs: 'Identifier',
        });

        updateTools();

        const cfg = JSON.parse(fs.readFileSync(TOOL_CONFIGS_PATH, 'utf8'));
        // The override fixture uses name=Identifier with a distinctive
        // toolbarPriority (9998) so we can detect that the override
        // replaced the standard Identifier (toolbarPriority=1) entry.
        expect(cfg).toHaveProperty('Identifier');
        expect(cfg.Identifier.toolbarPriority).toBe(9998);
    });

    test('standard tools remain registered when no plugins are present', () => {
        // No fixture install — verify baseline still works.
        updateTools();
        const cfg = JSON.parse(fs.readFileSync(TOOL_CONFIGS_PATH, 'utf8'));
        // Identifier is part of the standard MMGIS tool set.
        expect(cfg).toHaveProperty('Identifier');
        expect(cfg).toHaveProperty('Kinds');
    });
});

test.describe('updateComponents - plugin discovery and validation', () => {
    test.afterEach(() => {
        uninstallContainer('component', COMPONENT_CONTAINER);
        try {
            updateComponents();
        } catch {
            // swallow — clean-up only
        }
    });

    test('valid component plugin is discovered', () => {
        // Create a component fixture inline (simple enough to inline here).
        const containerPath = path.join(
            repoRoot,
            'plugins',
            COMPONENT_CONTAINER,
            'components',
            'TestComponent'
        );
        fs.mkdirSync(containerPath, { recursive: true });
        fs.writeFileSync(
            path.join(containerPath, 'plugin.json'),
            JSON.stringify({
                name: 'TestComponent',
                description: 'fixture',
                paths: {
                    TestComponent: '../plugins/mmgis-test/components/TestComponent/TestComponent',
                },
            })
        );
        fs.writeFileSync(
            path.join(containerPath, 'TestComponent.js'),
            'module.exports = { init: function() {} };\n'
        );

        updateComponents();

        const cfg = JSON.parse(fs.readFileSync(COMPONENT_CONFIGS_PATH, 'utf8'));
        expect(cfg).toHaveProperty('TestComponent');
    });
});
