import { test, expect } from '@playwright/test'
import {
    interpolateColor,
    interpolateMultipleColors,
    hexToRgb,
    parseRgb,
    buildColorStops,
    rgbToHex,
} from '../../src/essence/Basics/Layers_/gradientUtils.js'

/**
 * Gradient Polyline Unit Tests
 * Tests for color interpolation, segment generation, elevation extraction,
 * min/max computation, connectAllPoints mode, and edge cases.
 */

test.describe('Gradient Utils - hexToRgb', () => {
    test('converts 6-char hex to RGB', () => {
        const rgb = hexToRgb('#ff0000')
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    test('converts hex without hash', () => {
        const rgb = hexToRgb('00ff00')
        expect(rgb).toEqual({ r: 0, g: 255, b: 0 })
    })

    test('converts 3-char hex', () => {
        const rgb = hexToRgb('#f00')
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    test('returns null for invalid input', () => {
        expect(hexToRgb(null)).toBeNull()
        expect(hexToRgb('')).toBeNull()
        expect(hexToRgb(123)).toBeNull()
    })
})

test.describe('Gradient Utils - parseRgb', () => {
    test('parses rgb() string', () => {
        const rgb = parseRgb('rgb(128, 64, 32)')
        expect(rgb).toEqual({ r: 128, g: 64, b: 32 })
    })

    test('returns null for invalid input', () => {
        expect(parseRgb(null)).toBeNull()
        expect(parseRgb('not a color')).toBeNull()
        expect(parseRgb('')).toBeNull()
    })
})

test.describe('Gradient Utils - interpolateColor', () => {
    test('returns color1 at factor 0', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 0)
        expect(result).toBe('rgb(255, 0, 0)')
    })

    test('returns color2 at factor 1', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 1)
        expect(result).toBe('rgb(0, 0, 255)')
    })

    test('interpolates midpoint correctly', () => {
        const result = interpolateColor('#ff0000', '#0000ff', 0.5)
        const rgb = parseRgb(result)
        expect(rgb.r).toBe(128)
        expect(rgb.g).toBe(0)
        expect(rgb.b).toBe(128)
    })

    test('clamps factor below 0', () => {
        const below = interpolateColor('#ff0000', '#0000ff', -0.5)
        expect(below).toBe('rgb(255, 0, 0)')
    })

    test('clamps factor above 1', () => {
        const above = interpolateColor('#ff0000', '#0000ff', 1.5)
        expect(above).toBe('rgb(0, 0, 255)')
    })

    test('handles null colors gracefully', () => {
        expect(interpolateColor(null, '#ff0000', 0.5)).toBe('#ff0000')
        expect(interpolateColor('#ff0000', null, 0.5)).toBe('#ff0000')
    })
})

test.describe('Gradient Utils - interpolateMultipleColors', () => {
    const colorStops = [
        { position: 0, color: '#0000ff' },
        { position: 0.5, color: '#00ff00' },
        { position: 1, color: '#ff0000' },
    ]

    test('returns first color at min value', () => {
        const result = interpolateMultipleColors(colorStops, 0, 0, 100)
        expect(result).toBe('#0000ff')
    })

    test('returns last color at max value', () => {
        const result = interpolateMultipleColors(colorStops, 100, 0, 100)
        expect(result).toBe('#ff0000')
    })

    test('returns middle color at midpoint', () => {
        const result = interpolateMultipleColors(colorStops, 50, 0, 100)
        // Value lands exactly on the middle stop; interpolateColor returns rgb()
        const rgb = parseRgb(result) || parseRgb(rgbToHex(result))
        expect(rgb).not.toBeNull()
        expect(rgb.r).toBe(0)
        expect(rgb.g).toBe(255)
        expect(rgb.b).toBe(0)
    })

    test('interpolates between stops', () => {
        const result = interpolateMultipleColors(colorStops, 25, 0, 100)
        const rgb = parseRgb(result)
        expect(rgb).not.toBeNull()
        expect(rgb.r).toBe(0)
        expect(rgb.g).toBe(128)
        expect(rgb.b).toBe(128)
    })

    test('handles min === max without dividing by zero', () => {
        const result = interpolateMultipleColors(colorStops, 5, 5, 5)
        expect(result).toBe('#0000ff')
    })

    test('returns null for empty stops', () => {
        expect(interpolateMultipleColors([], 0, 0, 100)).toBeNull()
        expect(interpolateMultipleColors(null, 0, 0, 100)).toBeNull()
    })

    test('returns single color for single stop', () => {
        const result = interpolateMultipleColors(
            [{ position: 0, color: '#ff0000' }],
            50,
            0,
            100
        )
        expect(result).toBe('#ff0000')
    })
})

