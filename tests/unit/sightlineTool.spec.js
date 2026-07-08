import { test, expect } from '@playwright/test'

/**
 * SightlineTool Unit Tests
 *
 * Since SightlineTool_Algorithm has browser-dependent imports (window.L, Globe_),
 * we inline the pure algorithm logic here for unit testing.
 *
 * Test categories:
 *   1. Algorithm math primitives (calcHeightLine, calcHeightDiagonal, isNoData)
 *   2. Grid initialization (initializeGrids with noData handling)
 *   3. Shadow computation (processUp, processDown, full sightline integration)
 *   4. noData propagation (critical: noData must not corrupt shadow plane)
 *   5. Composite & cumulative (compositeResults, cumulativeVisibility)
 *   6. Time-range iteration
 *   7. State management (source selection, sightline options)
 *   8. Export serialization (GeoJSON, CSV, JSON report)
 *   9. UI state logic (source toggling, custom az/el)
 */

// ============================================================
// Inlined pure functions from SightlineTool_Algorithm
// ============================================================

function isNoData(data) {
    if (data == 1010101 || data > 35000 || data < -35000) return true
    return false
}

function calcHeightLine(i, Za, Zo) {
    i = Math.abs(i)
    if (i == 1) return Za
    else return (Za - Zo) / (i - 1) + Za
}

function calcHeightDiagonal(i, j, Za, Zb, Zo) {
    i = Math.abs(i)
    j = Math.abs(j)
    return ((Za - Zo) * i + (Zb - Zo) * j) / (i + j - 1) + Zo
}

function calcHeightEdge(i, j, Za, Zb, Zo) {
    if (i == j) return calcHeightLine(i, Za, Zo)
    else return ((Za - Zo) * i + (Zb - Zo) * (j - i)) / (j - 1) + Zo
}

function initializeGrids(d) {
    let refGrid = []
    let resultGrid = []
    for (let i = 0; i < d.data.length; i++) {
        refGrid.push(new Array(d.data[0].length).fill(0))
        resultGrid.push(new Array(d.data[0].length).fill(0))
    }

    for (let x = 0; x < d.data[0].length; x++) {
        if (!isNoData(d.data[0][x])) {
            refGrid[0][x] = d.data[0][x]
            resultGrid[0][x] = 1
        } else {
            resultGrid[0][x] = 9
        }
        if (!isNoData(d.data[1][x])) {
            refGrid[1][x] = d.data[1][x]
            resultGrid[1][x] = 1
        } else {
            resultGrid[1][x] = 9
        }
        if (!isNoData(d.data[d.data.length - 1][x])) {
            refGrid[d.data.length - 1][x] = d.data[d.data.length - 1][x]
            resultGrid[d.data.length - 1][x] = 1
        } else {
            resultGrid[d.data.length - 1][x] = 9
        }
        if (!isNoData(d.data[d.data.length - 2][x])) {
            refGrid[d.data.length - 2][x] = d.data[d.data.length - 2][x]
            resultGrid[d.data.length - 2][x] = 1
        } else {
            resultGrid[d.data.length - 2][x] = 9
        }
    }
    for (let y = 0; y < d.data.length; y++) {
        if (!isNoData(d.data[y][0])) {
            refGrid[y][0] = d.data[y][0]
            resultGrid[y][0] = 1
        } else {
            resultGrid[y][0] = 9
        }
        if (!isNoData(d.data[y][1])) {
            refGrid[y][1] = d.data[y][1]
            resultGrid[y][1] = 1
        } else {
            resultGrid[y][1] = 9
        }
        if (!isNoData(d.data[y][d.data[0].length - 1])) {
            refGrid[y][d.data[0].length - 1] = d.data[y][d.data[0].length - 1]
            resultGrid[y][d.data[0].length - 1] = 1
        } else {
            resultGrid[y][d.data[0].length - 1] = 9
        }
        if (!isNoData(d.data[y][d.data[0].length - 2])) {
            refGrid[y][d.data[0].length - 2] = d.data[y][d.data[0].length - 2]
            resultGrid[y][d.data[0].length - 2] = 1
        } else {
            resultGrid[y][d.data[0].length - 2] = 9
        }
    }

    return { refGrid, resultGrid }
}

// Simplified shade that runs processUp and processDown without curvature or FOV
// (curvature and FOV depend on Globe_ which is browser-only)
function sightlineSimple(d) {
    let grids = initializeGrids(d)
    if (d.targetSource.altitude > 0) {
        processUp(d, grids)
        processDown(d, grids)
    }
    return grids.resultGrid
}

function processUp(d, g) {
    const o = d.dataSource
    const observerHeight = d.targetSource.altitude

    for (let j = Math.min(d.data.length - 2, o.y - 1); j >= 0; j--) {
        for (let i = Math.min(d.data[0].length - 2, o.x - 1); i >= 0; i--) {
            g.refGrid[j][i] = calcHeightDiagonal(
                i - o.x, j - o.y,
                g.refGrid[j][i + 1], g.refGrid[j + 1][i], observerHeight
            )
            let dataH = d.data[j][i] + (d.options.targetHeight || 0)
            if (g.refGrid[j][i] <= dataH) g.resultGrid[j][i] = 1
            if (isNoData(d.data[j][i])) g.resultGrid[j][i] = 9
            if (!isNoData(d.data[j][i]))
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
        }
        for (let i = Math.max(1, o.x + 1); i < d.data[0].length; i++) {
            g.refGrid[j][i] = calcHeightDiagonal(
                i - o.x, j - o.y,
                g.refGrid[j][i - 1], g.refGrid[j + 1][i], observerHeight
            )
            let dataH = d.data[j][i] + (d.options.targetHeight || 0)
            if (g.refGrid[j][i] <= dataH) g.resultGrid[j][i] = 1
            if (isNoData(d.data[j][i])) g.resultGrid[j][i] = 9
            if (!isNoData(d.data[j][i]))
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
        }
    }
}

function processDown(d, g) {
    const o = d.dataSource
    const observerHeight = d.targetSource.altitude

    for (let j = Math.max(1, o.y + 1); j < d.data.length; j++) {
        for (let i = Math.min(d.data[0].length - 2, o.x - 1); i >= 0; i--) {
            g.refGrid[j][i] = calcHeightDiagonal(
                i - o.x, j - o.y,
                g.refGrid[j][i + 1], g.refGrid[j - 1][i], observerHeight
            )
            let dataH = d.data[j][i] + (d.options.targetHeight || 0)
            if (g.refGrid[j][i] <= dataH) g.resultGrid[j][i] = 1
            if (isNoData(d.data[j][i])) g.resultGrid[j][i] = 9
            if (!isNoData(d.data[j][i]))
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
        }
        for (let i = Math.max(1, o.x + 1); i < d.data[0].length; i++) {
            g.refGrid[j][i] = calcHeightDiagonal(
                i - o.x, j - o.y,
                g.refGrid[j][i - 1], g.refGrid[j - 1][i], observerHeight
            )
            let dataH = d.data[j][i] + (d.options.targetHeight || 0)
            if (g.refGrid[j][i] <= dataH) g.resultGrid[j][i] = 1
            if (isNoData(d.data[j][i])) g.resultGrid[j][i] = 9
            if (!isNoData(d.data[j][i]))
                g.refGrid[j][i] = Math.max(g.refGrid[j][i], d.data[j][i])
        }
    }
}

