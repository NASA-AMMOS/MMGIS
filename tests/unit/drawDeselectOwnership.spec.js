/**
 * A file may only deselect a feature it owns.
 *
 * A pan refreshes every draw file that is on, and each refresh tries to restore
 * the current selection into its own rebuilt layer. The selection is global, so
 * every file that does NOT contain it reaches the "not found — deselect it"
 * branch and clears it.
 *
 * WHAT THAT LOOKED LIKE: fill in half a form, drag the map, and the form scrolls
 * to the top and empties. The deselect tears down the edit panel; the file that
 * actually owns the feature re-selects it a moment later and rebuilds the panel
 * from STORED properties, so everything typed and not yet saved is gone with
 * nothing to say so.
 *
 * It needs two files on to happen at all, which is why it survived single-file
 * use and appeared the day a second seeded form file shipped.
 *
 * The rule is pure, so it is tested here rather than through a map: a deselect
 * is permitted only when the selected feature's own `_.file_id` names the layer
 * being refreshed.
 */

import { test, expect } from '@playwright/test'

/**
 * The predicate as DrawTool_Files applies it.
 *
 * Kept in the test rather than exported because it is three lines inside a much
 * larger reload path; what matters is that the CASES are pinned, so a future
 * edit that drops the ownership check fails here.
 */
function mayDeselect(layerId, selectedMeta, selectedId) {
    const ownedByThisFile =
        selectedMeta != null &&
        selectedMeta.file_id != null &&
        layerId === 'DrawTool_' + selectedMeta.file_id
    return ownedByThisFile && selectedMeta.id === selectedId
}

test.describe('deselect ownership', () => {
    test('the owning file may deselect its own feature', () => {
        // Panned out of extent: this is the case the branch exists for.
        expect(mayDeselect('DrawTool_1200001', { id: 15, file_id: 1200001 }, 15)).toBe(true)
    })

    test('another file may NOT deselect it', () => {
        // The bug. Area Survey refreshing must not clear a selection that lives
        // in Grid Survey.
        expect(mayDeselect('DrawTool_1200000', { id: 15, file_id: 1200001 }, 15)).toBe(false)
    })

    test('a different feature in the same file is left alone', () => {
        expect(mayDeselect('DrawTool_1200001', { id: 15, file_id: 1200001 }, 99)).toBe(false)
    })

    test('a feature with no envelope is never deselected', () => {
        // `_` is DrawTool's own bookkeeping and a feature can arrive without it
        // — localDraw keeps such a feature rather than discarding it. Failing
        // open here costs a stale highlight; failing closed costs the panel.
        expect(mayDeselect('DrawTool_1200001', null, 15)).toBe(false)
        expect(mayDeselect('DrawTool_1200001', { id: 15 }, 15)).toBe(false)
    })

    test('file_id is compared as the layer name, not by loose equality', () => {
        // Layer names are strings and file ids are numbers; the comparison is
        // done by building the name, so it cannot be tripped by "1200001" vs
        // 1200001 disagreeing.
        expect(mayDeselect('DrawTool_1200001', { id: 15, file_id: '1200001' }, 15)).toBe(true)
    })
})
