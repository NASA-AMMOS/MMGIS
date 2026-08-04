const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('__Name__ attachment', () => {
    test('plugin.json declares a valid layerattachment contract', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.type).toBe('layerattachment')
        expect(manifest.attachmentId).toBe('__snake_name__')
        // Settings live on the host, so the form must write where the
        // manifest says this attachment is configured.
        expect(manifest.configPath).toBe('variables.layerAttachments.__name__')
        for (const row of manifest.config.rows)
            for (const component of row.components)
                expect(component.field.startsWith(manifest.configPath)).toBe(true)
    })
})