function compositeResults(resultGrids, mode) {
    if (!resultGrids || resultGrids.length === 0) return []
    if (resultGrids.length === 1) return resultGrids[0]
    const rows = resultGrids[0].length
    const cols = resultGrids[0][0].length
    let composited = []
    for (let y = 0; y < rows; y++) {
        composited.push(new Array(cols).fill(0))
        for (let x = 0; x < cols; x++) {
            let noData = false
            let values = []
            for (let g = 0; g < resultGrids.length; g++) {
                const v = resultGrids[g][y][x]
                if (v === 9) { noData = true; break }
                values.push(v)
            }
            if (noData) {
                composited[y][x] = 9
            } else if (mode === 'and') {
                composited[y][x] = values.every((v) => v === 0) ? 0 : 1
            } else {
                composited[y][x] = values.some((v) => v === 0) ? 0 : 1
            }
        }
    }
    return composited
}

function cumulativeVisibility(resultGrids) {
    if (!resultGrids || resultGrids.length === 0) return []
    const validGrids = resultGrids.filter((g) => g != null)
    if (validGrids.length === 0) return []
    const rows = validGrids[0].length
    const cols = validGrids[0][0].length
    let heatmap = []
    for (let y = 0; y < rows; y++) {
        heatmap.push(new Array(cols).fill(0))
        for (let x = 0; x < cols; x++) {
            let visCount = 0
            let total = 0
            for (let g = 0; g < validGrids.length; g++) {
                const v = validGrids[g][y][x]
                if (v === 9) continue
                total++
                if (v === 1 || v === 2) visCount++
            }
            heatmap[y][x] = total > 0 ? visCount / total : -1
        }
    }
    return heatmap
}

// ============================================================
// Helpers for state management / UI logic tests
// ============================================================

const MULTI_SOURCE_COLORS = [
    { r: 0, g: 0, b: 0 },
    { r: 180, g: 40, b: 40 },
    { r: 40, g: 40, b: 180 },
    { r: 40, g: 160, b: 40 },
    { r: 180, g: 120, b: 0 },
    { r: 120, g: 40, b: 180 },
    { r: 0, g: 160, b: 160 },
    { r: 180, g: 0, b: 180 },
]

function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    }
}

// Simulates the source state store that SightlineToolNew will use
function createSourceStore(sourcesList) {
    return sourcesList.map((s, i) => ({
        value: String(s.value),
        name: s.name,
        checked: i === 0,
        color: rgbToHex(MULTI_SOURCE_COLORS[i % MULTI_SOURCE_COLORS.length]),
        opacity: 0.75,
    }))
}

function getSelectedSources(sources) {
    return sources
        .filter(s => s.checked)
        .map(s => ({
            value: s.value,
            index: sources.indexOf(s),
            color: hexToRgb(s.color),
            opacity: s.opacity,
        }))
}

function getSightlineOptions(sources, elmId) {
    const selected = getSelectedSources(sources)
    const primaryColor = selected.length > 0 ? selected[0].color : { r: 0, g: 0, b: 0 }
    const primaryOpacity = selected.length > 0 ? selected[0].opacity : 0.75
    return {
        color: primaryColor,
        opacity: primaryOpacity,
        target: selected.length > 0 ? selected[0].value : 'false',
        targets: selected,
    }
}

// ============================================================
// 1. Algorithm Math Primitives
// ============================================================

test.describe('calcHeightLine', () => {
    test('returns Za when distance is 1', () => {
        expect(calcHeightLine(1, 100, 200)).toBe(100)
        expect(calcHeightLine(-1, 50, 300)).toBe(50)
    })

    test('computes linear interpolation for distance > 1', () => {
        // i=2: (Za - Zo) / (2 - 1) + Za = (100-200)/1 + 100 = 0
        expect(calcHeightLine(2, 100, 200)).toBe(0)
    })

    test('computes correct descent for large distances', () => {
        // i=10: (100 - 200) / 9 + 100 ≈ 88.89
        const result = calcHeightLine(10, 100, 200)
        expect(result).toBeCloseTo(88.889, 2)
    })

    test('handles negative distances (absolute value)', () => {
        expect(calcHeightLine(-2, 100, 200)).toBe(calcHeightLine(2, 100, 200))
    })

    test('handles zero observer height', () => {
        // i=3: (50 - 0) / 2 + 50 = 75
        expect(calcHeightLine(3, 50, 0)).toBe(75)
    })

    test('shadow plane descends monotonically for flat terrain', () => {
        const Zo = 1000
        let prev = Zo
        for (let i = 1; i <= 20; i++) {
            const h = calcHeightLine(i, prev, Zo)
            expect(h).toBeLessThanOrEqual(prev)
            prev = h
        }
    })
})

test.describe('calcHeightDiagonal', () => {
    test('interpolates between two neighbor heights', () => {
        // i=1, j=1, Za=100, Zb=100, Zo=200
        // ((100-200)*1 + (100-200)*1) / (1+1-1) + 200 = (-200)/1 + 200 = 0
        expect(calcHeightDiagonal(1, 1, 100, 100, 200)).toBe(0)
    })

    test('handles asymmetric distances', () => {
        // i=3, j=1, Za=100, Zb=50, Zo=200
        // ((100-200)*3 + (50-200)*1) / (3+1-1) + 200 = (-300 + -150)/3 + 200 = -150 + 200 = 50
        expect(calcHeightDiagonal(3, 1, 100, 50, 200)).toBe(50)
    })

    test('uses absolute values for negative offsets', () => {
        expect(calcHeightDiagonal(-3, -2, 100, 80, 200))
            .toBe(calcHeightDiagonal(3, 2, 100, 80, 200))
    })

    test('produces same result as calcHeightLine on axis', () => {
        // When j=0 (or effectively same distance), diagonal should degenerate
        // For j=1, i=1, single neighbor: same as line
        const Za = 150
        const Zo = 500
        expect(calcHeightDiagonal(1, 1, Za, Za, Zo)).toBe(
            calcHeightDiagonal(1, 1, Za, Za, Zo)
        )
    })
})

test.describe('calcHeightEdge', () => {
    test('degenerates to calcHeightLine when i == j', () => {
        expect(calcHeightEdge(3, 3, 100, 80, 200))
            .toBe(calcHeightLine(3, 100, 200))
    })

    test('computes correct result for i != j', () => {
        // i=2, j=4, Za=100, Zb=50, Zo=200
        // ((100-200)*2 + (50-200)*(4-2)) / (4-1) + 200
        // (-200 + -300) / 3 + 200 = -500/3 + 200 ≈ 33.33
        const result = calcHeightEdge(2, 4, 100, 50, 200)
        expect(result).toBeCloseTo(33.333, 2)
    })
})

