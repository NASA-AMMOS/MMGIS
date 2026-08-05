/**
 * __Name__ interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `__Name__.js`: as soon as the handler imports a
 * singleton (`@basics/Layers_/Layers_`, jQuery, Leaflet) it can no longer be
 * imported in Node, so the decisions live in a module that imports nothing and
 * the handler stays too thin to be worth testing here. Clicking a real feature
 * is an E2E test (`tests/e2e/`).
 */
import { test, expect } from '@playwright/test'
import { decide } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('__colon_name__')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature, so this is the case
    // that breaks an interaction in the field.
    expect(decide(null, null)).toBe(null)
})

test('settings are defaulted where they are read @unit', () => {
    const feature = { properties: { name: 'Crater', id: 7 } }
    expect(decide(feature, null)).toEqual({ label: 'Crater' })
    expect(decide(feature, { property: 'id' })).toEqual({ label: '7' })
})
