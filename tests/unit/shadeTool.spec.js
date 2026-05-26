import { test, expect } from '@playwright/test'

/**
 * ShadeTool Unit Tests
 * Tests for compositeResults, cumulativeVisibility, and time-range logic.
 * Since ShadeTool_Algorithm has browser-dependent imports (window.L),
 * we inline the pure algorithm logic here for unit testing.
 */

// Inline implementation of compositeResults for testing
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
                if (v === 9) {
                    noData = true
                    break
                }
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

// Inline implementation of cumulativeVisibility for testing
function cumulativeVisibility(resultGrids) {
    if (!resultGrids || resultGrids.length === 0) return []
    const rows = resultGrids[0].length
    const cols = resultGrids[0][0].length
    let heatmap = []

    for (let y = 0; y < rows; y++) {
        heatmap.push(new Array(cols).fill(0))
        for (let x = 0; x < cols; x++) {
            let visCount = 0
            let total = 0
            for (let g = 0; g < resultGrids.length; g++) {
                const v = resultGrids[g][y][x]
                if (v === 9) continue
                total++
                if (v === 1 || v === 2) visCount++
            }
            heatmap[y][x] = total > 0 ? visCount / total : -1
        }
    }
    return heatmap
}

test.describe('compositeResults', () => {
    test('returns empty array for empty input', () => {
        expect(compositeResults([], 'or')).toEqual([])
    })

    test('returns single grid unchanged', () => {
        const grid = [
            [1, 0, 9],
            [0, 1, 1],
        ]
        expect(compositeResults([grid], 'or')).toEqual(grid)
    })

    test('OR mode: shadow if hidden from ANY source', () => {
        const gridA = [
            [1, 0, 1],
            [0, 1, 0],
        ]
        const gridB = [
            [1, 1, 0],
            [1, 0, 1],
        ]
        const result = compositeResults([gridA, gridB], 'or')
        expect(result).toEqual([
            [1, 0, 0],
            [0, 0, 0],
        ])
    })

    test('AND mode: shadow only if hidden from ALL sources', () => {
        const gridA = [
            [1, 0, 1],
            [0, 1, 0],
        ]
        const gridB = [
            [1, 1, 0],
            [1, 0, 1],
        ]
        const result = compositeResults([gridA, gridB], 'and')
        expect(result).toEqual([
            [1, 1, 1],
            [1, 1, 1],
        ])
    })

    test('AND mode with actual shadow overlap', () => {
        const gridA = [
            [0, 0],
            [1, 0],
        ]
        const gridB = [
            [0, 1],
            [1, 0],
        ]
        const result = compositeResults([gridA, gridB], 'and')
        expect(result).toEqual([
            [0, 1],
            [1, 0],
        ])
    })

    test('preserves nodata (9) values', () => {
        const gridA = [
            [1, 9],
            [0, 1],
        ]
        const gridB = [
            [0, 1],
            [1, 0],
        ]
        const result = compositeResults([gridA, gridB], 'or')
        expect(result[0][1]).toBe(9)
    })

    test('handles three grids with OR', () => {
        const g1 = [[1, 1, 0]]
        const g2 = [[1, 0, 1]]
        const g3 = [[0, 1, 1]]
        const result = compositeResults([g1, g2, g3], 'or')
        expect(result).toEqual([[0, 0, 0]])
    })

    test('defaults to OR when mode is unspecified', () => {
        const gridA = [[1, 0]]
        const gridB = [[0, 1]]
        const result = compositeResults([gridA, gridB])
        expect(result).toEqual([[0, 0]])
    })
})

test.describe('cumulativeVisibility', () => {
    test('returns empty array for empty input', () => {
        expect(cumulativeVisibility([])).toEqual([])
    })

    test('single grid: visible cells get 1.0, shadowed get 0.0', () => {
        const grid = [
            [1, 0],
            [2, 9],
        ]
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
        const result = cumulativeVisibility([g1, g2])
        expect(result[0][0]).toBe(0.0)
    })

    test('nodata cells across all grids give -1', () => {
        const g1 = [[9]]
        const g2 = [[9]]
        const result = cumulativeVisibility([g1, g2])
        expect(result[0][0]).toBe(-1)
    })
})

test.describe('Time-range iteration logic', () => {
    test('generates correct timestamps from start/end/step', () => {
        const startMs = new Date('2023-09-06T00:00:00Z').getTime()
        const endMs = new Date('2023-09-06T03:00:00Z').getTime()
        const stepMs = 60 * 60 * 1000

        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs) {
            timestamps.push(new Date(t).toISOString())
        }

        expect(timestamps.length).toBe(4)
        expect(timestamps[0]).toBe('2023-09-06T00:00:00.000Z')
        expect(timestamps[1]).toBe('2023-09-06T01:00:00.000Z')
        expect(timestamps[2]).toBe('2023-09-06T02:00:00.000Z')
        expect(timestamps[3]).toBe('2023-09-06T03:00:00.000Z')
    })

    test('handles 15-minute steps', () => {
        const startMs = new Date('2023-01-01T12:00:00Z').getTime()
        const endMs = new Date('2023-01-01T13:00:00Z').getTime()
        const stepMs = 15 * 60 * 1000

        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs) {
            timestamps.push(new Date(t).toISOString())
        }

        expect(timestamps.length).toBe(5)
    })

    test('single step when start equals end', () => {
        const startMs = new Date('2023-06-15T10:00:00Z').getTime()
        const endMs = startMs
        const stepMs = 60 * 60 * 1000

        const timestamps = []
        for (let t = startMs; t <= endMs; t += stepMs) {
            timestamps.push(new Date(t).toISOString())
        }

        expect(timestamps.length).toBe(1)
    })
})