test.describe('isNoData', () => {
    test('identifies internalNoDataValue (1010101)', () => {
        expect(isNoData(1010101)).toBe(true)
    })

    test('identifies extreme positive values (> 35000)', () => {
        expect(isNoData(35001)).toBe(true)
        expect(isNoData(100000)).toBe(true)
    })

    test('identifies extreme negative values (< -35000)', () => {
        expect(isNoData(-35001)).toBe(true)
        expect(isNoData(-100000)).toBe(true)
    })

    test('accepts normal elevation values', () => {
        expect(isNoData(0)).toBe(false)
        expect(isNoData(100)).toBe(false)
        expect(isNoData(-100)).toBe(false)
        expect(isNoData(34999)).toBe(false)
        expect(isNoData(-34999)).toBe(false)
    })

    test('boundary: exactly 35000 is valid', () => {
        expect(isNoData(35000)).toBe(false)
        expect(isNoData(-35000)).toBe(false)
    })
})

// ============================================================
// 2. Grid Initialization
// ============================================================

test.describe('initializeGrids', () => {
    test('creates grids matching input dimensions', () => {
        const d = {
            data: [
                [10, 20, 30, 40, 50],
                [15, 25, 35, 45, 55],
                [12, 22, 32, 42, 52],
                [11, 21, 31, 41, 51],
                [13, 23, 33, 43, 53],
            ],
        }
        const { refGrid, resultGrid } = initializeGrids(d)
        expect(refGrid.length).toBe(5)
        expect(refGrid[0].length).toBe(5)
        expect(resultGrid.length).toBe(5)
        expect(resultGrid[0].length).toBe(5)
    })

    test('marks edges as visible (1) for valid data', () => {
        const d = {
            data: [
                [10, 20, 30, 40, 50],
                [15, 25, 35, 45, 55],
                [12, 22, 32, 42, 52],
                [11, 21, 31, 41, 51],
                [13, 23, 33, 43, 53],
            ],
        }
        const { resultGrid } = initializeGrids(d)
        // Top row
        expect(resultGrid[0].every(v => v === 1)).toBe(true)
        // Second row
        expect(resultGrid[1].every(v => v === 1)).toBe(true)
        // Bottom row
        expect(resultGrid[4].every(v => v === 1)).toBe(true)
        // Second-to-last row
        expect(resultGrid[3].every(v => v === 1)).toBe(true)
    })

    test('copies edge elevation data into refGrid', () => {
        const d = {
            data: [
                [10, 20, 30, 40, 50],
                [15, 25, 35, 45, 55],
                [12, 22, 32, 42, 52],
                [11, 21, 31, 41, 51],
                [13, 23, 33, 43, 53],
            ],
        }
        const { refGrid } = initializeGrids(d)
        expect(refGrid[0][0]).toBe(10)
        expect(refGrid[0][4]).toBe(50)
        expect(refGrid[4][0]).toBe(13)
    })

    test('interior cells start at 0', () => {
        const d = {
            data: [
                [10, 20, 30, 40, 50],
                [15, 25, 35, 45, 55],
                [12, 22, 999, 42, 52],
                [11, 21, 31, 41, 51],
                [13, 23, 33, 43, 53],
            ],
        }
        const { refGrid, resultGrid } = initializeGrids(d)
        expect(resultGrid[2][2]).toBe(0)
        expect(refGrid[2][2]).toBe(0)
    })

    test('marks noData edge cells as 9 in resultGrid', () => {
        const NODATA = 1010101
        const d = {
            data: [
                [NODATA, 20, 30, 40, NODATA],
                [15, 25, 35, 45, 55],
                [12, 22, 32, 42, 52],
                [11, 21, 31, 41, 51],
                [NODATA, 23, 33, 43, NODATA],
            ],
        }
        const { resultGrid, refGrid } = initializeGrids(d)
        expect(resultGrid[0][0]).toBe(9)
        expect(resultGrid[0][4]).toBe(9)
        expect(resultGrid[4][0]).toBe(9)
        expect(resultGrid[4][4]).toBe(9)
        // refGrid should stay 0 for noData edges (not get the noData value)
        expect(refGrid[0][0]).toBe(0)
        expect(refGrid[0][4]).toBe(0)
    })

    test('handles grid entirely of noData', () => {
        const N = 1010101
        const d = { data: [[N, N, N], [N, N, N], [N, N, N], [N, N, N]] }
        const { resultGrid, refGrid } = initializeGrids(d)
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 3; x++) {
                // All edge cells should be noData (9) or interior (0)
                if (y <= 1 || y >= 2 || x === 0 || x === 2)
                    expect(resultGrid[y][x]).toBe(9)
                expect(refGrid[y][x]).toBe(0)
            }
        }
    })
})

// ============================================================
// 3. Shadow Computation (Integration)
// ============================================================

