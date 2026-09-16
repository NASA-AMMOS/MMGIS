/**
 * A mission holding a layer of a plugin-provided type must be savable.
 *
 * Both config validators — the backend one the CMS saves through, and the
 * Configure one that flags a mission in the UI — used to switch on the layer's
 * type and report anything they did not recognise as unknown, so a layer type
 * that could be authored, validated, activated and registered still could not
 * be configured. They now ask the generated layer-type registry which types
 * exist, and hold a plugin type only to the checks it declares for itself.
 */

import { test, expect } from '@playwright/test'

import {
    validateLayer,
    getAllValidationErrors,
} from '../../configure/src/core/validators'

const backend = require('../../plugins/core/backend/Config/validate')

// What the generated registry (configure/public/layerTypeConfigs.json) looks
// like with a third-party container activated: one type of its own, and one
// extending a built-in.
const REGISTRY = {
    vector: { manifest: { typeId: 'vector' } },
    truevector: { manifest: { typeId: 'truevector' } },
    swathcatalogue: { manifest: { typeId: 'swathcatalogue', extends: 'vector' } },
}

const unknownTypeErrors = (errors) =>
    errors.filter((e) => /Unknown layer type/.test(e.message ?? e.reason))

test.describe('backend config validation', () => {
    test('a plugin-provided type is not unknown, and is held to no built-in checks', () => {
        expect(backend.checkedTypeOf('truevector', REGISTRY)).toBe('')
        expect(backend.checkedTypeOf('swathcatalogue', REGISTRY)).toBe('')
    })

    test('a type nothing provides is still unknown', () => {
        expect(backend.checkedTypeOf('truevector', {})).toBe(null)
        expect(backend.checkedTypeOf('typo', REGISTRY)).toBe(null)
    })

    test('a built-in type keeps its own checks', () => {
        expect(backend.checkedTypeOf('vector', REGISTRY)).toBe('vector')
        expect(backend.checkedTypeOf('tile', REGISTRY)).toBe('tile')
    })

    test("a type extending a built-in gets its parent's field defaults", () => {
        // Checks are the type's own business — a `source`-backed type may have
        // no url — but a type drawn by vector's renderer needs vector's fields.
        expect(backend.defaultsTypeOf('swathcatalogue', REGISTRY)).toBe('vector')
        expect(backend.defaultsTypeOf('truevector', REGISTRY)).toBe('truevector')
    })

    test('a whole config with a layer of an unregistered type is rejected', () => {
        const result = backend({
            msv: { view: [0, 0, 5] },
            tools: {},
            layers: [{ name: 'Swaths', type: 'nosuchtype' }],
        })
        expect(result.valid).toBe(false)
        expect(unknownTypeErrors(result.errors).length).toBe(1)
    })
})

test.describe('Configure layer validation', () => {
    const layer = { name: 'Swaths', type: 'truevector' }

    test('a plugin-provided type is accepted', () => {
        expect(validateLayer(layer, REGISTRY)).toEqual([])
    })

    test('a plugin-provided type is unknown without the registry', () => {
        expect(unknownTypeErrors(validateLayer(layer, {})).length).toBe(1)
        expect(unknownTypeErrors(validateLayer(layer)).length).toBe(1)
    })

    test('a built-in type keeps its own required fields', () => {
        const errors = validateLayer({ name: 'Base', type: 'tile' }, REGISTRY)
        expect(errors.map((e) => e.field)).toContain('url')
        expect(unknownTypeErrors(errors)).toEqual([])
    })

    test('the whole configuration is clean with the registry', () => {
        const configuration = {
            msv: { view: [0, 0, 5] },
            tools: {},
            layers: [layer],
        }
        expect(getAllValidationErrors(configuration, REGISTRY)).toEqual([])
        expect(
            unknownTypeErrors(getAllValidationErrors(configuration, {})).length
        ).toBe(1)
    })
})
