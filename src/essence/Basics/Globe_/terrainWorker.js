/**
 * Web Worker for parsing terrain tile PNG pixel data into heightmaps.
 * Offloads the expensive 65K-iteration pixel-to-height conversion from the
 * main thread so Cesium camera interactions remain smooth.
 *
 * Message protocol:
 *   IN:  { id, imageData (Uint8ClampedArray), width, height, parserType }
 *   OUT: { id, heightMap (Float64Array) }       — transferred, not copied
 */

self.onmessage = function (e) {
    const { id, imageData, width, height, parserType } = e.data
    const len = width * height
    const heightMap = new Float64Array(len)

    if (parserType === 'terrarium') {
        // Terrarium: (R * 256 + G + B / 256) - 32768
        for (let i = 0; i < len; i++) {
            const off = i * 4
            heightMap[i] =
                imageData[off] * 256 +
                imageData[off + 1] +
                imageData[off + 2] / 256 -
                32768
        }
    } else {
        // TerrainRGB / Mapbox: -10000 + ((R * 65536 + G * 256 + B) * 0.1)
        for (let i = 0; i < len; i++) {
            const off = i * 4
            const A = imageData[off + 3]
            if (A === 0) {
                heightMap[i] = 0
            } else {
                heightMap[i] =
                    -10000 +
                    (imageData[off] * 65536 +
                        imageData[off + 1] * 256 +
                        imageData[off + 2]) *
                        0.1
            }
        }
    }

    // Transfer the buffer so it isn't copied
    self.postMessage({ id, heightMap }, [heightMap.buffer])
}
