/**
 * Unit tests for missionTemplates.js variant registry and blueprint resolution.
 *
 * These tests are pure JS — they don't require a running server or
 * browser. They run under Playwright's test runner via
 * `npm run test:unit`.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const {
    REFERENCE_MISSION_VARIANTS,
    resolveVariantBlueprintPath,
} = require('../../API/Backend/Utils/missionTemplates');

test.describe('REFERENCE_MISSION_VARIANTS registry', () => {
    test('contains the default Earth variant', () => {
        const earth = REFERENCE_MISSION_VARIANTS['default'];
        expect(earth).toBeDefined();
        expect(earth.missionName).toBe('Reference-Mission');
        expect(earth.blueprintDir).toBe('Reference-Mission');
    });

    test('contains the Lunar-SouthPole variant', () => {
        const lunar = REFERENCE_MISSION_VARIANTS['Lunar-SouthPole'];
        expect(lunar).toBeDefined();
        expect(lunar.missionName).toBe('Reference-Mission-Lunar-SouthPole');
        expect(lunar.blueprintDir).toBe('Reference-Mission-Lunar-SouthPole');
    });

    test('all variants have required fields', () => {
        for (const [, variant] of Object.entries(REFERENCE_MISSION_VARIANTS)) {
            expect(variant.missionName).toBeTruthy();
            expect(variant.blueprintDir).toBeTruthy();
            expect(variant.configFile).toBeTruthy();
        }
    });
});

test.describe('resolveVariantBlueprintPath', () => {
    test('returns correct path for default variant', () => {
        const result = resolveVariantBlueprintPath('default');
        expect(result).toBeTruthy();
        expect(result.sourcePath).toContain('Reference-Mission');
        expect(result.missionName).toBe('Reference-Mission');
    });

    test('returns correct path for Lunar-SouthPole variant', () => {
        const result = resolveVariantBlueprintPath('Lunar-SouthPole');
        expect(result).toBeTruthy();
        expect(result.sourcePath).toContain('Reference-Mission-Lunar-SouthPole');
        expect(result.missionName).toBe('Reference-Mission-Lunar-SouthPole');
    });

    test('returns null for unknown variant', () => {
        const result = resolveVariantBlueprintPath('nonexistent-variant');
        expect(result).toBeNull();
    });
});

test.describe('Lunar-SouthPole config has correct projection type', () => {
    let config;

    test.beforeAll(() => {
        const configPath = path.resolve(
            './blueprints/Missions/Reference-Mission-Lunar-SouthPole/config.reference-mission-lunar-southpole.json'
        );
        const raw = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(raw);
    });

    test('projection.custom is true', () => {
        expect(config.projection.custom).toBe(true);
    });

    test('projection.epsg is IAU2000:30120', () => {
        expect(config.projection.epsg).toBe('IAU2000:30120');
    });

    test('projection.proj contains +proj=stere and +lat_0=-90', () => {
        expect(config.projection.proj).toContain('+proj=stere');
        expect(config.projection.proj).toContain('+lat_0=-90');
    });

    test('projection bounds are correct', () => {
        expect(config.projection.bounds[0]).toBe('-1095700');
        expect(config.projection.bounds[3]).toBe('1095700');
    });

    test('projection resunitsperpixel is correct', () => {
        expect(config.projection.resunitsperpixel).toBe('12800.00000000000000');
    });

    test('projection reszoomlevel is correct', () => {
        expect(config.projection.reszoomlevel).toBe('0');
    });

    test('projection origin is correct', () => {
        expect(config.projection.origin[0]).toBe('-1095700');
        expect(config.projection.origin[1]).toBe('-1095600');
    });
});

test.describe('Default Earth config has standard projection', () => {
    let config;

    test.beforeAll(() => {
        const configPath = path.resolve(
            './blueprints/Missions/Reference-Mission/config.reference-mission.json'
        );
        const raw = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(raw);
    });

    test('projection.custom is false', () => {
        expect(config.projection.custom).toBe(false);
    });

    test('projection.epsg is EPSG:3857', () => {
        expect(config.projection.epsg).toBe('EPSG:3857');
    });
});
