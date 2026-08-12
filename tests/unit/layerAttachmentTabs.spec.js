/**
 * Unit tests for composing the Layer modal's attachment settings from the
 * attachment registry: the Configure page asks the attachments what a layer of
 * this type can be configured with, instead of each layer type's config
 * carrying a pasted copy of every attachment's fields.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const {
    attachmentTabsFor,
    attachmentConfigPaths,
} = require('../../configure/src/core/layerAttachmentTabs')
const { updateLayerAttachments } = require('../../API/updateTools')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const REGISTRY_PATH = path.join(
    REPO_ROOT,
    'configure',
    'public',
    'layerAttachmentConfigs.json'
)

const registry = () => JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))

const rowsOf = (tabs) => tabs.flatMap((t) => t.rows)

// An `objectarray`'s `object` describes one item of the array, and its inner
// `field`s are relative to the array's own field — so they are not paths and
// must not be walked into as if they were.
const fieldsOf = (rows) => {
    const fields = []
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (node == null || typeof node !== 'object') return
        if (typeof node.field === 'string') fields.push(node.field)
        Object.entries(node).forEach(([key, value]) => {
            if (node.type === 'objectarray' && key === 'object') return
            walk(value)
        })
    }
    walk(rows)
    return fields
}

test.describe('attachment settings in the Layer modal', () => {
    // Generated (gitignored) artifact — generate it before reading.
    test.beforeAll(() => {
        updateLayerAttachments()
    })

    test('every attachment applicable to a host contributes its settings', () => {
        const tabs = attachmentTabsFor(registry(), {}, 'vector')
        const tabNames = tabs.map((t) => t.name)

        // Core's tabs, in order. An installed third-party attachment may add
        // tabs of its own, so this is a subsequence rather than the whole list.
        expect(
            tabNames.filter((name) =>
                [
                    'Attachment - Layers',
                    'Attachment - Coordinates',
                    'Attachment - Markers',
                    'Attachment - Paths',
                ].includes(name)
            )
        ).toEqual([
            'Attachment - Layers',
            'Attachment - Coordinates',
            'Attachment - Markers',
            'Attachment - Paths',
        ])
        // Attachments sharing a tab are merged into it rather than each
        // getting one of their own.
        expect(new Set(tabNames).size).toBe(tabNames.length)
        expect(rowsOf(tabs).length).toBeGreaterThan(0)
    })

    test('a settings field belongs to the attachment that reads it', () => {
        const tabs = attachmentTabsFor(registry(), {}, 'vector')
        const paths = attachmentConfigPaths(registry())

        // Otherwise the page would write settings the attachment never reads.
        for (const field of fieldsOf(rowsOf(tabs))) {
            expect(paths.some((p) => field.startsWith(`${p}.`))).toBe(true)
        }
    })

    // An installed third-party attachment is part of the registry these tests
    // read, so neither assertion above may depend on core being all there is.
    test('an installed attachment may add a tab and nested item fields', () => {
        const thirdParty = {
            ...registry(),
            RangeRings: {
                manifest: {
                    attachmentId: 'range_rings',
                    configPath: 'variables.layerAttachments.rangeRings',
                    applicableLayerTypes: ['vector'],
                },
                config: {
                    tab: 'Attachment - Ranges',
                    tabOrder: 100,
                    rows: [
                        {
                            components: [
                                {
                                    type: 'objectarray',
                                    field: 'variables.layerAttachments.rangeRings.rings',
                                    name: 'Rings',
                                    // Relative to the array's own field, so not
                                    // paths under `configPath`.
                                    object: [
                                        { type: 'number', field: 'radius' },
                                        { type: 'colorpicker', field: 'color' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        }
        const tabs = attachmentTabsFor(thirdParty, {}, 'vector')
        const paths = attachmentConfigPaths(thirdParty)

        expect(tabs.map((t) => t.name)).toContain('Attachment - Ranges')
        for (const field of fieldsOf(rowsOf(tabs))) {
            expect(paths.some((p) => field.startsWith(`${p}.`))).toBe(true)
        }
    })

    test('a layer type inherits the attachments of the type it extends', () => {
        const layerTypes = {
            mytype: { manifest: { typeId: 'mytype', extends: 'vector' } },
        }
        const inherited = attachmentTabsFor(registry(), layerTypes, 'mytype')
        const parent = attachmentTabsFor(registry(), layerTypes, 'vector')

        expect(inherited).toEqual(parent)
    })

    test('a host that no attachment applies to has no attachment settings', () => {
        // A tile layer has nothing to attach to, so the modal must not offer
        // settings that would never be read.
        expect(attachmentTabsFor(registry(), {}, 'tile')).toEqual([])
        expect(attachmentTabsFor(registry(), {}, null)).toEqual([])
    })
})