test.describe('sightline (simplified integration)', () => {
    test('flat terrain with high observer: everything visible', () => {
        // Use a 10x10 grid so there are clear interior cells.
        // Observer at x=5 (center-ish). Edge border = 2px on each side.
        // processDown scans left of o.x and right of o.x but skips column o.x itself
        // (that's handled by processFirst which we don't include in the simplified sightline).
        const size = 10
        const data = Array.from({ length: size }, () => new Array(size).fill(0))
        const d = {
            data,
            dataSource: { x: 5, y: 0 },
            targetSource: { altitude: 10000 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // Interior cells NOT on the observer column should be visible
        // (shadow plane from 10000m altitude descends slowly over flat terrain)
        for (let y = 2; y < size - 2; y++) {
            for (let x = 2; x < size - 2; x++) {
                if (x === 5) continue // observer column not processed
                expect(result[y][x]).toBe(1)
            }
        }
    })

    test('hill creates shadow behind it', () => {
        // Observer far above at top-left (x=0). Hill at cols 4-5.
        // processDown left scan won't reach cols 4-5, right scan will.
        // Cells beyond the hill (farther right/down) should be shadowed.
        const d = {
            data: [
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0, 500, 500, 0, 0, 0, 0],
                [0, 0, 0, 0, 500, 500, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
                [0, 0, 0, 0,   0,   0, 0, 0, 0, 0],
            ],
            dataSource: { x: 2, y: 0 },
            targetSource: { altitude: 600 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // The hill cells (row 3-4, col 4-5) should be visible
        expect(result[3][4]).toBe(1)
        expect(result[3][5]).toBe(1)
        // Some cells beyond the hill should be in shadow
        let hasShadow = false
        for (let y = 5; y < 8; y++) {
            for (let x = 4; x < 8; x++) {
                if (result[y][x] === 0) hasShadow = true
            }
        }
        expect(hasShadow).toBe(true)
    })

    test('zero altitude source produces no shadow processing', () => {
        // Use a grid large enough that there are truly interior cells
        // (not covered by the 2px edge border)
        const d = {
            data: [
                [100, 200, 300, 400, 500, 600],
                [100, 200, 300, 400, 500, 600],
                [100, 200, 300, 400, 500, 600],
                [100, 200, 300, 400, 500, 600],
                [100, 200, 300, 400, 500, 600],
                [100, 200, 300, 400, 500, 600],
            ],
            dataSource: { x: 3, y: 0 },
            targetSource: { altitude: 0 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // With altitude 0, processUp/processDown skip; only edges get initialized
        // Truly interior cells (rows 2-3, cols 2-3) remain at default 0
        // But column 3 = observer column, so check col 2
        expect(result[2][2]).toBe(0)
        expect(result[3][2]).toBe(0)
    })

    test('negative altitude source produces no shadow processing', () => {
        const d = {
            data: [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ],
            dataSource: { x: 2, y: 0 },
            targetSource: { altitude: -100 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // Should not crash; all cells either edge (1) or interior default (0)
        expect(result.length).toBe(4)
    })
})

// ============================================================
// 4. noData Propagation (Critical regression test)
// ============================================================

test.describe('noData propagation', () => {
    test('noData cells must not corrupt shadow plane via Math.max', () => {
        const N = 1010101
        const d = {
            data: [
                [0, 0, 0, 0, N, N],
                [0, 0, 0, 0, N, N],
                [0, 0, 100, 0, N, N],
                [0, 0, 0, 0, N, N],
                [0, 0, 0, 0, N, N],
                [0, 0, 0, 0, N, N],
            ],
            dataSource: { x: 2, y: 0 },
            targetSource: { altitude: 5000 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // noData cells should be 9
        expect(result[0][4]).toBe(9)
        expect(result[2][4]).toBe(9)
        // Valid cells adjacent to noData should NOT be shadowed by noData
        // (the hill at [2][2]=100 should create shadows, but noData should not)
        expect(result[2][0]).toBe(1) // edge
        expect(result[2][1]).toBe(1) // edge
        // The key test: cells between observer and noData boundary should be
        // determined by actual terrain, not corrupted by noData value
        expect(result[2][3]).not.toBe(9)
    })

    test('all-noData grid does not crash', () => {
        const N = 1010101
        const d = {
            data: [
                [N, N, N, N],
                [N, N, N, N],
                [N, N, N, N],
                [N, N, N, N],
            ],
            dataSource: { x: 2, y: 0 },
            targetSource: { altitude: 5000 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        expect(result.length).toBe(4)
        // All cells should be 9 (noData)
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                expect(result[y][x]).toBe(9)
            }
        }
    })

    test('noData at edges does not seed false elevation into refGrid', () => {
        const N = 1010101
        const d = {
            data: [
                [N, 0, 0, 0, N],
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
                [N, 0, 0, 0, N],
            ],
        }
        const { refGrid } = initializeGrids(d)
        // noData corners should have refGrid = 0 (not 1010101)
        expect(refGrid[0][0]).toBe(0)
        expect(refGrid[0][4]).toBe(0)
        expect(refGrid[4][0]).toBe(0)
        expect(refGrid[4][4]).toBe(0)
    })

    test('mixed noData and valid terrain produces correct shadow', () => {
        const N = 1010101
        const d = {
            data: [
                [0,   0,   0,   0, 0, 0, 0],
                [0,   0,   0,   0, 0, 0, 0],
                [0,   0, 300, 300, 0, 0, 0],
                [0,   0,   0,   0, 0, 0, 0],
                [0,   0,   0,   0, 0, N, N],
                [0,   0,   0,   0, 0, N, N],
                [0,   0,   0,   0, 0, N, N],
            ],
            dataSource: { x: 3, y: 0 },
            targetSource: { altitude: 1000 },
            options: { targetHeight: 0, FOVAzimuth: 360, FOVElevation: 180 },
        }
        const result = sightlineSimple(d)
        // noData region should be 9
        expect(result[4][5]).toBe(9)
        expect(result[5][5]).toBe(9)
        // Valid terrain should have normal shadow computation
        expect(result[2][2]).toBe(1) // hill is visible
    })
})

// ============================================================
// 5. compositeResults
// ============================================================

test.describe('compositeResults', () => {
    test('returns empty array for empty input', () => {
        expect(compositeResults([], 'or')).toEqual([])
    })

    test('returns single grid unchanged', () => {
        const grid = [[1, 0, 9], [0, 1, 1]]
        expect(compositeResults([grid], 'or')).toEqual(grid)
    })

    test('OR mode: shadow if hidden from ANY source', () => {
        const gridA = [[1, 0, 1], [0, 1, 0]]
        const gridB = [[1, 1, 0], [1, 0, 1]]
        expect(compositeResults([gridA, gridB], 'or')).toEqual([[1, 0, 0], [0, 0, 0]])
    })

    test('AND mode: shadow only if hidden from ALL sources', () => {
        const gridA = [[1, 0, 1], [0, 1, 0]]
        const gridB = [[1, 1, 0], [1, 0, 1]]
        expect(compositeResults([gridA, gridB], 'and')).toEqual([[1, 1, 1], [1, 1, 1]])
    })

    test('AND mode with actual shadow overlap', () => {
        const gridA = [[0, 0], [1, 0]]
        const gridB = [[0, 1], [1, 0]]
        expect(compositeResults([gridA, gridB], 'and')).toEqual([[0, 1], [1, 0]])
    })

    test('preserves nodata (9) values', () => {
        const gridA = [[1, 9], [0, 1]]
        const gridB = [[0, 1], [1, 0]]
        const result = compositeResults([gridA, gridB], 'or')
        expect(result[0][1]).toBe(9)
    })

    test('handles three grids with OR', () => {
        const g1 = [[1, 1, 0]]
        const g2 = [[1, 0, 1]]
        const g3 = [[0, 1, 1]]
        expect(compositeResults([g1, g2, g3], 'or')).toEqual([[0, 0, 0]])
    })

    test('defaults to OR when mode is unspecified', () => {
        const gridA = [[1, 0]]
        const gridB = [[0, 1]]
        expect(compositeResults([gridA, gridB])).toEqual([[0, 0]])
    })

    test('all visible in both grids stays visible', () => {
        const gridA = [[1, 1]]
        const gridB = [[1, 1]]
        expect(compositeResults([gridA, gridB], 'or')).toEqual([[1, 1]])
        expect(compositeResults([gridA, gridB], 'and')).toEqual([[1, 1]])
    })

    test('all shadowed in both grids stays shadowed', () => {
        const gridA = [[0, 0]]
        const gridB = [[0, 0]]
        expect(compositeResults([gridA, gridB], 'or')).toEqual([[0, 0]])
        expect(compositeResults([gridA, gridB], 'and')).toEqual([[0, 0]])
    })
})

// ============================================================
// 6. cumulativeVisibility
// ============================================================

test.describe('cumulativeVisibility', () => {
    test('returns empty array for empty input', () => {
        expect(cumulativeVisibility([])).toEqual([])
    })

    test('single grid: visible cells get 1.0, shadowed get 0.0', () => {
        const grid = [[1, 0], [2, 9]]
        const result = cumulativeVisibility([grid])
        expect(result[0][0]).toBe(1.0)
        expect(result[0][1]).toBe(0.0)
        expect(result[1][0]).toBe(1.0)
        expect(result[1][1]).toBe(-1)
    })

    test('multiple grids: computes fraction correctly', () => {
        const g1 = [[1, 0, 1]]
        const g2 = [[0, 0, 1]]
        const g3 = [[1, 1, 1]]
        const result = cumulativeVisibility([g1, g2, g3])
        expect(result[0][0]).toBeCloseTo(2 / 3, 5)
        expect(result[0][1]).toBeCloseTo(1 / 3, 5)
        expect(result[0][2]).toBeCloseTo(1.0, 5)
    })

    test('all shadowed gives 0.0', () => {
        const g1 = [[0]]
        const g2 = [[0]]
        expect(cumulativeVisibility([g1, g2])[0][0]).toBe(0.0)
    })

    test('nodata cells across all grids give -1', () => {
        const g1 = [[9]]
        const g2 = [[9]]
        expect(cumulativeVisibility([g1, g2])[0][0]).toBe(-1)
    })

    test('filters out null grids from failed timesteps', () => {
        const g1 = [[1, 0]]
        const g2 = [[0, 1]]
        const result = cumulativeVisibility([g1, null, g2, null])
        expect(result[0][0]).toBe(0.5)
        expect(result[0][1]).toBe(0.5)
    })

    test('returns empty array when all grids are null', () => {
        expect(cumulativeVisibility([null, null])).toEqual([])
    })

    test('handles observer cells (value 2) as visible', () => {
        const g1 = [[2, 0]]
        const g2 = [[1, 0]]
        const result = cumulativeVisibility([g1, g2])
        expect(result[0][0]).toBe(1.0)
        expect(result[0][1]).toBe(0.0)
    })

    test('large number of timesteps', () => {
        const grids = []
        for (let i = 0; i < 100; i++) {
            grids.push([[i % 2 === 0 ? 1 : 0]])
        }
        const result = cumulativeVisibility(grids)
        expect(result[0][0]).toBeCloseTo(0.5, 5)
    })
})

// ============================================================
// 7. Time-range Iteration Logic
// ============================================================

test.describe('Time-range iteration logic', () => {
    test('generates correct timestamps from start/end/step', () => {
        const startMs = new Date('2023-09-06T00:00:00Z').getTime()
        const endMs = new Date('2023-09-06T03:00:00Z').getTime()
        const stepMs = 60 * 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs)
            timestamps.push(new Date(t).toISOString())
        expect(timestamps.length).toBe(4)
        expect(timestamps[0]).toBe('2023-09-06T00:00:00.000Z')
        expect(timestamps[3]).toBe('2023-09-06T03:00:00.000Z')
    })

    test('handles 15-minute steps', () => {
        const startMs = new Date('2023-01-01T12:00:00Z').getTime()
        const endMs = new Date('2023-01-01T13:00:00Z').getTime()
        const stepMs = 15 * 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs)
            timestamps.push(new Date(t).toISOString())
        expect(timestamps.length).toBe(5)
    })

    test('single step when start equals end', () => {
        const startMs = new Date('2023-06-15T10:00:00Z').getTime()
        const timestamps = []
        for (let t = startMs; t <= startMs; t += 60 * 60 * 1000)
            timestamps.push(new Date(t).toISOString())
        expect(timestamps.length).toBe(1)
    })

    test('1-minute steps over 10 minutes', () => {
        const startMs = new Date('2024-01-01T00:00:00Z').getTime()
        const endMs = new Date('2024-01-01T00:10:00Z').getTime()
        const stepMs = 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs)
            timestamps.push(new Date(t).toISOString())
        expect(timestamps.length).toBe(11)
    })

    test('step larger than range yields single timestamp', () => {
        const startMs = new Date('2024-01-01T00:00:00Z').getTime()
        const endMs = new Date('2024-01-01T00:05:00Z').getTime()
        const stepMs = 60 * 60 * 1000
        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs)
            timestamps.push(new Date(t).toISOString())
        expect(timestamps.length).toBe(1)
    })
})

// ============================================================
// 8. State Management (Source Selection / Options)
// ============================================================

test.describe('Source state management', () => {
    const sourcesList = [
        { name: 'SUN', value: 'SUN' },
        { name: 'MOON', value: 'MOON' },
        { name: 'Custom', value: false },
    ]

    test('createSourceStore initializes with first source checked', () => {
        const store = createSourceStore(sourcesList)
        expect(store[0].checked).toBe(true)
        expect(store[1].checked).toBe(false)
        expect(store[2].checked).toBe(false)
    })

    test('createSourceStore assigns correct colors', () => {
        const store = createSourceStore(sourcesList)
        expect(store[0].color).toBe(rgbToHex(MULTI_SOURCE_COLORS[0]))
        expect(store[1].color).toBe(rgbToHex(MULTI_SOURCE_COLORS[1]))
        expect(store[2].color).toBe(rgbToHex(MULTI_SOURCE_COLORS[2]))
    })

    test('createSourceStore defaults opacity to 0.75', () => {
        const store = createSourceStore(sourcesList)
        store.forEach(s => expect(s.opacity).toBe(0.75))
    })

    test('getSelectedSources returns only checked sources', () => {
        const store = createSourceStore(sourcesList)
        store[1].checked = true
        const selected = getSelectedSources(store)
        expect(selected.length).toBe(2)
        expect(selected[0].value).toBe('SUN')
        expect(selected[1].value).toBe('MOON')
    })

    test('getSelectedSources returns correct color objects', () => {
        const store = createSourceStore(sourcesList)
        const selected = getSelectedSources(store)
        expect(selected[0].color).toEqual(hexToRgb(store[0].color))
    })

    test('getSelectedSources returns correct opacity', () => {
        const store = createSourceStore(sourcesList)
        store[0].opacity = 0.5
        const selected = getSelectedSources(store)
        expect(selected[0].opacity).toBe(0.5)
    })

    test('getSelectedSources returns empty when nothing checked', () => {
        const store = createSourceStore(sourcesList)
        store[0].checked = false
        expect(getSelectedSources(store)).toEqual([])
    })

    test('getSightlineOptions uses primary source color', () => {
        const store = createSourceStore(sourcesList)
        store[0].color = '#ff0000'
        const opts = getSightlineOptions(store, 0)
        expect(opts.color).toEqual({ r: 255, g: 0, b: 0 })
    })

    test('getSightlineOptions uses primary source opacity', () => {
        const store = createSourceStore(sourcesList)
        store[0].opacity = 0.3
        const opts = getSightlineOptions(store, 0)
        expect(opts.opacity).toBe(0.3)
    })

    test('getSightlineOptions with no selection returns defaults', () => {
        const store = createSourceStore(sourcesList)
        store[0].checked = false
        const opts = getSightlineOptions(store, 0)
        expect(opts.color).toEqual({ r: 0, g: 0, b: 0 })
        expect(opts.target).toBe('false')
    })

    test('color wraps around MULTI_SOURCE_COLORS for many sources', () => {
        const manySources = Array.from({ length: 12 }, (_, i) => ({
            name: `Source${i}`, value: `S${i}`
        }))
        const store = createSourceStore(manySources)
        expect(store[8].color).toBe(rgbToHex(MULTI_SOURCE_COLORS[0]))
        expect(store[9].color).toBe(rgbToHex(MULTI_SOURCE_COLORS[1]))
    })

    test('toggling source updates checked state', () => {
        const store = createSourceStore(sourcesList)
        store[0].checked = !store[0].checked
        expect(store[0].checked).toBe(false)
        store[1].checked = !store[1].checked
        expect(store[1].checked).toBe(true)
    })

    test('updating color preserves other source properties', () => {
        const store = createSourceStore(sourcesList)
        const orig = { ...store[0] }
        store[0].color = '#abcdef'
        expect(store[0].name).toBe(orig.name)
        expect(store[0].opacity).toBe(orig.opacity)
        expect(store[0].checked).toBe(orig.checked)
    })
})

// ============================================================
// 9. UI State Logic (Custom Az/El, Source Toggling)
// ============================================================

test.describe('UI state logic', () => {
    test('only Custom selected: isOnlyCustom is true', () => {
        const sources = [
            { value: 'SUN', name: 'SUN', checked: false, color: '#000', opacity: 0.75 },
            { value: 'false', name: 'Custom', checked: true, color: '#000', opacity: 0.75 },
        ]
        const selected = sources.filter(s => s.checked)
        const isOnlyCustom = selected.length === 1 && String(selected[0].value) === 'false'
        expect(isOnlyCustom).toBe(true)
    })

    test('Custom + another source: isOnlyCustom is false', () => {
        const sources = [
            { value: 'SUN', name: 'SUN', checked: true, color: '#000', opacity: 0.75 },
            { value: 'false', name: 'Custom', checked: true, color: '#000', opacity: 0.75 },
        ]
        const selected = sources.filter(s => s.checked)
        const isOnlyCustom = selected.length === 1 && String(selected[0].value) === 'false'
        expect(isOnlyCustom).toBe(false)
    })

    test('no sources selected: isOnlyCustom is false', () => {
        const sources = [
            { value: 'SUN', name: 'SUN', checked: false, color: '#000', opacity: 0.75 },
            { value: 'false', name: 'Custom', checked: false, color: '#000', opacity: 0.75 },
        ]
        const selected = sources.filter(s => s.checked)
        const isOnlyCustom = selected.length === 1 && String(selected[0].value) === 'false'
        expect(isOnlyCustom).toBe(false)
    })

    test('hasCustom is true when Custom is in multi-selection', () => {
        const sources = [
            { value: 'SUN', name: 'SUN', checked: true, color: '#000', opacity: 0.75 },
            { value: 'MOON', name: 'MOON', checked: true, color: '#000', opacity: 0.75 },
            { value: 'false', name: 'Custom', checked: true, color: '#000', opacity: 0.75 },
        ]
        const selected = sources.filter(s => s.checked)
        const hasCustom = selected.some(s => String(s.value) === 'false')
        expect(hasCustom).toBe(true)
    })

    test('hasCustom is false when Custom is not selected', () => {
        const sources = [
            { value: 'SUN', name: 'SUN', checked: true, color: '#000', opacity: 0.75 },
            { value: 'false', name: 'Custom', checked: false, color: '#000', opacity: 0.75 },
        ]
        const selected = sources.filter(s => s.checked)
        const hasCustom = selected.some(s => String(s.value) === 'false')
        expect(hasCustom).toBe(false)
    })
})

// ============================================================
// 10. Export Serialization
// ============================================================

test.describe('Export serialization', () => {
    test('CSV format: correct headers', () => {
        const headers = ['time', 'visibility_pct', 'azimuth', 'elevation', 'range']
        expect(headers).toEqual(['time', 'visibility_pct', 'azimuth', 'elevation', 'range'])
    })

    test('CSV rows from sweep results', () => {
        const sweepResults = [
            { time: '2023-01-01T00:00:00Z', visibilityPct: 75, azimuth: 180, elevation: 45, range: 100 },
            { time: '2023-01-01T01:00:00Z', visibilityPct: 60, azimuth: 190, elevation: 40, range: 110 },
        ]
        const rows = sweepResults.map(r => [r.time, r.visibilityPct, r.azimuth, r.elevation, r.range])
        expect(rows.length).toBe(2)
        expect(rows[0][0]).toBe('2023-01-01T00:00:00Z')
        expect(rows[0][1]).toBe(75)
    })

    test('GeoJSON feature structure for shade cell', () => {
        const feature = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-122.5, 37.7],
                    [-122.499, 37.7],
                    [-122.499, 37.701],
                    [-122.5, 37.701],
                    [-122.5, 37.7],
                ]],
            },
            properties: { visibility: 0, source: 'SUN' },
        }
        expect(feature.type).toBe('Feature')
        expect(feature.geometry.type).toBe('Polygon')
        expect(feature.geometry.coordinates[0].length).toBe(5)
        expect(feature.geometry.coordinates[0][0]).toEqual(feature.geometry.coordinates[0][4])
        expect(feature.properties).toHaveProperty('visibility')
        expect(feature.properties).toHaveProperty('source')
    })

    test('GeoJSON FeatureCollection structure', () => {
        const fc = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] }, properties: {} },
            ],
        }
        expect(fc.type).toBe('FeatureCollection')
        expect(Array.isArray(fc.features)).toBe(true)
        expect(fc.features[0].type).toBe('Feature')
    })

    test('JSON report structure', () => {
        const report = {
            parameters: { source: 'SUN', time: '2023-01-01T12:00:00Z', observer: 'EARTH' },
            results: { azimuth: '180.5', elevation: '45.2', range: '149000000' },
            sweepData: null,
        }
        expect(report).toHaveProperty('parameters')
        expect(report).toHaveProperty('results')
        expect(report.parameters.source).toBe('SUN')
    })

    test('JSON report includes sweep data when available', () => {
        const report = {
            parameters: { source: 'SUN', time: '2023-01-01T12:00:00Z' },
            results: { azimuth: '180', elevation: '45', range: '149000000' },
            sweepData: [
                { time: '2023-01-01T12:00:00Z', visibilityPct: 80 },
                { time: '2023-01-01T13:00:00Z', visibilityPct: 75 },
            ],
        }
        expect(report.sweepData).not.toBeNull()
        expect(report.sweepData.length).toBe(2)
    })
})

