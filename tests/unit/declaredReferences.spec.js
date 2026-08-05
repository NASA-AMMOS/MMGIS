/**
 * `$`-references in what a layer type declares for its attachments and
 * interactions.
 *
 * A type declares the other plugins' settings because it is the plugin that
 * knows them — but "which property holds the wind speed" is the admin's answer
 * on this layer, not a constant a manifest can hold. Without a reference form
 * the same property name is typed into three subtrees and has to agree; with
 * one it is answered on the type's own form, and the type still chooses which
 * of its fields the other plugin is handed.
 */

import { test, expect } from '@playwright/test'
import {
    resolveDeclaredReferences,
    mergeDeclaredConfig,
} from '../../src/essence/Basics/Layers_/registry/declaredConfig'
import { declaredAttachmentConfig } from '../../src/essence/Basics/Layers_/registry/attachmentDefaults'
import { resolveInteractionConfig } from '../../src/essence/Basics/Layers_/registry/interactionDefaults'

const layer = {
    name: 'Stations',
    type: 'windstation',
    variables: {
        windStation: { speedProp: 'wind_speed', scale: 3 },
    },
}

test.describe('resolveDeclaredReferences', () => {
    test('reads a $ reference off the layer', () => {
        expect(
            resolveDeclaredReferences(
                { speedProp: '$variables.windStation.speedProp' },
                layer
            )
        ).toEqual({ speedProp: 'wind_speed' })
    })

    test('leaves plain values, including falsy ones, alone', () => {
        expect(
            resolveDeclaredReferences(
                { label: 'wind', enabled: false, scale: 0 },
                layer
            )
        ).toEqual({ label: 'wind', enabled: false, scale: 0 })
    })

    test('resolves a reference to a non-string value as that value', () => {
        expect(
            resolveDeclaredReferences(
                { scale: '$variables.windStation.scale' },
                layer
            )
        ).toEqual({ scale: 3 })
    })

    test('a reference the layer cannot answer drops its key', () => {
        // Not the literal '$variables.…', and not null either: the plugin's own
        // `const { speedProp = 'speed' } = ctx.config` has to still apply.
        expect(
            resolveDeclaredReferences(
                { speedProp: '$variables.absent', scale: 2 },
                layer
            )
        ).toEqual({ scale: 2 })
    })

    test('$$ escapes a value that really starts with a $', () => {
        expect(resolveDeclaredReferences({ token: '$$literal' }, layer)).toEqual(
            { token: '$literal' }
        )
    })

    test('resolves inside nested objects and arrays', () => {
        expect(
            resolveDeclaredReferences(
                {
                    style: { prop: '$variables.windStation.speedProp' },
                    props: ['$variables.windStation.speedProp', 'fixed'],
                },
                layer
            )
        ).toEqual({
            style: { prop: 'wind_speed' },
            props: ['wind_speed', 'fixed'],
        })
    })

    test('no layer to read from drops every reference', () => {
        expect(
            resolveDeclaredReferences({ speedProp: '$variables.a' }, null)
        ).toEqual({})
    })

    test('passes non-objects through untouched', () => {
        expect(resolveDeclaredReferences(null, layer)).toBe(null)
        expect(resolveDeclaredReferences(['a'], layer)).toEqual(['a'])
    })
})

test.describe('a type declaring a reference for its attachment', () => {
    const capabilities = {
        defaultAttachments: {
            wind_barb: {
                speedProp: '$variables.windStation.speedProp',
                scale: 200,
            },
        },
    }

    test('the attachment is handed the layer\u2019s answer', () => {
        expect(
            declaredAttachmentConfig(capabilities, 'wind_barb', layer)
        ).toEqual({ speedProp: 'wind_speed', scale: 200 })
    })

    test('the layer\u2019s own attachment settings still win', () => {
        expect(
            mergeDeclaredConfig(
                { speedProp: 'gust' },
                declaredAttachmentConfig(capabilities, 'wind_barb', layer)
            )
        ).toEqual({ speedProp: 'gust', scale: 200 })
    })
})

test('a type declaring a reference for its interaction', () => {
    expect(
        resolveInteractionConfig(
            null,
            { speedProp: '$variables.windStation.speedProp' },
            layer
        )
    ).toEqual({ speedProp: 'wind_speed' })
})
