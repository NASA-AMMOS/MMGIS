/**
 * `capabilities.defaultAttachments` — a layer type declaring the attachments it
 * comes with, and what they should be.
 *
 * This is the seam a multi-family feature needed: before it, a type shipping an
 * attachment had to write the attachment's `configPath` into its own config
 * rows as a string literal, so a rename in either plugin broke the other. The
 * rules are asserted on the pure resolver (LayerAttachmentRegistry itself pulls
 * in the generated registries), plus the manifest validation and the registry's
 * dispatch through it.
 */

import { test, expect } from '@playwright/test'
import {
    declaredAttachmentConfig,
    resolveAttachmentConfig,
} from '../../src/essence/Basics/Layers_/registry/attachmentDefaults'

const fs = require('fs')
const path = require('path')

const { validatePluginConfig } = require('../../API/pluginValidation')

const REGISTRY = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../src/essence/Basics/Layers_/registry/LayerAttachmentRegistry.js'
    ),
    'utf8'
)

const manifest = (defaultAttachments) => ({
    name: 'Quakes',
    type: 'layertype',
    typeId: 'quakes',
    extends: 'vector',
    version: '1.0.0',
    tier: 'community',
    description: '',
    capabilities: { defaultAttachments },
    module: './quakes',
})

test.describe('a type declares the attachments it comes with', () => {
    test('declared settings are found by attachment id', () => {
        const capabilities = {
            defaultAttachments: { magnitude_rings: { scale: 200 } },
        }
        expect(declaredAttachmentConfig(capabilities, 'magnitude_rings')).toEqual({
            scale: 200,
        })
        expect(declaredAttachmentConfig(capabilities, 'labels')).toBeNull()
        expect(declaredAttachmentConfig({}, 'labels')).toBeNull()
        expect(declaredAttachmentConfig(undefined, 'labels')).toBeNull()
    })

    test('an empty declaration still means "on"', () => {
        // `{}` is the whole point of the object form: the type wants the
        // attachment and has nothing to say about it, which must not read the
        // same as not declaring it at all.
        const declared = declaredAttachmentConfig(
            { defaultAttachments: { labels: {} } },
            'labels'
        )
        expect(declared).toEqual({})
        expect(resolveAttachmentConfig(null, declared)).toEqual({})
    })

    test('a malformed declaration is ignored rather than half-applied', () => {
        for (const bad of [true, 'labels', ['labels'], null]) {
            expect(
                declaredAttachmentConfig({ defaultAttachments: { labels: bad } }, 'labels')
            ).toBeNull()
        }
    })
})

test.describe('a layer overrides its type field by field', () => {
    test('a layer with no settings of its own gets the type\'s', () => {
        expect(resolveAttachmentConfig(null, { scale: 200 })).toEqual({ scale: 200 })
    })

    test('a layer keeps the fields it did not set', () => {
        expect(
            resolveAttachmentConfig({ scale: 50 }, { scale: 200, prop: 'mag' })
        ).toEqual({ scale: 50, prop: 'mag' })
    })

    test('a layer can turn off an attachment its type came with', () => {
        const config = resolveAttachmentConfig({ enabled: false }, { scale: 200 })
        expect(config.enabled).toBe(false)
    })

    test('an untouched form field does not beat the type', () => {
        // Configure writes '' into a row nobody filled in, which would
        // otherwise leave the attachment with no property name at all.
        expect(
            resolveAttachmentConfig(
                { magnitudeProp: '', scale: 50 },
                { magnitudeProp: 'mag', scale: 200 }
            )
        ).toEqual({ magnitudeProp: 'mag', scale: 50 })
        // A field the type says nothing about is the layer's either way.
        expect(resolveAttachmentConfig({ label: '' }, { scale: 200 })).toEqual({
            scale: 200,
            label: '',
        })
        // false and 0 are answers, not empties.
        expect(
            resolveAttachmentConfig({ enabled: false, scale: 0 }, { scale: 200 })
        ).toEqual({ enabled: false, scale: 0 })
    })

    test('nothing declared and nothing configured stays nothing', () => {
        expect(resolveAttachmentConfig(null, null)).toBeNull()
    })

    test('the resolved config is a copy, not the manifest object', () => {
        // Attachments are handed this config on every make/sync; mutating it
        // would edit the plugin's manifest for every other layer of the type.
        const declared = { scale: 200 }
        const resolved = resolveAttachmentConfig(null, declared)
        resolved.scale = 1
        expect(declared.scale).toBe(200)
    })
})

test.describe('manifest validation', () => {
    test('an object of settings per attachment is valid', () => {
        expect(
            validatePluginConfig(
                manifest({ magnitude_rings: { scale: 200 }, labels: {} }),
                'Quakes',
                'layertype'
            )
        ).toEqual([])
    })

    test('a list of ids is rejected, since it cannot say how', () => {
        const errors = validatePluginConfig(
            manifest(['magnitude_rings']),
            'Quakes',
            'layertype'
        )
        expect(errors.some((e) => e.includes('defaultAttachments'))).toBe(true)
    })

    test('a non-object per attachment is rejected', () => {
        const errors = validatePluginConfig(
            manifest({ magnitude_rings: true }),
            'Quakes',
            'layertype'
        )
        expect(
            errors.some((e) => e.includes('defaultAttachments.magnitude_rings'))
        ).toBe(true)
    })
})

test.describe('core reads it through the registry', () => {
    test('configFor and isEnabledOn both go through the resolver', () => {
        expect(REGISTRY).toContain('resolveAttachmentConfig(')
        expect(REGISTRY).toContain('declaredAttachmentConfig(')
        // isEnabledOn asks configFor rather than the raw config path, so a
        // type-declared attachment counts as enabled.
        expect(REGISTRY).toContain('const config = this.configFor(attachmentId, layerObj)')
    })
})
