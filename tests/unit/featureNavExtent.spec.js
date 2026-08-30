/**
 * Feature stepping over a view-scoped candidate list.
 *
 * A layer configured `variables.featureNav.scope: 'view'` navigates the
 * features inside the current map extent, so the list is rebuilt from the map
 * on every step. That leaves one case the plain index walk cannot answer: pan
 * away and the selected feature is no longer in its own list.
 *
 * WHAT IT LOOKED LIKE: open a photograph on a phone, pan to another cluster of
 * photographs, and both stepping arrows were dead — the walk never matched the
 * anchor, resolved a distance of 0 in both directions, and the arrows greyed
 * themselves out over a screen full of features that were plainly there.
 *
 * These are pure functions over GeoJSON, so none of this needs a map.
 */

import { test, expect } from '@playwright/test'
import {
    navAnchorInList,
    navEntryFeature,
    navPoint,
    navSpatialCompare,
} from '../../src/essence/Basics/UserInterface_/components/Description/navList.js'

/** A point feature carrying the index it has in the unfiltered layer. */
function feat(id, lng, lat) {
    return {
        type: 'Feature',
        properties: { _: { id } },
        geometry: { type: 'Point', coordinates: [lng, lat] },
    }
}

test.describe('navAnchorInList', () => {
    test('finds the anchor by its layer index, not by position', () => {
        const features = [feat(3, 0, 0), feat(7, 1, 1)]
        expect(navAnchorInList(features, 7)).toBe(true)
        expect(navAnchorInList(features, 3)).toBe(true)
        expect(navAnchorInList(features, 4)).toBe(false)
    })

    test('an emptied list holds no anchor', () => {
        expect(navAnchorInList([], 0)).toBe(false)
        expect(navAnchorInList(null, 0)).toBe(false)
    })

    test('survives features with no _ stamped on them', () => {
        expect(navAnchorInList([{ properties: {} }, null], 0)).toBe(false)
    })
})

test.describe('navEntryFeature', () => {
    const inView = [feat(4, 0, 0), feat(5, 1, 0), feat(6, 2, 0)]

    test('a sorted list is already in the direction of travel', () => {
        // Both comparators take their sign from the direction, so the head of
        // the array is the first feature reached either way.
        expect(navEntryFeature(inView, 'next', true).properties._.id).toBe(4)
        expect(navEntryFeature(inView, 'previous', true).properties._.id).toBe(4)
    })

    test('default order is ascending, so previous enters from the far end', () => {
        expect(navEntryFeature(inView, 'next', false).properties._.id).toBe(4)
        expect(navEntryFeature(inView, 'previous', false).properties._.id).toBe(
            6
        )
    })

    test('an empty view has no entry point', () => {
        expect(navEntryFeature([], 'next', false)).toBe(null)
        expect(navEntryFeature(null, 'next', true)).toBe(null)
    })

    test('the entry point gives a usable relative distance', () => {
        // getFeatureDistance resolves target - anchor, and selectFeature walks
        // that many features along. An anchor outside the view must still
        // produce a non-zero step, or the arrows read as "at a limit".
        const anchor = 40
        const step =
            navEntryFeature(inView, 'next', true).properties._.id - anchor
        expect(step).not.toBe(0)
        expect(step).toBe(4 - 40)
    })
})

test.describe('navPoint', () => {
    test('a point is its own position', () => {
        expect(navPoint(feat(0, 12, -34))).toEqual({ lng: 12, lat: -34 })
    })

    test('anything else is the centre of its bbox', () => {
        const line = {
            geometry: {
                type: 'LineString',
                coordinates: [
                    [0, 0],
                    [4, 2],
                ],
            },
        }
        expect(navPoint(line)).toEqual({ lng: 2, lat: 1 })
    })

    test('geometryless features have no position', () => {
        expect(navPoint({})).toBe(null)
        expect(navPoint(null)).toBe(null)
        expect(navPoint({ geometry: { type: 'Point', coordinates: [] } })).toBe(
            null
        )
    })
})

test.describe('navSpatialCompare', () => {
    // Banded rows, so two GPS fixes a metre apart in latitude are still the
    // same row and order west to east within it.
    const rowHeight = 0.001

    test('same row orders west to east', () => {
        const west = feat(0, 0, 0.0001)
        const east = feat(1, 1, 0.0002)
        expect(navSpatialCompare(west, east, rowHeight)).toBeLessThan(0)
    })

    test('a higher row wins over longitude', () => {
        const southEast = feat(0, 10, 0.0001)
        const northWest = feat(1, 0, 0.0021)
        expect(navSpatialCompare(southEast, northWest, rowHeight)).toBeLessThan(
            0
        )
    })

    test('features with no position sort last', () => {
        const nowhere = { properties: { _: { id: 9 } } }
        expect(navSpatialCompare(nowhere, feat(0, 0, 0), rowHeight)).toBe(1)
        expect(navSpatialCompare(feat(0, 0, 0), nowhere, rowHeight)).toBe(-1)
        expect(navSpatialCompare(nowhere, nowhere, rowHeight)).toBe(0)
    })
})
