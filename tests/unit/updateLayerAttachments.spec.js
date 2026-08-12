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

// Attachments that are renderables of their own, listed on their host.
const BUILT_IN_SUBLAYER_ATTACHMENTS = [
    'coordinate_markers',
    'image_overlays',
    'labels',
    'model',
    'pairings',
    'path_gradient',
    'uncertainty_ellipses',
]

// Attachments that draw nothing of their own and instead change how their host
// draws itself.
const BUILT_IN_DECORATION_ATTACHMENTS = ['bearing']

const BUILT_IN_ATTACHMENTS = [
    ...BUILT_IN_SUBLAYER_ATTACHMENTS,
    ...BUILT_IN_DECORATION_ATTACHMENTS,
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
        // Only core's own attachments: the registry is a shared generated
        // artifact, so another spec's fixture may legitimately be in it now.
        const core = Object.keys(registry).filter(
            (id) => registry[id].manifest.tier === 'core'
        )
        expect(core.sort()).toEqual([...BUILT_IN_ATTACHMENTS].sort())
    })

    test('the registry reads the module map the generator writes', () => {
        // Both sides of a generated boundary, so a rename of the module key
        // fails here instead of silently making every op of every attachment
        // look undeclared (which is a no-op, not an error).
        updateLayerAttachments()
        const generated = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'pre', 'layerattachments.js'),
            'utf8'
        )
        const registrySource = fs.readFileSync(
            path.join(
                REPO_ROOT,
                'src',
                'essence',
                'Basics',
                'Layers_',
                'registry',
                'LayerAttachmentRegistry.js'
            ),
            'utf8'
        )

        const emitted = new Set(
            [...generated.matchAll(/\{\s*"(\w+)"\s*:/g)].map((m) => m[1])
        )
        expect(emitted.size).toBeGreaterThan(0)

        const read = [
            ...registrySource.matchAll(/\bmods(?:\[[^\]]+\])?\?\.(\w+)/g),
        ].map((m) => m[1])
        expect(read.length).toBeGreaterThan(0)
        for (const key of read) expect([...emitted]).toContain(key)
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

        for (const attachmentId of BUILT_IN_SUBLAYER_ATTACHMENTS) {
            const manifest = registry[attachmentId].manifest
            const modulePath = path.join(
                PLUGINS_ROOT,
                'core',
                'layerattachments',
                manifest.name,
                `${manifest.module}.js`
            )
            const source = fs.readFileSync(modulePath, 'utf8')

            // `make` is the attachment: core builds nothing itself, it asks.
            expect(
                validateLayerTypeModuleShape(source, attachmentId, 'attachment')
            ).toEqual([])
        }
    })

    test('an attachment declares where it sits on its host', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
        const host = (id) => registry[id].manifest.capabilities.host

        // Build order is also render order (bottom on top), so it is declared
        // rather than left to whatever order the plugins are discovered in.
        const orders = BUILT_IN_SUBLAYER_ATTACHMENTS.map((id) => host(id).order)
        expect(orders.every((o) => typeof o === 'number')).toBe(true)
        expect(new Set(orders).size).toBe(orders.length)

        // Labels decorate the other attachments, so they are built last and
        // handed their siblings.
        expect(host('labels').buildsAfterSiblings).toBe(true)
        expect(host('pairings').buildsAfterSiblings).toBeUndefined()

        // Only where the key on the host differs from the attachment's id.
        expect(host('model').sublayerKey).toBe('models')
        expect(host('labels').sublayerKey).toBeUndefined()

        // A decoration has no place on its host to sit: it is not a renderable
        // and never appears in the host's attachments.
        expect(host('bearing').decoratesHost).toBe(true)
        expect(host('bearing').order).toBeUndefined()
    })

    test('an attachment declares where it is configured on its host', () => {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
        const configPath = (id) => registry[id].manifest.configPath

        // Core resolves this to decide whether a host wants the attachment at
        // all, so every attachment must answer it, and the answer must live
        // under the host's `variables`.
        for (const attachmentId of BUILT_IN_ATTACHMENTS) {
            expect(typeof configPath(attachmentId)).toBe('string')
            expect(configPath(attachmentId).startsWith('variables.')).toBe(true)
        }

        // An attachment's id, its key on the host and its config key are three
        // different names, which is the reason this is declared at all.
        expect(configPath('image_overlays')).toBe(
            'variables.markerAttachments.image'
        )
        expect(configPath('coordinate_markers')).toBe(
            'variables.coordinateAttachments.marker'
        )

        // Two attachments configured under one key would make "is this
        // attachment wanted?" ambiguous.
        const paths = BUILT_IN_ATTACHMENTS.map(configPath)
        expect(new Set(paths).size).toBe(paths.length)
    })
})