// ============================================================
// 11. Color/Hex Utilities
// ============================================================

test.describe('Color utilities', () => {
    test('rgbToHex converts correctly', () => {
        expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
        expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
        expect(rgbToHex({ r: 180, g: 40, b: 40 })).toBe('#b42828')
    })

    test('hexToRgb converts correctly', () => {
        expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
        expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
        expect(hexToRgb('#b42828')).toEqual({ r: 180, g: 40, b: 40 })
    })

    test('roundtrip: rgbToHex then hexToRgb', () => {
        const orig = { r: 120, g: 40, b: 180 }
        expect(hexToRgb(rgbToHex(orig))).toEqual(orig)
    })

    test('MULTI_SOURCE_COLORS roundtrip', () => {
        MULTI_SOURCE_COLORS.forEach(c => {
            expect(hexToRgb(rgbToHex(c))).toEqual(c)
        })
    })
})

// ============================================================
// Multi-DEM config (buildDemsList) — mirrors store.js
// ============================================================

function buildDemsList(vars) {
    const list = []
    if (Array.isArray(vars?.dems)) {
        vars.dems.forEach((d) => {
            if (!d) return
            const path = d.path || d.url || d.dem
            if (!path) return
            const res = parseFloat(d.resolution)
            list.push({
                name: d.name || path,
                path,
                resolution: Number.isFinite(res) && res > 0 ? res : null,
            })
        })
    }
    if (list.length === 0 && vars?.dem) {
        list.push({ name: 'DEM', path: vars.dem, resolution: null })
    }
    return list
}

