/**
 * Web Worker for terrain tile processing.
 * Full pipeline: fetch -> decode -> parse heightmap -> generate TIN mesh -> return.
 * Uses RTIN (Right-Triangulated Irregular Network) via inlined Mapbox Martini algorithm
 * to produce adaptive meshes (~2-3K vertices instead of 65K from a regular grid).
 *
 * Message protocol:
 *   IN:  { id, url, parserType, cropBuffer, tileSize, maxMeshError }
 *   OUT: { id, vertices (Uint16Array), triangles (Uint32Array),
 *          minimumHeight, maximumHeight, gridSize }
 *   ERR: { id, empty: true }
 *
 * Based on @mapbox/martini (ISC License, Copyright 2019 Mapbox)
 */

// ── Inlined Martini RTIN algorithm ──────────────────────────────────

class Martini {
    constructor(gridSize = 257) {
        this.gridSize = gridSize
        const tileSize = gridSize - 1
        if (tileSize & (tileSize - 1))
            throw new Error(
                `Expected grid size to be 2^n+1, got ${gridSize}.`
            )

        this.numTriangles = tileSize * tileSize * 2 - 2
        this.numParentTriangles = this.numTriangles - tileSize * tileSize

        this.indices = new Uint32Array(this.gridSize * this.gridSize)

        this.coords = new Uint16Array(this.numTriangles * 4)

        for (let i = 0; i < this.numTriangles; i++) {
            let id = i + 2
            let ax = 0,
                ay = 0,
                bx = 0,
                by = 0,
                cx = 0,
                cy = 0
            if (id & 1) {
                bx = by = cx = tileSize
            } else {
                ax = ay = cy = tileSize
            }
            while ((id >>= 1) > 1) {
                const mx = (ax + bx) >> 1
                const my = (ay + by) >> 1
                if (id & 1) {
                    bx = ax
                    by = ay
                    ax = cx
                    ay = cy
                } else {
                    ax = bx
                    ay = by
                    bx = cx
                    by = cy
                }
                cx = mx
                cy = my
            }
            const k = i * 4
            this.coords[k + 0] = ax
            this.coords[k + 1] = ay
            this.coords[k + 2] = bx
            this.coords[k + 3] = by
        }
    }

    createTile(terrain) {
        return new Tile(terrain, this)
    }
}

class Tile {
    constructor(terrain, martini) {
        const size = martini.gridSize
        if (terrain.length !== size * size)
            throw new Error(
                `Expected terrain data of length ${size * size}, got ${terrain.length}.`
            )
        this.terrain = terrain
        this.martini = martini
        this.errors = new Float32Array(terrain.length)
        this.update()
    }

    update() {
        const {
            numTriangles,
            numParentTriangles,
            coords,
            gridSize: size,
        } = this.martini
        const { terrain, errors } = this

        for (let i = numTriangles - 1; i >= 0; i--) {
            const k = i * 4
            const ax = coords[k + 0]
            const ay = coords[k + 1]
            const bx = coords[k + 2]
            const by = coords[k + 3]
            const mx = (ax + bx) >> 1
            const my = (ay + by) >> 1
            const cx = mx + my - ay
            const cy = my + ax - mx

            const interpolatedHeight =
                (terrain[ay * size + ax] + terrain[by * size + bx]) / 2
            const middleIndex = my * size + mx
            const middleError = Math.abs(
                interpolatedHeight - terrain[middleIndex]
            )

            errors[middleIndex] = Math.max(errors[middleIndex], middleError)

            if (i < numParentTriangles) {
                const leftChildIndex =
                    ((ay + cy) >> 1) * size + ((ax + cx) >> 1)
                const rightChildIndex =
                    ((by + cy) >> 1) * size + ((bx + cx) >> 1)
                errors[middleIndex] = Math.max(
                    errors[middleIndex],
                    errors[leftChildIndex],
                    errors[rightChildIndex]
                )
            }
        }
    }