test.describe('Gradient Utils - buildColorStops', () => {
    test('builds evenly spaced stops from color array', () => {
        const stops = buildColorStops(['#0000ff', '#00ff00', '#ff0000'])
        expect(stops).toEqual([
            { position: 0, color: '#0000ff' },
            { position: 0.5, color: '#00ff00' },
            { position: 1, color: '#ff0000' },
        ])
    })

    test('handles single color', () => {
        const stops = buildColorStops(['#ff0000'])
        expect(stops).toEqual([{ position: 0, color: '#ff0000' }])
    })

    test('handles five color ramp', () => {
        const stops = buildColorStops([
            '#0000ff',
            '#00ffff',
            '#00ff00',
            '#ffff00',
            '#ff0000',
        ])
        expect(stops.length).toBe(5)
        expect(stops[0].position).toBeCloseTo(0)
        expect(stops[1].position).toBeCloseTo(0.25)
        expect(stops[2].position).toBeCloseTo(0.5)
        expect(stops[3].position).toBeCloseTo(0.75)
        expect(stops[4].position).toBeCloseTo(1)
    })

    test('returns empty array for empty/null input', () => {
        expect(buildColorStops([])).toEqual([])
        expect(buildColorStops(null)).toEqual([])
    })
})

test.describe('Gradient Utils - rgbToHex', () => {
    test('converts rgb string to hex', () => {
        expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000')
        expect(rgbToHex('rgb(0, 255, 0)')).toBe('#00ff00')
        expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff')
    })

    test('returns input for non-rgb strings', () => {
        expect(rgbToHex('#ff0000')).toBe('#ff0000')
        expect(rgbToHex(null)).toBeNull()
    })
})

test.describe('Gradient Polyline - Segment Generation', () => {
    test('generates correct number of segments from LineString', () => {
        const coords = [
            [-122.478, 37.819, 50, 0.3, 1.0],
            [-122.477, 37.818, 150, 0.6, -1.5],
            [-122.476, 37.817, 300, 1.0, 2.8],
            [-122.475, 37.816, 500, 1.4, -0.5],
            [-122.474, 37.815, 750, 1.8, 3.2],
        ]
        // 5 coordinates -> 4 segments
        const segments = []
        for (let i = 0; i < coords.length - 1; i++) {
            segments.push({
                lng1: coords[i][0],
                lat1: coords[i][1],
                elev1: coords[i][2],
                lng2: coords[i + 1][0],
                lat2: coords[i + 1][1],
                elev2: coords[i + 1][2],
            })
        }
        expect(segments.length).toBe(4)
        expect(segments[0].lng1).toBe(-122.478)
        expect(segments[0].elev1).toBe(50)
        expect(segments[3].elev2).toBe(750)
    })

    test('single coordinate produces no segments', () => {
        const coords = [[-122.478, 37.819, 50, 0.3, 1.0]]
        const segments = []
        for (let i = 0; i < coords.length - 1; i++) {
            segments.push({})
        }
        expect(segments.length).toBe(0)
    })

    test('two coordinates produce one segment', () => {
        const coords = [
            [-122.478, 37.819, 50, 0.3, 1.0],
            [-122.477, 37.818, 150, 0.6, -1.5],
        ]
        const segments = []
        for (let i = 0; i < coords.length - 1; i++) {
            segments.push({
                lng1: coords[i][0],
                lat1: coords[i][1],
                elev1: coords[i][2],
                lng2: coords[i + 1][0],
                lat2: coords[i + 1][1],
                elev2: coords[i + 1][2],
            })
        }
        expect(segments.length).toBe(1)
    })
})