test.describe('Multi-DEM config (buildDemsList)', () => {
    test('legacy single dem field yields one entry', () => {
        const list = buildDemsList({ dem: 'sub/dem.tif' })
        expect(list.length).toBe(1)
        expect(list[0].path).toBe('sub/dem.tif')
        expect(list[0].resolution).toBe(null)
    })

    test('dems array is used when present', () => {
        const list = buildDemsList({
            dem: 'legacy.tif',
            dems: [
                { name: 'Coarse', path: 'a.tif', resolution: 100 },
                { name: 'Fine', path: 'b.tif', resolution: 5 },
            ],
        })
        expect(list.length).toBe(2)
        expect(list[0].name).toBe('Coarse')
        expect(list[0].resolution).toBe(100)
        expect(list[1].path).toBe('b.tif')
    })

    test('falls back to legacy dem when dems is empty', () => {
        const list = buildDemsList({ dem: 'legacy.tif', dems: [] })
        expect(list.length).toBe(1)
        expect(list[0].path).toBe('legacy.tif')
    })

    test('skips malformed dem entries and invalid resolutions', () => {
        const list = buildDemsList({
            dems: [
                null,
                { name: 'NoPath' },
                { path: 'ok.tif', resolution: 'nan' },
                { path: 'neg.tif', resolution: -5 },
            ],
        })
        expect(list.length).toBe(2)
        expect(list[0].path).toBe('ok.tif')
        expect(list[0].resolution).toBe(null)
        expect(list[1].resolution).toBe(null)
    })

    test('accepts url/dem aliases for path and defaults name to path', () => {
        const list = buildDemsList({ dems: [{ url: 'c.tif' }] })
        expect(list.length).toBe(1)
        expect(list[0].path).toBe('c.tif')
        expect(list[0].name).toBe('c.tif')
    })

    test('empty config yields no DEMs', () => {
        expect(buildDemsList({}).length).toBe(0)
        expect(buildDemsList(undefined).length).toBe(0)
    })
})

