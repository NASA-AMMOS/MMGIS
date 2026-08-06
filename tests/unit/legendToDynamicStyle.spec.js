import { test, expect } from '@playwright/test'
import {
    legendToDynamicStyle,
    stylingEntries,
} from '../../configure/src/core/legendToDynamicStyle.js'
import { compileDynamicStyle } from '../../src/essence/Basics/Layers_/render/dynamicStyle.js'
import { rgbToHex } from '../../src/essence/Basics/Layers_/render/gradientUtils.js'

/**
 * legendToDynamicStyle unit tests — a converted configuration must colour the
 * features the way the legend entries used to, or the migration isn't one.
 */

test.describe('legendToDynamicStyle - stylingEntries', () => {
    test('only entries that were actually styling count', () => {
        expect(
            stylingEntries([
                {
                    styleMatching: true,
                    propertyName: 'kind',
                    propertyValue: 'a',
                },
                {
                    styleMatching: false,
                    propertyName: 'kind',
                    propertyValue: 'b',
                },
                { styleMatching: true, propertyValue: 'c' },
                { styleMatching: true, propertyName: 'kind' },
                { value: 'Just a label', shape: 'circle' },
            ]).length
        ).toBe(1)
        expect(stylingEntries(undefined)).toEqual([])
    })
})

test.describe('legendToDynamicStyle', () => {
    test('a layer whose legend styled nothing converts to nothing', () => {
        expect(legendToDynamicStyle([])).toBe(null)
        expect(
            legendToDynamicStyle([
                { value: 'Trail', shape: 'circle', color: '#33cc33' },
            ])
        ).toBe(null)
    })

    test('a continuous run becomes a numeric rule over its own values', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '100',
                color: '#ffffff',
            },
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '0',
                color: '#000000',
            },
        ])
        expect(converted.enabled).toBe(true)
        const rule = converted.rules[0]
        expect(rule).toMatchObject({
            property: 'depth',
            attribute: 'fillColor',
            type: 'numeric',
            ramp: [
                { position: 0, color: '#000000' },
                { position: 1, color: '#ffffff' },
            ],
            domain: { source: 'literal', min: 0, max: 100 },
        })

        // And it renders what the legend rendered.
        const resolve = compileDynamicStyle(converted)
        expect(resolve({ depth: 0 }).fillColor).toBe('#000000')
        expect(resolve({ depth: 100 }).fillColor).toBe('#ffffff')
    })

    test('unevenly spaced colours stay at the values they were drawn at', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '0',
                color: '#000000',
            },
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '10',
                color: '#ff0000',
            },
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '100',
                color: '#ffffff',
            },
        ])
        const rule = converted.rules[0]
        expect(rule.ramp).toEqual([
            { position: 0, color: '#000000' },
            { position: 0.1, color: '#ff0000' },
            { position: 1, color: '#ffffff' },
        ])

        // The middle colour belongs to 10, not to the midpoint of the scale.
        const resolve = compileDynamicStyle(converted)
        expect(rgbToHex(resolve({ depth: 10 }).fillColor)).toBe('#ff0000')
        expect(rgbToHex(resolve({ depth: 50 }).fillColor)).not.toBe('#ff0000')
    })

    test('a colourless entry moves neither end of the domain', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '0',
                color: '#000000',
            },
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '100',
                color: '#ffffff',
            },
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '500',
                strokecolor: '#00ff00',
            },
        ])
        const fill = converted.rules.find((r) => r.attribute === 'fillColor')
        expect(fill.domain).toMatchObject({ min: 0, max: 100 })

        // The stroke rule did get a colour at 500, so its scale runs that far.
        const stroke = converted.rules.find((r) => r.attribute === 'color')
        expect(stroke.domain).toMatchObject({ min: 0, max: 500 })
    })

    test('exact-match entries become a categorical rule, labelled as they were', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'kind',
                propertyValue: 'trail',
                color: '#33cc33',
                value: 'Trail',
            },
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'kind',
                propertyValue: 'zone',
                color: '#3333cc',
                value: 'Zone',
            },
        ])
        expect(converted.rules[0]).toMatchObject({
            property: 'kind',
            attribute: 'fillColor',
            type: 'categorical',
        })
        expect(converted.rules[0].mappings[0]).toMatchObject({
            value: 'trail',
            color: '#33cc33',
            label: 'Trail',
        })

        const resolve = compileDynamicStyle(converted)
        expect(resolve({ kind: 'zone' }).fillColor).toBe('#3333cc')
        expect(resolve({ kind: 'nothing like it' })).toBe(null)
    })

    test("a border colour becomes its own rule, as the old engine's strokecolor did", () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'kind',
                propertyValue: 'trail',
                color: '#33cc33',
                strokecolor: '#005500',
            },
        ])
        const resolve = compileDynamicStyle(converted)
        expect(resolve({ kind: 'trail' })).toEqual({
            fillColor: '#33cc33',
            color: '#005500',
        })
    })

    test('with no border colour, the old engine used the fill for both', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'kind',
                propertyValue: 'trail',
                color: '#33cc33',
            },
        ])
        const resolve = compileDynamicStyle(converted)
        expect(resolve({ kind: 'trail' })).toEqual({
            fillColor: '#33cc33',
            color: '#33cc33',
        })
    })

    test('two properties convert to their own rules', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'kind',
                propertyValue: 'trail',
                color: '#33cc33',
            },
            {
                styleMatching: true,
                shape: 'square',
                propertyName: 'status',
                propertyValue: 'old',
                color: '#888888',
            },
        ])
        expect([...new Set(converted.rules.map((r) => r.property))]).toEqual([
            'kind',
            'status',
        ])
    })

    test('a lone continuous entry has no range to stretch, so it converts to nothing', () => {
        const converted = legendToDynamicStyle([
            {
                styleMatching: true,
                shape: 'continuous',
                propertyName: 'depth',
                propertyValue: '10',
                color: '#ffffff',
            },
        ])
        expect(converted).toBe(null)
    })
})
