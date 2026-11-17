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

    test('duplicate interaction IDs leave out the claimants, not the registry', () => {
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'TestInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'DuplicateInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });

        // Aborting would keep the *previous* generation of every registry on
        // disk, so the app runs the last good build of plugins the author has
        // since changed. Both claimants are dropped; everyone else regenerates.
        updateInteractions();

        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        expect(cfg).not.toHaveProperty('TestInteraction');
        expect(cfg).not.toHaveProperty('DuplicateInteraction');
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

    test('a dependency on another family is satisfiable', () => {
        // The idiom for a feature spanning families: the interaction depends on
        // the layer type it is written for. Resolving deps against only some
        // families dropped it with a warning nobody reads.
        installFixturePlugin({
            pluginType: 'interaction',
            containerName: INTERACTION_CONTAINER,
            fixtureName: 'DepCrossFamilyInteraction',
            fixturesDir: path.join(repoRoot, 'tests', 'fixtures', 'test-plugin-interactions'),
        });

        updateInteractions();

        const cfg = JSON.parse(fs.readFileSync(INTERACTION_CONFIGS_PATH, 'utf8'));
        expect(cfg).toHaveProperty('DepCrossFamilyInteraction');
        expect(fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8')).toContain(
            'dep:crossfamily'
        );
    });

    test('interactions.js does not contain dynamic import patterns', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        // Same check as toolLazyLoading — no dynamic imports
        expect(contents).not.toMatch(
            /const\s+\w+\s*=\s*\(\)\s*=>\s*import\(/
        );
    });

    test('generated interactions.js exports CLICK_PREAMBLE from phase=preamble manifests', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const CLICK_PREAMBLE');
        // Preamble should contain select
        const match = contents.match(/export const CLICK_PREAMBLE = (\[.*?\])/);
        expect(match).not.toBeNull();
        const preamble = JSON.parse(match[1]);
        expect(preamble).toContain('select');
        expect(preamble).not.toContain('cleanup_temp');
    });

    test('generated interactions.js exports CLICK_POSTAMBLE from phase=postamble manifests', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const CLICK_POSTAMBLE');
        const match = contents.match(/export const CLICK_POSTAMBLE = (\[.*?\])/);
        expect(match).not.toBeNull();
        const postamble = JSON.parse(match[1]);
        expect(postamble).toContain('info:silent');
        expect(postamble).toContain('viewer:update');
        expect(postamble).toContain('search:url');
        expect(postamble).toContain('event:notify');
        // Verify order matches manifest order values
        expect(postamble.indexOf('info:silent')).toBeLessThan(postamble.indexOf('viewer:update'));
        expect(postamble.indexOf('viewer:update')).toBeLessThan(postamble.indexOf('search:url'));
        expect(postamble.indexOf('search:url')).toBeLessThan(postamble.indexOf('event:notify'));
    });

    test('generated interactions.js exports SUPPRESSION_MAP from suppresses fields', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const SUPPRESSION_MAP');
        const match = contents.match(/export const SUPPRESSION_MAP = ({.*?})/);
        expect(match).not.toBeNull();
        const map = JSON.parse(match[1]);
        expect(map).toHaveProperty('info:open');
        expect(map['info:open']).toEqual(['info:silent']);
    });

    test('generated interactions.js exports KIND_PIPELINES from kindAlias fields', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const KIND_PIPELINES');
        const match = contents.match(/export const KIND_PIPELINES = ({.*?})\n/);
        expect(match).not.toBeNull();
        const pipelines = JSON.parse(match[1]);
        expect(pipelines.none).toEqual([]);
        expect(pipelines.info).toEqual(['info:open']);
        expect(pipelines.waypoint).toContain('waypoint:image');
        expect(pipelines.waypoint).toContain('waypoint:model');
    });

    test('generated interactions.js exports HOVER_DEFAULTS and MOUSEOUT_DEFAULTS', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        expect(contents).toContain('export const HOVER_DEFAULTS');
        expect(contents).toContain('export const MOUSEOUT_DEFAULTS');

        const hoverMatch = contents.match(/export const HOVER_DEFAULTS = (\[.*?\])/);
        expect(hoverMatch).not.toBeNull();
        expect(JSON.parse(hoverMatch[1])).toContain('cursor:show');

        const mouseoutMatch = contents.match(/export const MOUSEOUT_DEFAULTS = (\[.*?\])/);
        expect(mouseoutMatch).not.toBeNull();
        expect(JSON.parse(mouseoutMatch[1])).toContain('cursor:hide');
    });

    test('generated interactions.js exports APPLICABLE_LAYER_TYPES', () => {
        updateInteractions();

        const contents = fs.readFileSync(INTERACTIONS_JS_PATH, 'utf8');
        const match = contents.match(
            /export const APPLICABLE_LAYER_TYPES = ({.*?})\n/
        );
        expect(match).not.toBeNull();
        const applicable = JSON.parse(match[1]);
        expect(applicable['info:open']).toContain('vector');
        // Declaring nothing is an absent entry, not an empty list — the runner
        // reads absence as "applies to any layer type".
        for (const ids of Object.values(applicable))
            expect(ids.length).toBeGreaterThan(0);
    });
});
