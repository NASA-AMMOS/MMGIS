/**
 * Unit tests for updateInteractions() plugin discovery and generation.
 *
 * Strategy: install fixture interaction plugin directories, invoke
 * updateInteractions(), then assert on the generated artifacts
 * (configure/public/interactionConfigs.json and src/pre/interactions.js).
 *
 * Tests are serial — they mutate the plugins tree and must clean up.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');

const {
    installFixturePlugin,
    uninstallContainer,
    repoRoot,
} = require('../helpers/plugin-helpers');

const { updateInteractions } = require('../../API/updateTools');

const INTERACTION_CONTAINER = 'mmgis-test';

const INTERACTION_CONFIGS_PATH = path.join(
    repoRoot,
    'configure',
    'public',
    'interactionConfigs.json'
);
const INTERACTIONS_JS_PATH = path.join(
    repoRoot,
    'src',
    'pre',
    'interactions.js'
);

test.describe.configure({ mode: 'serial' });

test.describe('updateInteractions - plugin discovery and generation', () => {
    test.afterEach(() => {
        uninstallContainer('interaction', INTERACTION_CONTAINER);
        // Regenerate the standard interaction registry.
        try {
            updateInteractions();
        } catch {
            // swallow
        }
    });

    test('core interaction plugins are discovered and written to interactionConfigs.json', () => {
        updateInteractions();

        expect(fs.existsSync(INTERACTION_CONFIGS_PATH)).toBe(true);
        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        // At minimum, the core Select interaction should be present.
        expect(cfg).toHaveProperty('Select');
        expect(cfg.Select.interactionId).toBe('select');
    });

    test('generated interactions.js exists and uses static imports', () => {
        updateInteractions();

        expect(fs.existsSync(INTERACTIONS_JS_PATH)).toBe(true);
        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');

        // Should use static imports, not dynamic
        expect(contents).toMatch(/^\s*import\s+interaction_\w+\s+from\s+'[^']+'/m);
        expect(contents).not.toMatch(/\(\)\s*=>\s*import\(/);
        expect(contents).not.toContain('webpackChunkName');
    });

    test('generated interactions.js exports interactionHandlers map', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const interactionHandlers');
        // Should contain at least the select handler
        expect(contents).toMatch(/'select':\s*interaction_Select_\w+/);
    });

    test('generated interactions.js exports interactionConfigs', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const interactionConfigs');
    });

    test('valid fixture interaction is discovered alongside core interactions', () => {
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'TestInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });

        updateInteractions();

        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        expect(cfg).toHaveProperty('TestInteraction');
        expect(cfg.TestInteraction.interactionId).toBe('test:interaction');
        // Core interactions should still be present
        expect(cfg).toHaveProperty('Select');
    });

    test('invalid interaction is skipped, valid ones still registered', () => {
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'InvalidInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'TestInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });

        updateInteractions();

        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        expect(cfg).toHaveProperty('TestInteraction');
        expect(cfg).not.toHaveProperty('InvalidInteraction');
    });

    test('interaction with unsatisfied pluginDependencies is excluded (hard dep enforcement)', () => {
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'DepMissingInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });

        updateInteractions();

        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        expect(cfg).not.toHaveProperty('DepMissingInteraction');

        // Also verify it's not in the generated JS
        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).not.toContain('dep:missing');
    });

    test('interactions.js does not contain dynamic import patterns', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        // Same check as toolLazyLoading — no dynamic imports
        expect(contents).not.toMatch(
            /const\s+\w+\s*=\s*\(\)\s*=>\s*import\(/
        );
    });
});