    getMesh(maxError = 0) {
        const { gridSize: size, indices } = this.martini
        const { errors } = this
        let numVertices = 0
        let numTriangles = 0
        const max = size - 1

        indices.fill(0)

        function countElements(ax, ay, bx, by, cx, cy) {
            const mx = (ax + bx) >> 1
            const my = (ay + by) >> 1
            if (
                Math.abs(ax - cx) + Math.abs(ay - cy) > 1 &&
                errors[my * size + mx] > maxError
            ) {
                countElements(cx, cy, ax, ay, mx, my)
                countElements(bx, by, cx, cy, mx, my)
            } else {
                indices[ay * size + ax] =
                    indices[ay * size + ax] || ++numVertices
                indices[by * size + bx] =
                    indices[by * size + bx] || ++numVertices
                indices[cy * size + cx] =
                    indices[cy * size + cx] || ++numVertices
                numTriangles++
            }
        }
        countElements(0, 0, max, max, max, 0)
        countElements(max, max, 0, 0, 0, max)

        const vertices = new Uint16Array(numVertices * 2)
        const triangles = new Uint32Array(numTriangles * 3)
        let triIndex = 0

        function processTriangle(ax, ay, bx, by, cx, cy) {
            const mx = (ax + bx) >> 1
            const my = (ay + by) >> 1
            if (
                Math.abs(ax - cx) + Math.abs(ay - cy) > 1 &&
                errors[my * size + mx] > maxError
            ) {
                processTriangle(cx, cy, ax, ay, mx, my)
                processTriangle(bx, by, cx, cy, mx, my)
            } else {
                const a = indices[ay * size + ax] - 1
                const b = indices[by * size + bx] - 1
                const c = indices[cy * size + cx] - 1
                vertices[2 * a] = ax
                vertices[2 * a + 1] = ay
                vertices[2 * b] = bx
                vertices[2 * b + 1] = by
                vertices[2 * c] = cx
                vertices[2 * c + 1] = cy
                triangles[triIndex++] = a
                triangles[triIndex++] = b
                triangles[triIndex++] = c
            }
        }
        processTriangle(0, 0, max, max, max, 0)
        processTriangle(max, max, 0, 0, 0, max)

        return { vertices, triangles }
    }
}

// ── End Martini ─────────────────────────────────────────────────────

// Reuse one Martini instance per grid size (they are stateless after construction)
const martiniCache = new Map()
function getMartini(gridSize) {
    if (!martiniCache.has(gridSize)) {
        martiniCache.set(gridSize, new Martini(gridSize))
    }
    return martiniCache.get(gridSize)
}

// Reusable OffscreenCanvas (one per worker, avoids allocation per tile)
let canvas = null
let ctx = null

function ensureCanvas(size) {
    if (!canvas || canvas.width !== size) {
        canvas = new OffscreenCanvas(size, size)
        ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false
    }
    ctx.clearRect(0, 0, size, size)
    return ctx
}

