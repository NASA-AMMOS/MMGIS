/**
 * __Name__ layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag is what selects these;
 * `npm run test:unit` only covers `tests/unit`). Behavior against a real map
 * belongs in an E2E spec — see plugins/core/layertypes/Vector/tests/.
 *
 * A layertype module imports MMGIS singletons, which need a browser, so these
 * tests assert the contract rather than importing `map.js`.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('__flatname__')
    // Every declared renderer engine must ship a matching module.
    const renderers = manifest.capabilities.renderers
    if (renderers.map) expect(manifest.modules.map).toBeDefined()
    if (renderers.globe)
        for (const engine of Object.keys(renderers.globe))
            expect(manifest.modules.globe?.[engine]).toBeDefined()
})

test('every declared module resolves to a file @unit', () => {
    // Fails after renaming a module file or adding a `modules` key without
    // re-running `npm run plugins -- activate`.
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
