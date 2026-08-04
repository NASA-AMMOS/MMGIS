const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('__Name__ layer type', () => {
    test('plugin.json declares a valid layertype contract', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.type).toBe('layertype')
        expect(manifest.typeId).toBe('__flatname__')
        // Every declared renderer engine must ship a matching module.
        const r = manifest.capabilities.renderers
        if (r.map) expect(manifest.modules.map).toBeDefined()
    })
})
