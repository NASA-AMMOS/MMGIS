/**
 * __Name__Tool — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). A tool imports React, CSS and
 * MMGIS singletons, none of which load outside the bundler, so these tests
 * assert the contract; open-the-tool behavior belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('__Name__')
    expect(manifest.type).toBe('tool')
    expect(manifest.paths['__Name__Tool']).toBeDefined()
})

test('every declared path resolves to a file @unit', () => {
    // Fails after renaming the tool file without re-running
    // `npm run plugins -- activate`.
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