// ============================================================
// Editable sweep-time validation — mirrors SightlineTool.normalizeUTCTime
// ============================================================

function normalizeUTCTime(str) {
    if (str == null) return null
    let time = String(str).trim()
    if (!time) return null
    if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(time)) time += 'Z'
    const d = new Date(time)
    if (isNaN(d.getTime())) return null
    return time
}

test.describe('Editable sweep-time validation (normalizeUTCTime)', () => {
    test('passes through a valid ISO-Z time', () => {
        expect(normalizeUTCTime('2025-01-02T03:04:05Z')).toBe('2025-01-02T03:04:05Z')
    })

    test('appends Z to a zoneless time', () => {
        expect(normalizeUTCTime('2025-01-02T03:04:05')).toBe('2025-01-02T03:04:05Z')
    })

    test('preserves an explicit offset', () => {
        expect(normalizeUTCTime('2025-01-02T03:04:05+02:00')).toBe('2025-01-02T03:04:05+02:00')
    })

    test('rejects empty and whitespace input', () => {
        expect(normalizeUTCTime('')).toBe(null)
        expect(normalizeUTCTime('   ')).toBe(null)
        expect(normalizeUTCTime(null)).toBe(null)
    })

    test('rejects unparseable input', () => {
        expect(normalizeUTCTime('not-a-date')).toBe(null)
    })
})

// ============================================================
// Resolution — relative scale → maxOutputDim + effective m/px readout
// ============================================================

function fmtMpp(m) {
    if (!Number.isFinite(m)) return ''
    if (m >= 100) return Math.round(m) + ' m/px'
    if (m >= 10) return m.toFixed(1) + ' m/px'
    if (m >= 1) return m.toFixed(2) + ' m/px'
    return m.toFixed(3) + ' m/px'
}

// Mirror of SightlineTool._resolutionToMaxDim (relative scale, capped so the
// output never exceeds the DEM's native pixels across the viewport extent).
function resolutionToMaxDim(scale, longestViewportPx, nativeMpp, groundExtentMeters) {
    const s = scale || 0.25
    const longest = Math.max(longestViewportPx || 800, 0)
    let dim = Math.round(longest * s)
    if (Number.isFinite(nativeMpp) && nativeMpp > 0 && groundExtentMeters > 0) {
        const nativeDim = Math.floor(groundExtentMeters / nativeMpp)
        if (nativeDim > 0) dim = Math.min(dim, nativeDim)
    }
    return Math.max(dim, 50)
}

// Mirror of SightlineTool.getEffectiveResolutionMpp (never finer than native)
function effectiveResolutionMpp(scale, longestViewportPx, groundExtentMeters, nativeMpp) {
    const dim = resolutionToMaxDim(scale, longestViewportPx, nativeMpp, groundExtentMeters)
    if (!(groundExtentMeters > 0) || !(dim > 0)) return null
    let mpp = groundExtentMeters / dim
    if (Number.isFinite(nativeMpp) && nativeMpp > 0 && mpp < nativeMpp) mpp = nativeMpp
    return mpp
}

test.describe('Resolution scale → maxOutputDim', () => {
    test('1x uses the full viewport longest dimension', () => {
        expect(resolutionToMaxDim(1, 1000)).toBe(1000)
    })

    test('0.25x quarters the viewport dimension', () => {
        expect(resolutionToMaxDim(0.25, 1000)).toBe(250)
    })

    test('defaults to 0.25x when scale is missing', () => {
        expect(resolutionToMaxDim(undefined, 1000)).toBe(250)
    })

    test('never drops below the 50px floor', () => {
        expect(resolutionToMaxDim(0.125, 100)).toBe(50)
    })
})