test.describe('Gradient Polyline - Property Extraction', () => {
    test('extracts correct property value from coord_properties', () => {
        const coordProperties = ['elevation', 'speed', 'roll']
        const coord = [-122.47, 37.81, 500, 1.5, -0.8]

        const propValues = {}
        coordProperties.forEach((prop, idx) => {
            propValues[prop] = coord[2 + idx]
        })

        expect(propValues.elevation).toBe(500)
        expect(propValues.speed).toBe(1.5)
        expect(propValues.roll).toBe(-0.8)
    })

    test('returns correct value for colorWithProp selection', () => {
        const coordProperties = ['elevation', 'speed', 'roll']
        const coord = [-122.47, 37.81, 500, 1.5, -0.8]
        const colorWithProp = 'speed'

        const propIdx = coordProperties.indexOf(colorWithProp)
        const value = propIdx >= 0 ? coord[2 + propIdx] : 0

        expect(value).toBe(1.5)
    })

    test('defaults to 0 for missing property', () => {
        const coordProperties = ['elevation', 'speed', 'roll']
        const coord = [-122.47, 37.81, 500, 1.5, -0.8]
        const colorWithProp = 'nonexistent'

        const propIdx = coordProperties.indexOf(colorWithProp)
        const value = propIdx >= 0 ? coord[2 + propIdx] : 0

        expect(value).toBe(0)
    })
})

test.describe('Gradient Polyline - Min/Max Computation', () => {
    test('computes correct min/max across features', () => {
        const features = [
            {
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [-122.47, 37.81, 50],
                        [-122.48, 37.82, 200],
                    ],
                },
            },
            {
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [-122.49, 37.83, 100],
                        [-122.50, 37.84, 2000],
                    ],
                },
            },
        ]

        let min = Infinity
        let max = -Infinity

        features.forEach((f) => {
            f.geometry.coordinates.forEach((c) => {
                const val = c[2] || 0
                if (min > val) min = val
                if (max < val) max = val
            })
        })

        expect(min).toBe(50)
        expect(max).toBe(2000)
    })

    test('handles all same values', () => {
        const values = [100, 100, 100, 100]
        let min = Infinity
        let max = -Infinity
        values.forEach((v) => {
            if (min > v) min = v
            if (max < v) max = v
        })

        expect(min).toBe(100)
        expect(max).toBe(100)
        const stops = buildColorStops(['#0000ff', '#ff0000'])
        const result = interpolateMultipleColors(stops, 100, min, max)
        expect(result).toBe('#0000ff')
    })

    test('handles negative values', () => {
        const values = [-50, -10, 0, 20, 100]
        let min = Infinity
        let max = -Infinity
        values.forEach((v) => {
            if (min > v) min = v
            if (max < v) max = v
        })

        expect(min).toBe(-50)
        expect(max).toBe(100)

        const stops = buildColorStops(['#0000ff', '#ff0000'])
        const result = interpolateMultipleColors(stops, -50, min, max)
        expect(result).toBe('#0000ff')
    })
})

test.describe('Gradient Polyline - connectAllPoints Mode', () => {
    test('collects points and builds segments from Point features', () => {
        const features = [
            {
                geometry: { type: 'Point', coordinates: [-122.47, 37.81, 100] },
                properties: { elevation: 100 },
            },
            {
                geometry: { type: 'Point', coordinates: [-122.48, 37.82, 200] },
                properties: { elevation: 200 },
            },
            {
                geometry: { type: 'Point', coordinates: [-122.49, 37.83, 300] },
                properties: { elevation: 300 },
            },
        ]

        const points = []
        features.forEach((f) => {
            if (f.geometry.type.toLowerCase() === 'point') {
                const coords = f.geometry.coordinates
                points.push({
                    lng: coords[0],
                    lat: coords[1],
                    elev: coords[2] || 0,
                    value: f.properties.elevation || 0,
                })
            }
        })

        const segments = []
        for (let i = 0; i < points.length - 1; i++) {
            segments.push({
                lng1: points[i].lng,
                lat1: points[i].lat,
                elev1: points[i].elev,
                value1: points[i].value,
                lng2: points[i + 1].lng,
                lat2: points[i + 1].lat,
                elev2: points[i + 1].elev,
                value2: points[i + 1].value,
            })
        }

        expect(points.length).toBe(3)
        expect(segments.length).toBe(2)
        expect(segments[0].value1).toBe(100)
        expect(segments[0].value2).toBe(200)
        expect(segments[1].value1).toBe(200)
        expect(segments[1].value2).toBe(300)
    })
})

