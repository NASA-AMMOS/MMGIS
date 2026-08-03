/**
 * Unit tests for the layer-attachment plugin registry: every built-in
 * attachment (the things that used to be `switch (sublayer.type)` cases in
 * core) is discovered with a contract-valid manifest, keyed by its stable
 * attachmentId, and declares which engines it draws on so core can order and
 * suppress correctly without knowing any attachment by name.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const {
    validatePluginConfig,
    validateLayerTypeModuleShape,
} = require('../../API/pluginValidation')
const { updateLayerAttachments } = require('../../API/updateTools')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PLUGINS_ROOT = path.join(REPO_ROOT, 'plugins')
const REGISTRY_PATH = path.join(
    REPO_ROOT,
    'configure',
    'public',
    'layerAttachmentConfigs.json'
)

const BUILT_IN_ATTACHMENTS = [
    'coordinate_markers',
    'image_overlays',
    'labels',
    'model',
    'pairings',
    'path_gradient',
    'uncertainty_ellipses',
]

test.describe('layerAttachmentConfigs.json — built-in attachment registry', () => {
    // Generated (gitignored) artifact — generate it before reading.
    test.beforeAll(() => {
        updateLayerAttachments()
    })

    test('every built-in attachment is registered with a valid manifest', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))

        for (const attachmentId of BUILT_IN_ATTACHMENTS) {
            const entry = registry[attachmentId]
            expect(entry, `registry entry for '${attachmentId}'`).toBeDefined()
            expect(entry.manifest.attachmentId).toBe(attachmentId)
            expect(entry.manifest.type).toBe('layerattachment')
            expect(
                validatePluginConfig(
                    entry.manifest,
                    entry.manifest.name,
                    'layerattachment'
                )
            ).toEqual([])
        }
    })

    test('registry contains no unexpected attachments', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
        expect(Object.keys(registry).sort()).toEqual(
            [...BUILT_IN_ATTACHMENTS].sort()
        )
    })

    test('an attachment declares where it draws, which is what core asks it', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
        const capabilities = (id) => registry[id].manifest.capabilities

        // Map ordering skips attachments with nothing on the 2D map.
        expect(capabilities('model').renderers.map).toBe(false)
        expect(capabilities('labels').renderers.map).toBeTruthy()

        // A path gradient IS its host's geometry drawn differently on the
        // globe, so core must not draw the host there as well.
        expect(capabilities('path_gradient').globe.suppressesHost).toBe(true)
        expect(capabilities('labels').globe?.suppressesHost).toBeUndefined()
    })

    test('every attachment builds itself, in ops core knows', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))

        for (const attachmentId of BUILT_IN_ATTACHMENTS) {
            const manifest = registry[attachmentId].manifest
            const modulePath = path.join(
                PLUGINS_ROOT,
                'core',
                'layerattachments',
                manifest.name,
                `${manifest.paths.plugin}.js`
            )
            const source = fs.readFileSync(modulePath, 'utf8')

            // `make` is the attachment: core builds nothing itself, it asks.
            expect(
                validateLayerTypeModuleShape(
                    source,
                    attachmentId,
                    'attachment'
                )
            ).toEqual([])
        }
    })

    test('an attachment declares where it sits on its host', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
        const host = (id) => registry[id].manifest.capabilities.host

        // Build order is also render order (bottom on top), so it is declared
        // rather than left to whatever order the plugins are discovered in.
        const orders = BUILT_IN_ATTACHMENTS.map((id) => host(id).order)
        expect(orders.every((o) => typeof o === 'number')).toBe(true)
        expect(new Set(orders).size).toBe(orders.length)

        // Labels decorate the other attachments, so they are built last and
        // handed their siblings.
        expect(host('labels').buildsAfterSiblings).toBe(true)
        expect(host('pairings').buildsAfterSiblings).toBeUndefined()

        // Only where the key on the host differs from the attachment's id.
        expect(host('model').sublayerKey).toBe('models')
        expect(host('labels').sublayerKey).toBeUndefined()
    })
})