self.onmessage = async function (e) {
    const { id, url, parserType, cropBuffer, tileSize, maxMeshError, returnMode } = e.data

    try {
        const response = await fetch(url, { cache: 'force-cache' })
        if (!response.ok) {
            self.postMessage({ id, empty: true })
            return
        }

        const blob = await response.blob()
        const imageBitmap = await createImageBitmap(blob)
        const drawCtx = ensureCanvas(tileSize)

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

        // Parse pixels into a 256x256 heightmap
        const heightMap256 = new Float32Array(len)
        if (parserType === 'terrarium') {
            for (let i = 0; i < len; i++) {
                const off = i << 2
                heightMap256[i] =
                    pixels[off] * 256 +
                    pixels[off + 1] +
                    pixels[off + 2] / 256 -
                    32768
            }
        } else {
            for (let i = 0; i < len; i++) {
                const off = i << 2
                const A = pixels[off + 3]
                heightMap256[i] =
                    A === 0
                        ? 0
                        : -10000 +
                          (pixels[off] * 65536 +
                              pixels[off + 1] * 256 +
                              pixels[off + 2]) *
                              0.1
            }
        }

        // Pad 256x256 -> 257x257 (martini requires 2^n+1 grid)
        const gridSize = tileSize + 1
        const terrain = new Float32Array(gridSize * gridSize)
        for (let y = 0; y < tileSize; y++) {
            for (let x = 0; x < tileSize; x++) {
                terrain[y * gridSize + x] = heightMap256[y * tileSize + x]
            }
            // Duplicate last column
            terrain[y * gridSize + tileSize] =
                heightMap256[y * tileSize + (tileSize - 1)]
        }
        // Duplicate last row
        for (let x = 0; x <= tileSize; x++) {
            terrain[tileSize * gridSize + x] =
                terrain[(tileSize - 1) * gridSize + x]
        }

        // Compute min/max heights
        let minimumHeight = Infinity
        let maximumHeight = -Infinity
        for (let i = 0; i < terrain.length; i++) {
            if (terrain[i] < minimumHeight) minimumHeight = terrain[i]
            if (terrain[i] > maximumHeight) maximumHeight = terrain[i]
        }

        // ── Heightmap mode: return raw heights for HeightmapTerrainData ──
        if (returnMode === 'heightmap') {
            self.postMessage(
                { id, heightmap: terrain, minimumHeight, maximumHeight, gridSize },
                [terrain.buffer]
            )
            return
        }

        // Generate TIN mesh using RTIN (martini)
        // maxMeshError controls quality: 0 = lossless, higher = fewer triangles
        const errorTolerance =
            maxMeshError !== undefined ? maxMeshError : 5.0
        const martini = getMartini(gridSize)
        const tile = martini.createTile(terrain)
        const mesh = tile.getMesh(errorTolerance)

        // Build quantized vertices: [u0..uN, v0..vN, h0..hN] in range [0, 32767]
        const numVerts = mesh.vertices.length / 2
        const quantizedVertices = new Uint16Array(numVerts * 3)
        const heightRange = maximumHeight - minimumHeight || 1

        for (let i = 0; i < numVerts; i++) {
            const gx = mesh.vertices[2 * i]
            const gy = mesh.vertices[2 * i + 1]
            const h = terrain[gy * gridSize + gx]

            // u, v: grid position -> [0, 32767]
            quantizedVertices[i] = Math.round(
                (gx / (gridSize - 1)) * 32767
            )
            // Flip gy: PNG row 0 is north, but Cesium v=0 is south
            quantizedVertices[numVerts + i] = Math.round(
                ((gridSize - 1 - gy) / (gridSize - 1)) * 32767
            )
            quantizedVertices[2 * numVerts + i] = Math.round(
                ((h - minimumHeight) / heightRange) * 32767
            )
        }

        // Identify edge vertices (needed for tile stitching)
        const westIndices = []
        const southIndices = []
        const eastIndices = []
        const northIndices = []
        for (let i = 0; i < numVerts; i++) {
            const u = quantizedVertices[i]
            const v = quantizedVertices[numVerts + i]
            if (u === 0) westIndices.push(i)
            if (u === 32767) eastIndices.push(i)
            if (v === 0) southIndices.push(i)
            if (v === 32767) northIndices.push(i)
        }

        // Transfer all typed arrays (zero-copy)
        const result = {
            id,
            quantizedVertices,
            triangles: mesh.triangles,
            minimumHeight,
            maximumHeight,
            westIndices: new Uint16Array(westIndices),
            southIndices: new Uint16Array(southIndices),
            eastIndices: new Uint16Array(eastIndices),
            northIndices: new Uint16Array(northIndices),
            gridSize,
        }

        self.postMessage(result, [
            quantizedVertices.buffer,
            mesh.triangles.buffer,
        ])
    } catch (_err) {
        self.postMessage({ id, empty: true })
    }
}
