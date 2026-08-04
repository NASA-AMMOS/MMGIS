/**
 * Unit tests for composing the Layer modal's attachment settings from the
 * attachment registry: the Configure page asks the attachments what a layer of
 * this type can be configured with, instead of each layer type's metaconfig
 * carrying a pasted copy of every attachment's fields.
 */

import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')

const {
    attachmentTabsFor,
    attachmentConfigPaths,
} = require('../../configure/src/core/layerAttachmentTabs')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const REGISTRY_PATH = path.join(
    REPO_ROOT,
    'configure',
    'public',
    'layerAttachmentConfigs.json'
)

const registry = () => JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))

const rowsOf = (tabs) => tabs.flatMap((t) => t.rows)

const fieldsOf = (rows) => {
    const fields = []
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (node == null || typeof node !== 'object') return
        if (typeof node.field === 'string') fields.push(node.field)
        Object.values(node).forEach(walk)
    }
    walk(rows)
    return fields
}

test.describe('attachment settings in the Layer modal', () => {
    test('every attachment applicable to a host contributes its settings', () => {
        const tabs = attachmentTabsFor(registry(), {}, 'vector')
        const tabNames = tabs.map((t) => t.name)

        expect(tabNames).toEqual([
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
