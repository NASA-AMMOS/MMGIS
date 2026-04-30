#!/usr/bin/env node

/**
 * resolve-tile-url
 *
 * Resolves vector tile source URLs from metadata endpoints.
 * Useful for providers that use versioned or rotating tile URLs
 * (e.g., OpenFreeMap's TileJSON endpoint).
 *
 * Supports:
 *   - TileJSON (spec: https://github.com/mapbox/tilejson-spec)
 *   - Direct tile URL passthrough (if already contains {z}/{x}/{y})
 *
 * Usage:
 *   node resolve-tile-url.js <url>
 *   node resolve-tile-url.js https://tiles.openfreemap.org/planet
 *   node resolve-tile-url.js --info https://tiles.openfreemap.org/planet
 *
 * Options:
 *   --info    Show full metadata (minzoom, maxzoom, layers, etc.)
 *   --help    Show this help message
 */

const args = process.argv.slice(2)

if (args.includes('--help') || args.length === 0) {
    console.log(`
resolve-tile-url — Resolve vector tile source URLs from metadata endpoints

Usage:
  node resolve-tile-url.js <url>
  node resolve-tile-url.js --info <url>

Examples:
  node resolve-tile-url.js https://tiles.openfreemap.org/planet
  node resolve-tile-url.js --info https://tiles.openfreemap.org/planet

The resolved URL can be used directly in MMGIS layer configuration
as the URL field for vectortile or vectortile3d layer types.

Options:
  --info    Show full metadata (zoom range, available layers, attribution)
  --help    Show this help message
`)
    process.exit(0)
}

const showInfo = args.includes('--info')
const url = args.find((a) => !a.startsWith('--'))

if (!url) {
    console.error('Error: No URL provided')
    process.exit(1)
}

// If URL already has tile placeholders, just pass it through
if (url.includes('{z}') && url.includes('{x}') && url.includes('{y}')) {
    console.log(url)
    process.exit(0)
}

async function resolve() {
    try {
        const response = await fetch(url)

        if (!response.ok) {
            console.error(`Error: HTTP ${response.status} from ${url}`)
            process.exit(1)
        }

        const contentType = response.headers.get('content-type') || ''

        // Try to parse as JSON (TileJSON)
        let data
        try {
            data = await response.json()
        } catch (e) {
            console.error(
                `Error: Response from ${url} is not valid JSON (content-type: ${contentType})`
            )
            process.exit(1)
        }

        // TileJSON format
        if (data.tiles && Array.isArray(data.tiles) && data.tiles.length > 0) {
            if (showInfo) {
                console.log('Format:      TileJSON')
                console.log(`Tile URL:    ${data.tiles[0]}`)
                if (data.minzoom != null)
                    console.log(`Min Zoom:    ${data.minzoom}`)
                if (data.maxzoom != null)
                    console.log(`Max Zoom:    ${data.maxzoom}`)
                if (data.name) console.log(`Name:        ${data.name}`)
                if (data.description)
                    console.log(`Description: ${data.description}`)
                if (data.attribution)
                    console.log(`Attribution: ${data.attribution}`)
                if (data.bounds)
                    console.log(`Bounds:      ${data.bounds.join(', ')}`)
                if (data.center)
                    console.log(`Center:      ${data.center.join(', ')}`)

                // Try to fetch a sample tile to list available layers
                if (data.center && data.center.length >= 3) {
                    const sampleLayers = await listLayers(
                        data.tiles[0],
                        data.center[0],
                        data.center[1],
                        Math.min(data.center[2] || 14, data.maxzoom || 14)
                    )
                    if (sampleLayers) {
                        console.log(`Layers:      ${sampleLayers.join(', ')}`)
                    }
                }
            } else {
                console.log(data.tiles[0])
            }
            process.exit(0)
        }

        console.error(
            'Error: Response does not contain a recognized tile URL format'
        )
        console.error(
            'Expected TileJSON with a "tiles" array. Keys found:',
            Object.keys(data).join(', ')
        )
        process.exit(1)
    } catch (e) {
        console.error(`Error: ${e.message}`)
        process.exit(1)
    }
}

/**
 * Fetch a sample tile to list available vector tile layers
 */
async function listLayers(tileUrlTemplate, lng, lat, zoom) {
    try {
        const { VectorTile } = await import('@mapbox/vector-tile')
        const PbfModule = await import('pbf')
        const Pbf = PbfModule.default || PbfModule

        const z = Math.floor(zoom)
        const n = Math.pow(2, z)
        const x = Math.floor(((lng + 180) / 360) * n)
        const latRad = (lat * Math.PI) / 180
        const y = Math.floor(
            ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
                2) *
                n
        )

        const tileUrl = tileUrlTemplate
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y)

        const response = await fetch(tileUrl)
        if (!response.ok || response.headers.get('content-length') === '0')
            return null

        const arrayBuffer = await response.arrayBuffer()
        if (arrayBuffer.byteLength === 0) return null

        const tile = new VectorTile(new Pbf(arrayBuffer))
        return Object.keys(tile.layers)
    } catch (e) {
        return null
    }
}

resolve()