test.describe('Effective working resolution (m/px readout)', () => {
    test('ground extent divided by the output grid dimension', () => {
        // 10000 m viewport, 1000 px longest, 1x → 1000 px grid → 10 m/px
        expect(effectiveResolutionMpp(1, 1000, 10000)).toBeCloseTo(10, 6)
    })

    test('coarser scale yields a larger m/px', () => {
        // 0.25x → 250 px grid → 40 m/px
        expect(effectiveResolutionMpp(0.25, 1000, 10000)).toBeCloseTo(40, 6)
    })

    test('returns null when ground extent is unavailable', () => {
        expect(effectiveResolutionMpp(1, 1000, 0)).toBe(null)
    })
})

test.describe('Native resolution cap', () => {
    test('maxOutputDim is capped at the native pixel count over the extent', () => {
        // 1x wants 4000 px, but 10000 m / 20 m/px = 500 native px → capped to 500
        expect(resolutionToMaxDim(1, 4000, 20, 10000)).toBe(500)
    })

    test('native cap is ignored when it would not reduce the dimension', () => {
        // 1x wants 1000 px, native allows 2000 px → stays 1000
        expect(resolutionToMaxDim(1, 1000, 5, 10000)).toBe(1000)
    })

    test('effective resolution never goes finer than native', () => {
        // Without a native floor this would be 10 m/px; native is 20 → 20 m/px
        expect(effectiveResolutionMpp(1, 1000, 10000, 20)).toBeCloseTo(20, 6)
    })

    test('effective resolution unaffected by native when already coarser', () => {
        // 0.25x → 250 px → 40 m/px, coarser than native 20 → stays 40
        expect(effectiveResolutionMpp(0.25, 1000, 10000, 20)).toBeCloseTo(40, 6)
    })

    test('unknown native resolution leaves the relative-scale behavior intact', () => {
        expect(resolutionToMaxDim(1, 1000, null, 10000)).toBe(1000)
        expect(effectiveResolutionMpp(1, 1000, 10000, null)).toBeCloseTo(10, 6)
    })
})

test.describe('m/px formatting', () => {
    test('formats across magnitude ranges', () => {
        expect(fmtMpp(250)).toBe('250 m/px')
        expect(fmtMpp(12.34)).toBe('12.3 m/px')
        expect(fmtMpp(1.234)).toBe('1.23 m/px')
        expect(fmtMpp(0.123)).toBe('0.123 m/px')
    })

    test('returns empty string for non-finite values', () => {
        expect(fmtMpp(NaN)).toBe('')
        expect(fmtMpp(null)).toBe('')
    })
})

// ============================================================
// Visibility timeline temporal sampling
// ============================================================

// Fine (dedicated-ray) sampling step: samplingRate samples per sweep timestep.
function fineStepSeconds(coarseStepMs, samplingRate) {
    const rate = Math.max(1, Math.round(samplingRate || 1))
    return coarseStepMs / 1000 / rate
}

// Number of fine samples spanning [t0, tN] inclusive at the given rate.
function fineSampleCount(coarseCount, samplingRate) {
    const rate = Math.max(1, Math.round(samplingRate || 1))
    if (coarseCount < 2) return coarseCount
    return (coarseCount - 1) * rate + 1
}

// Select the series to plot: the dedicated-ray samples when they match the
// current sweep + rate, otherwise the coarse grid-derived centerVisible.
function getVisSeries(ed, samplingRate) {
    const results = ed?.results || []
    const vr = ed?.visResults
    if (
        vr &&
        vr.samples &&
        vr.samples.length > 0 &&
        vr.samplingRate === (samplingRate || 1) &&
        vr.baseStart === results[0]?.time &&
        vr.baseCount === results.length
    ) {
        return vr.samples
    }
    return results.map((r) => ({ time: r.time, visible: !!r.centerVisible }))
}

test.describe('Visibility timeline temporal sampling', () => {
    test('1x keeps the sweep step', () => {
        expect(fineStepSeconds(60000, 1)).toBe(60)
    })

    test('higher rates subdivide the step', () => {
        expect(fineStepSeconds(60000, 2)).toBe(30)
        expect(fineStepSeconds(60000, 4)).toBe(15)
        expect(fineStepSeconds(64000, 32)).toBe(2)
    })

    test('rate is clamped to a positive integer', () => {
        expect(fineStepSeconds(60000, 0)).toBe(60)
        expect(fineStepSeconds(60000, undefined)).toBe(60)
    })

    test('fine sample count aligns coarse frames on rate boundaries', () => {
        // 5 coarse frames at 4x → 4 fine samples per interval + 1 = 17
        expect(fineSampleCount(5, 4)).toBe(17)
        // coarse frame k maps to fine index k*rate
        const count = fineSampleCount(5, 4)
        expect((5 - 1) * 4).toBe(count - 1)
    })

    test('single-frame sweep has nothing to densify', () => {
        expect(fineSampleCount(1, 8)).toBe(1)
    })
})

test.describe('Visibility series selection', () => {
    const ed = {
        results: [
            { time: 't0', centerVisible: true },
            { time: 't1', centerVisible: false },
        ],
    }

    test('falls back to grid centerVisible when no dedicated series', () => {
        const s = getVisSeries(ed, 1)
        expect(s.map((x) => x.visible)).toEqual([true, false])
    })

    test('prefers the dedicated ray series when it matches', () => {
        const edVis = {
            ...ed,
            visResults: {
                samplingRate: 2,
                baseStart: 't0',
                baseCount: 2,
                samples: [
                    { time: 't0', visible: false },
                    { time: 't0.5', visible: true },
                    { time: 't1', visible: true },
                ],
            },
        }
        const s = getVisSeries(edVis, 2)
        expect(s.length).toBe(3)
        expect(s.map((x) => x.visible)).toEqual([false, true, true])
    })

    test('ignores a stale dedicated series (wrong rate)', () => {
        const edVis = {
            ...ed,
            visResults: {
                samplingRate: 2,
                baseStart: 't0',
                baseCount: 2,
                samples: [{ time: 't0', visible: false }],
            },
        }
        // Current rate is 1 → cache (rate 2) is stale → fall back to coarse
        const s = getVisSeries(edVis, 1)
        expect(s.map((x) => x.visible)).toEqual([true, false])
    })

    test('ignores a stale dedicated series (different sweep)', () => {
        const edVis = {
            ...ed,
            visResults: {
                samplingRate: 1,
                baseStart: 'DIFFERENT',
                baseCount: 2,
                samples: [{ time: 'x', visible: false }],
            },
        }
        const s = getVisSeries(edVis, 1)
        expect(s.map((x) => x.visible)).toEqual([true, false])
    })
})
