/**
 * __Name__ component — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). A component imports CSS and
 * MMGIS singletons, which don't load outside the bundler, so these tests assert
 * the contract; rendered behavior belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('__Name__')
    expect(manifest.type).toBe('component')
    expect(manifest.paths['__Name__']).toBeDefined()
})

test('every declared path resolves to a file @unit', () => {
    // Fails after renaming the component file without re-running
    // `npm run plugins -- activate`.
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
