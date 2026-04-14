/**
 * Web Worker for decoding terrain tile PNGs into heightmaps.
 * Handles the FULL pipeline inside the worker: fetch -> decode -> parse -> return.
 * This keeps the main thread completely free during terrain loading.
 *
 * Message protocol:
 *   IN:  { id, url, parserType, cropBuffer, tileSize }
 *   OUT: { id, heightMap (Float32Array) }  -- transferred, not copied
 *   ERR: { id, empty: true }               -- tile failed / missing
 */

// Reusable OffscreenCanvas (one per worker, avoids allocation per tile)
let canvas = null
let ctx = null

function ensureCanvas(size) {
    if (!canvas || canvas.width !== size) {
        canvas = new OffscreenCanvas(size, size)
        ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false
    }
    return ctx
}

self.onmessage = async function (e) {
    const { id, url, parserType, cropBuffer, tileSize } = e.data

    try {
        const response = await fetch(url, { cache: 'force-cache' })
        if (!response.ok) {
            self.postMessage({ id, empty: true })
            return
        }

        const blob = await response.blob()
        const imageBitmap = await createImageBitmap(blob)
        const drawCtx = ensureCanvas(tileSize)

        // Draw image (crop 1px border for TerrainRGB/Mapbox formats)
        if (cropBuffer) {
            drawCtx.drawImage(
                imageBitmap,
                1,
                1,
                imageBitmap.width - 2,
                imageBitmap.height - 2,
                0,
                0,
                tileSize,
                tileSize
            )
        } else {
            drawCtx.drawImage(imageBitmap, 0, 0, tileSize, tileSize)
        }
        imageBitmap.close()

        const pixels = drawCtx.getImageData(0, 0, tileSize, tileSize).data
        const len = tileSize * tileSize
        const heightMap = new Float32Array(len)

        if (parserType === 'terrarium') {
            for (let i = 0; i < len; i++) {
                const off = i << 2
                heightMap[i] =
                    pixels[off] * 256 +
                    pixels[off + 1] +
                    pixels[off + 2] / 256 -
                    32768
            }
        } else {
            // TerrainRGB / Mapbox
            for (let i = 0; i < len; i++) {
                const off = i << 2
                const A = pixels[off + 3]
                heightMap[i] =
                    A === 0
                        ? 0
                        : -10000 +
                          (pixels[off] * 65536 +
                              pixels[off + 1] * 256 +
                              pixels[off + 2]) *
                              0.1
            }
        }

        self.postMessage({ id, heightMap }, [heightMap.buffer])
    } catch (_err) {
        self.postMessage({ id, empty: true })
    }
}