test.describe('Gradient Polyline - Elevation Extraction', () => {
    test('extracts elevation from 3rd coordinate position', () => {
        const coord = [-122.47, 37.81, 500, 1.5, -0.8]
        expect(coord[2]).toBe(500)
    })

    test('defaults to 0 for missing elevation', () => {
        const coord = [-122.47, 37.81]
        const elev = coord[2] || 0
        expect(elev).toBe(0)
    })

    test('uses elevation for Cesium Cartesian3 height positions array', () => {
        const coord1 = [-122.478, 37.819, 50]
        const coord2 = [-122.477, 37.818, 150]
        const positions = [
            coord1[0], coord1[1], coord1[2],
            coord2[0], coord2[1], coord2[2],
        ]
        expect(positions).toEqual([
            -122.478, 37.819, 50, -122.477, 37.818, 150,
        ])
    })
})

test.describe('Gradient Polyline - Color Ramp End-to-End', () => {
    test('five-stop color ramp produces correct colors at boundaries', () => {
        const ramp = ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
        const stops = buildColorStops(ramp)

        expect(interpolateMultipleColors(stops, 0, 0, 100)).toBe('#0000ff')
        // Intermediate exact stops return rgb() from interpolateColor
        const r25 = parseRgb(interpolateMultipleColors(stops, 25, 0, 100))
        expect(r25).toEqual({ r: 0, g: 255, b: 255 })
        const r50 = parseRgb(interpolateMultipleColors(stops, 50, 0, 100))
        expect(r50).toEqual({ r: 0, g: 255, b: 0 })
        const r75 = parseRgb(interpolateMultipleColors(stops, 75, 0, 100))
        expect(r75).toEqual({ r: 255, g: 255, b: 0 })
        expect(interpolateMultipleColors(stops, 100, 0, 100)).toBe('#ff0000')
    })

    test('produces valid rgb for intermediate values', () => {
        const ramp = ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
        const stops = buildColorStops(ramp)

        const result = interpolateMultipleColors(stops, 12.5, 0, 100)
        const rgb = parseRgb(result)
        expect(rgb).not.toBeNull()
        expect(rgb.r).toBe(0)
        expect(rgb.g).toBe(128)
        expect(rgb.b).toBe(255)
    })

    test('full segment coloring pipeline', () => {
        const ramp = ['#0000ff', '#00ff00', '#ff0000']
        const stops = buildColorStops(ramp)
        const coords = [
            [-122.478, 37.819, 0],
            [-122.477, 37.818, 500],
            [-122.476, 37.817, 1000],
            [-122.475, 37.816, 1500],
            [-122.474, 37.815, 2000],
        ]
        const coordProperties = ['elevation']
        const colorWithProp = 'elevation'
        const propIdx = coordProperties.indexOf(colorWithProp)

        let min = Infinity
        let max = -Infinity
        coords.forEach((c) => {
            const val = propIdx >= 0 ? c[2 + propIdx] : 0
            if (val < min) min = val
            if (val > max) max = val
        })
        expect(min).toBe(0)
        expect(max).toBe(2000)

        const segmentColors = []
        for (let i = 0; i < coords.length - 1; i++) {
            const val1 = propIdx >= 0 ? coords[i][2 + propIdx] : 0
            const val2 = propIdx >= 0 ? coords[i + 1][2 + propIdx] : 0
            const avgVal = (val1 + val2) / 2
            segmentColors.push(
                interpolateMultipleColors(stops, avgVal, min, max)
            )
        }

        expect(segmentColors.length).toBe(4)
        const rgb0 = parseRgb(segmentColors[0])
        const rgb3 = parseRgb(segmentColors[3])
        expect(rgb0.b).toBeGreaterThan(rgb3.b)
        expect(rgb3.r).toBeGreaterThan(rgb0.r)
    })
})
