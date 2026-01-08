# DrawTool Point Template Field - Specification

**Feature Number**: 010
**Status**: ✅ Implemented
**Created**: 2026-01-05
**Last Updated**: 2026-01-07

## Overview

Add a new "point" template field type to the MMGIS DrawTool that enables users to associate point annotations with drawn features. This field type allows users to click a button in the Edit Panel and then click the map to place multiple points that are stored within the parent feature's metadata (not as separate DrawTool features). Points are visible on the map as markers and can be individually deleted.

**Context**: Currently, DrawTool templates support various field types (text, number, dropdown, date, etc.) for structured metadata, but there's no way to associate spatial point annotations with a feature. This enhancement enables use cases like marking sample locations on a traverse, annotating regions of interest on a polygon, or placing measurement points along a feature.

**Target Users**: Mission scientists, operations teams, and field geologists using MMGIS for spatial annotation and collaboration.

## User Scenarios

### P1 - Annotate Sample Locations on Traverse

**As a** field geologist documenting a rover traverse
**I want to** mark specific sample collection points along a drawn traverse line
**So that** I can record exactly where samples were taken and associate them with the traverse feature

**Acceptance Criteria**:
- [x] User can add a "point" field to DrawTool templates via Configure UI
- [x] "Add Pt" button appears in Edit Panel for features with point template fields
- [x] Clicking "Add Pt" enables map-clicking mode with visual feedback
- [x] Clicking map creates point with auto-generated name using next available number
- [x] Points appear as colored markers on the map
- [x] Each point is stored with unique ID, name, color, and coordinates
- [x] Points can be placed anywhere on the map (not restricted to feature geometry)

**User Flow**:
1. User opens Configure UI and creates/edits a template for a DrawTool file
2. User adds a new template field of type "point" with default color configuration
3. User applies template to file
4. User draws a feature (polygon, line, etc.) and opens Edit Panel
5. User sees "Add Pt" button in Properties tab
6. User clicks "Add Pt" button → button highlights, cursor info shows instructions
7. User clicks map location → prompt appears for point name
8. User enters name (e.g., "Sample A") → point added to list and marker appears on map
9. User repeats for additional points
10. User presses ESC or closes Edit Panel to exit point-adding mode
11. User clicks "Save Changes" to persist points with feature

### P2 - Mark Regions of Interest on Geology Map

**As a** science team member reviewing geological features
**I want to** place annotation points on polygon features to mark specific areas of interest
**So that** I can highlight notable formations or anomalies for team discussion

**Acceptance Criteria**:
- [x] Multiple points can be added to a single feature
- [x] Each point displays with configured color from template (editable after creation)
- [x] Points have unique sequential IDs with smart gap-filling numbering
- [x] Point list in Edit Panel shows all points with name, color badge, and delete button
- [x] Points persist when feature is saved to database

**User Flow**:
1. User clicks existing polygon feature on map
2. Edit Panel opens showing feature properties and point field
3. User clicks "Add Pt" button multiple times, placing several annotation points
4. User reviews list of points in Edit Panel
5. User saves feature → all points stored in feature metadata
6. User reloads page → points still visible on map

### P3 - Remove Incorrect Point Annotation

**As a** user who placed a point in the wrong location
**I want to** delete individual points from the list
**So that** I can correct mistakes without redoing all points

**Acceptance Criteria**:
- [x] Each point in list has a delete button
- [x] Clicking delete removes point from list
- [x] Deleted point marker disappears from map immediately
- [x] Deletion does not require saving feature (immediate in editing session)
- [x] Saving feature persists the updated point list
- [x] Closing edit panel without saving reverts unsaved point changes

**User Flow**:
1. User opens Edit Panel for feature with existing points
2. User sees list of points with delete buttons (X icons)
3. User clicks delete button next to incorrect point
4. Point removed from list and map marker disappears
5. User clicks "Save Changes" to persist the change

## Requirements

### Functional Requirements

**FR-001**: Template field type registration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1
- **Acceptance Criteria**:
  - "point" added to `_TEMPLATE_TYPES` array in DrawTool_Templater.js
  - Point field option appears in template designer dropdown in Configure UI
  - Point field can be added to any template alongside other field types

**FR-002**: Template designer configuration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1
- **Acceptance Criteria**:
  - Configure UI allows setting default color for point markers (color picker)
  - Configure UI allows setting max points limit (0 = unlimited)
  - Configuration options saved in template definition

**FR-003**: Edit Panel UI rendering
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - "Add Pt" button renders in Properties tab for features with point fields
  - Point list displays all existing points with: color badge, name, delete button
  - Empty state shows "No points added" message
  - UI follows existing DrawTool styling conventions

**FR-004**: Map click mode activation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Clicking "Add Pt" button enables map-clicking mode
  - Button highlights with active state (green background, pulsing animation)
  - CursorInfo displays "Click map to place point. Press ESC to cancel."
  - Only one point-adding mode active at a time
  - Mode prevents interference with other DrawTool operations

**FR-005**: Point placement and creation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - User clicks map → prompt appears requesting point name
  - Default name suggestion: "Point N" (N = next number)
  - Point created with: unique ID (parent-uuid-N), user-provided name, default color, coordinates
  - Point added to in-memory array (helperStates)
  - Point marker rendered on map at clicked location
  - Mode remains active for placing additional points

**FR-006**: Point ID generation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Point ID format: `{parentFeatureUUID}-{sequentialNumber}`
  - Example: "abc-123-1", "abc-123-2", "abc-123-3"
  - IDs are unique within parent feature
  - Sequential numbering based on creation order

**FR-007**: Point visualization
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Points render as L.circleMarker with configured color
  - Marker style: radius 6px, weight 2px, fillOpacity 0.8
  - Marker has popup showing point name and parent feature name
  - Points visible when parent feature is visible
  - Points hidden when parent feature layer is toggled off

**FR-008**: Point deletion
- **Priority**: P1 (Must Have)
- **User Scenarios**: P3
- **Acceptance Criteria**:
  - Each point in list has delete button (X icon) with hover effect
  - Clicking delete removes point from array immediately
  - Point marker removed from map
  - No confirmation dialog required (simple undo via cancel)
  - Changes applied to editing session, persisted on "Save Changes"

**FR-009**: Point data persistence
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - Points stored in feature properties as array under field name key
  - Each point object contains: id, name, color, coords [lng, lat]
  - Points saved to database when user clicks "Save Changes"
  - Points loaded from database when feature is rendered
  - Points persist across page reloads and sessions

**FR-010**: Mode cancellation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1
- **Acceptance Criteria**:
  - Pressing ESC key exits point-adding mode
  - Closing Edit Panel exits point-adding mode
  - Clicking different feature exits point-adding mode
  - CursorInfo cleared on mode exit
  - Button active state removed on mode exit

**FR-011**: Point placement flexibility
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Points can be placed anywhere on map (no geometry restriction)
  - Points can be placed outside parent feature boundaries
  - Points support all coordinate systems used by MMGIS

**FR-012**: Multiple point fields per feature
- **Priority**: P2 (Should Have)
- **User Scenarios**: P2
- **Acceptance Criteria**:
  - Templates can have multiple point fields (e.g., "samplePoints", "waypointMarkers")
  - Each field maintains separate point array
  - Each field has independent "Add Pt" button
  - Point markers color-coded by field configuration

**FR-013**: Smart gap-filling point numbering
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - When points are deleted, new points reuse the lowest available number
  - Numbers are extracted from existing point names using regex pattern matching
  - Numbering works with both single names (e.g., "Point #") and comma-separated dropdown options (e.g., "A#, B#, C#")
  - Example: Delete "C-1" from ["C-1", "C-2"], next point becomes "C-1" (not "C-3")
  - Prevents gaps in numbering sequences

**FR-014**: Reset and close-without-save behavior
- **Priority**: P1 (Must Have)
- **User Scenarios**: P3
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - Original feature properties saved as deep copy when opening edit panel
  - Clicking "Reset" button reverts all unsaved point changes
  - Closing edit panel without clicking "Save Changes" reverts all unsaved point changes
  - Temporary edit markers removed on revert
  - Permanent markers re-rendered from original data
  - `_changesSaved` flag tracks save state to prevent incorrect reverts

**FR-015**: Max points limit enforcement with user feedback
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - Max points limit validated BEFORE creating point
  - "Add Pt" button shows visual indicator when at max (grayed out, lower opacity)
  - Button remains clickable to show helpful error message
  - CursorInfo displays: "Maximum of N points reached. Delete a point to add more."
  - Button styling uses `.at-max` CSS class (not `disabled` attribute)
  - Max points = 0 or empty means unlimited points

**FR-016**: Point color editing after creation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P2
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - Color badge in point list is clickable
  - Clicking color badge shows color picker with 12 color options
  - Selecting new color updates both badge and map marker immediately
  - Color changes persist when feature is saved
  - Originally listed as "Out of Scope", but implemented due to user need

**FR-017**: Point name editing after creation
- **Priority**: P1 (Must Have)
- **User Scenarios**: P2
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - Point names displayed as editable text inputs (for single name patterns)
  - Point names displayed as dropdowns (for comma-separated name patterns)
  - Changing name updates marker popup immediately
  - Name changes persist when feature is saved
  - Dropdown options support # replacement with point's assigned number
  - Originally listed as "Out of Scope", but implemented due to user need

**FR-018**: Two-layer rendering system
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - Permanent associated point markers rendered on layer load from saved feature properties
  - Temporary edit markers rendered when opening edit panel
  - Permanent markers hidden when edit panel opens (to prevent duplicates)
  - Permanent markers shown again when edit panel closes
  - Temporary markers cleaned up on save, reset, or close
  - System prevents duplicate point visualization

**FR-019**: Template configuration tooltips and documentation
- **Priority**: P2 (Should Have)
- **User Scenarios**: P1
- **Status**: ✅ Implemented
- **Acceptance Criteria**:
  - "Default Name" field has comprehensive tooltip explaining # syntax
  - Tooltip shows examples for both single names ("Point #") and comma-separated ("A#, B#, C#")
  - "Max Points" field has tooltip explaining 0/empty = unlimited
  - Input fields widened for better visibility (240px for name, 80px for max)
  - Improves discoverability without requiring external documentation

### Non-Functional Requirements

**NFR-001**: Performance
- **Category**: Performance
- **Metric**: Point rendering does not cause visible lag for <100 points per feature
- **Rationale**: Users may add many points to long traverse features

**NFR-002**: Usability
- **Category**: Usability
- **Metric**: Point-adding mode clearly indicated with visual feedback within 100ms
- **Rationale**: Users must understand when map clicks will place points vs. perform other actions

**NFR-003**: Data integrity
- **Category**: Data Integrity
- **Metric**: Point IDs remain unique across all editing operations
- **Rationale**: Prevent data corruption from duplicate IDs

**NFR-004**: Consistency
- **Category**: Usability
- **Metric**: Point field UI/UX follows existing template field patterns (code reuse >70%)
- **Rationale**: Maintain consistent user experience across DrawTool

**NFR-005**: Browser compatibility
- **Category**: Compatibility
- **Metric**: Works in all browsers supported by MMGIS (Chrome, Firefox, Safari, Edge)
- **Rationale**: Mission teams use diverse platforms

## Success Criteria

**Definition of Done**:
- [x] All P1 functional requirements implemented
- [x] All acceptance criteria met for P1 user scenarios
- [x] Point field type available in Configure UI template designer
- [x] Points can be added, viewed, edited, and deleted via Edit Panel
- [x] Points persist to database and survive page reloads
- [x] Smart gap-filling numbering implemented
- [x] Reset and close-without-save behavior working correctly
- [x] Max points limit enforced with user feedback
- [x] Two-layer rendering system prevents duplicate visualization
- [ ] Unit tests written and passing (target coverage: 80%+)
- [x] Manual testing completed for all user scenarios
- [ ] Code reviewed and approved
- [x] Documentation updated (specification reflects all implemented features)
- [x] Feature deployed to development environment

**Metrics**:
- Point addition workflow completes in <5 seconds (from button click to marker on map)
- Zero data loss incidents during point editing sessions
- UI responsiveness maintained with 50+ points per feature
- 100% of existing DrawTool functionality remains operational

**Out of Scope** (for v1):
- Editing point coordinates after placement (move markers by dragging)
- Exporting points as separate GeoJSON layer
- Snapping points to feature geometry
- Point clustering for dense annotations
- Undo/redo for point operations (beyond Reset button)
- Custom marker symbols per point (currently fixed as circleMarker)

**Note**: The following were originally listed as out of scope but were implemented due to user need:
- ✅ Editing point name after creation (implemented with text inputs and dropdowns)
- ✅ Editing point color after creation (implemented with color picker)

## Resolved Design Decisions

1. **Max points limit enforcement**: ✅ Resolved
   - **Decision**: Button remains clickable but shows visual indicator (`.at-max` class) and displays helpful CursorInfo message
   - **Rationale**: Preserves click event for user feedback while clearly indicating limit reached

2. **Point naming**: ✅ Resolved
   - **Decision**: Auto-generate names using smart gap-filling algorithm (no prompt)
   - **Rationale**: Streamlines workflow, names are editable after creation via text inputs or dropdowns
   - **Behavior**: Finds lowest unused number in sequence to fill gaps

3. **Point marker styling customization**: ✅ Resolved
   - **Decision**: Implemented color editing after creation via color picker
   - **Rationale**: User feedback indicated this was essential for workflow
   - **Implementation**: Click color badge to show 12-color palette, updates badge and marker immediately

4. **Temporary vs permanent markers**: ✅ Resolved
   - **Decision**: Two-layer rendering system with both temporary and permanent markers
   - **Implementation**:
     - Permanent markers rendered on layer load from saved properties
     - Temporary markers rendered during editing session
     - Permanent markers hidden while editing to prevent duplicates
     - Temporary markers cleaned up on save, reset, or close
   - **Rationale**: Clean separation of concerns, prevents duplication, enables proper reset behavior

5. **Reset/Close-without-save behavior**: ✅ Resolved
   - **Decision**: Revert unsaved changes when closing edit panel or clicking Reset
   - **Implementation**: Deep copy `_originalProperties` on panel open, restore on close if `_changesSaved` is false
   - **Rationale**: Prevents accidental data loss, matches user expectations

6. **Point numbering strategy**: ✅ Resolved
   - **Decision**: Use next available number (gap-filling) instead of array index
   - **Implementation**: Extract all used numbers, find smallest unused starting from 1
   - **Rationale**: Prevents confusing numbering sequences when points are deleted

## Open Questions

1. **Multi-user collaboration**: What happens if two users edit points on same feature simultaneously?
   - **Current behavior**: Last save wins (existing DrawTool pattern). WebSocket sync for future enhancement.

## References

- **Related Specs**:
  - [006-interactive-mapping-tools](../006-interactive-mapping-tools/spec.md) - DrawTool overview
  - [003-real-time-collaboration-infrastructure](../003-real-time-collaboration-infrastructure/spec.md) - Future WebSocket sync

- **Technical Documentation**:
  - DrawTool_Templater.js architecture (lines 18-1287)
  - DrawTool_Drawing.js point drawing implementation (lines 1024-1152)
  - Leaflet.Draw documentation: https://leaflet.github.io/Leaflet.draw/docs/leaflet-draw-latest.html

- **Related Issues**:
  - GitHub Issue #843: DrawTool - Template for Point Type

## Data Structure Reference

Points stored in parent feature properties:

```javascript
{
  type: "Feature",
  properties: {
    name: "Parent Feature",
    uuid: "abc-123",
    // ... other template fields

    // Point field (field name from template, e.g., "samplePoints")
    "samplePoints": [
      {
        id: "abc-123-1",           // parent UUID + suffix
        name: "Sample A",          // user-provided name
        color: "rgb(255,0,0)",     // from template config
        coords: [-118.123, 34.567] // [lng, lat]
      },
      {
        id: "abc-123-2",
        name: "Sample B",
        color: "rgb(255,0,0)",
        coords: [-118.124, 34.568]
      }
    ]
  },
  geometry: { type: "Polygon", coordinates: [...] }
}
```

Template configuration:

```javascript
{
  name: "Traverse Template",
  template: [
    {
      type: "point",
      field: "samplePoints",
      default: [],
      defaultColor: "#ff0000",
      maxPoints: 0  // 0 = unlimited
    }
  ]
}
```

---

## Next Steps

After specification approval:

1. **Technical Planning** (`/speckit.plan`):
   - Design implementation architecture
   - Identify critical files to modify
   - Plan component integration strategy
   - Document technical decisions

2. **Task Breakdown** (`/speckit.tasks`):
   - Break down implementation into 1-2 day tasks
   - Identify dependencies and sequencing
   - Create tasks.md for tracking

3. **Implementation** (`/speckit.implement`):
   - Execute tasks from tasks.md
   - Follow constitution principles
   - Maintain test coverage >80%
   - Update task status progressively

4. **Validation** (`/speckit.checklist`):
   - Verify all acceptance criteria met
   - Run quality, security, testing checks
   - Ensure deployment readiness

---

## Implementation Details

### Critical Files Modified

**Frontend (Primary Implementation)**:
- `src/essence/Tools/Draw/DrawTool_Templater.js` (lines 114-1227, 1327, 1759-1784, 2146-2167, 2600-2602)
  - Rendertemplate case for "point" type (lines 114-127)
  - Point field initialization and event handlers (lines 250-308)
  - Smart numbering algorithm `findNextAvailableNumber()` (lines 1019-1038)
  - Point creation with gap-filling logic (lines 1006-1107)
  - Point list rendering with color picker and name editing (lines 671-889)
  - Max points validation and user feedback (lines 277-292, 865-889, 1058-1078)
  - Color editing implementation (lines 816-862)
  - Name editing for text inputs and dropdowns (lines 787-814, 738-786)
  - Two-layer marker management (renderPointMarker, removePointMarker, cleanupPointMarkersForFeature, cleanupAllPointMarkers)
  - Template designer UI for point type (lines 1759-1784)
  - Template configuration extraction (getDesignedTemplate, lines 2146-2167)
  - Default values handling (getTemplateDefaults, lines 2600-2602)

- `src/essence/Tools/Draw/DrawTool_Files.js` (lines 644-652, 1614, 1641, 1784-1836)
  - Permanent associated point rendering on layer load (lines 644-652)
  - Skip associated points in file hover handlers (lines 1614, 1641)
  - `removeAssociatedPoints()` - Remove all points for a feature (lines 1784-1798)
  - `hideAssociatedPoints()` - Hide points during editing (lines 1804-1818)
  - `showAssociatedPoints()` - Show points after editing (lines 1824-1836)

- `src/essence/Tools/Draw/DrawTool_Editing.js` (lines 897-904, 2347-2390, 2607-2610)
  - Save original properties deep copy on edit panel open (lines 897-904)
  - Restore original properties on close without save (lines 2347-2390)
  - Mark changes as saved on successful save (lines 2607-2610)

- `src/essence/Tools/Draw/DrawTool.js` (line 685-686)
  - Null check for associated points in destroy function

- `src/essence/Tools/Draw/DrawTool_Templater.css` (lines 353-422)
  - Point field container and list styling
  - Color picker styling
  - `.at-max` button state styling

**Backend (Bug Fixes)**:
- `API/Backend/Draw/routes/draw.js` (lines 210-215, 341-351)
  - clipOver function: Replace null/empty history with `[-1]` placeholder (lines 210-215)
  - clipUnder function: Replace null/empty history with `[-1]` placeholder (lines 341-351)
  - Prevents SQL syntax error `IN ()` when no features exist

### Key Implementation Patterns

**Smart Gap-Filling Numbering**:
```javascript
const findNextAvailableNumber = (pattern, existingPoints) => {
    const usedNumbers = existingPoints
        .map(p => {
            const match = p.name.match(/\d+/)
            return match ? parseInt(match[0]) : null
        })
        .filter(n => n !== null)

    let nextNum = 1
    while (usedNumbers.includes(nextNum)) {
        nextNum++
    }
    return nextNum
}
```

**Two-Layer Rendering System**:
- **Temporary markers**: Created during editing session in `DrawTool_Templater._tempPointMarkers` object
  - Stored with unique IDs as keys
  - Cleaned up on save, reset, or close
  - Managed by `renderPointMarker()`, `removePointMarker()`, `cleanupAllPointMarkers()`

- **Permanent markers**: Rendered from saved feature properties on layer load
  - Added to `L_.layers.layer[layerId]` array with `_isAssociatedPoint: true` flag
  - Hidden during editing via `hideAssociatedPoints()` (sets `_wasHidden` flag and removes from map)
  - Shown after editing via `showAssociatedPoints()` (re-adds to map if `_wasHidden`)
  - Removed on feature delete via `removeAssociatedPoints()`

**Reset/Close-Without-Save**:
```javascript
// On edit panel open (DrawTool_Editing.js:897-904)
if (DrawTool.contextMenuLayer?.feature?.properties) {
    DrawTool.contextMenuLayer._originalProperties = JSON.parse(
        JSON.stringify(DrawTool.contextMenuLayer.feature.properties)
    )
    DrawTool.contextMenuLayer._changesSaved = false
}

// On save (DrawTool_Editing.js:2607-2610)
if (DrawTool.contextMenuLayer) {
    DrawTool.contextMenuLayer._changesSaved = true
}

// On close without save (DrawTool_Editing.js:2347-2390)
DrawTool_Templater.cleanupAllPointMarkers()
if (DrawTool.contextMenuLayer?._originalProperties &&
    !DrawTool.contextMenuLayer?._changesSaved) {
    DrawTool.contextMenuLayer.feature.properties =
        DrawTool.contextMenuLayer._originalProperties
    // Re-render permanent points from original data
}
```

**Max Points Validation**:
```javascript
// Check BEFORE creating point (DrawTool_Templater.js:277-292, 1058-1078)
const maxPoints = t.maxPoints || 0
const currentCount = helperStates[idx] ? helperStates[idx].length : 0
if (maxPoints > 0 && currentCount >= maxPoints) {
    CursorInfo.update(
        `Maximum of ${maxPoints} points reached. Delete a point to add more.`,
        4000, true, { x: 305, y: 6 }, '#e9ff26', 'black'
    )
    return
}

// Update button state (DrawTool_Templater.js:865-889)
if (maxPoints > 0 && points.length >= maxPoints) {
    addBtn.addClass('at-max')
        .attr('title', `Maximum of ${maxPoints} points reached`)
} else {
    addBtn.removeClass('at-max')
        .attr('title', 'Add a new point')
}
```

### Bugs Fixed During Implementation

**Bug #1: SQL Syntax Error with Empty IN Clause**
- **Symptom**: Error "syntax error at or near ')'" when adding feature after deleting all features with clip mode
- **Root Cause**: Empty `history` array resulted in SQL: `WHERE ... AND r.id IN ()`
- **Fix**: Replace null/empty history with `[-1]` placeholder in clipOver and clipUnder functions
- **Files**: `API/Backend/Draw/routes/draw.js` (lines 210-215, 341-351)

**Bug #2: Duplicate Point Visualization**
- **Symptom**: Points drawn twice when clicking feature to edit
- **Root Cause**: Permanent markers from layer load remained visible when temporary edit markers were added
- **Fix**: Implemented `hideAssociatedPoints()` to hide permanent markers during editing
- **Files**: `src/essence/Tools/Draw/DrawTool_Files.js` (lines 1804-1818)

**Bug #3: Unsaved Changes Persisting**
- **Symptom**: Closing edit panel or clicking Reset didn't revert unsaved point changes
- **Root Cause**: No mechanism to restore original properties
- **Fix**: Implemented deep copy of `_originalProperties` and `_changesSaved` flag
- **Files**: `src/essence/Tools/Draw/DrawTool_Editing.js` (lines 897-904, 2347-2390, 2607-2610)

**Bug #4: Undefined Properties Error on Destroy**
- **Symptom**: "Cannot read properties of undefined (reading 'properties')" in DrawTool.js:685
- **Root Cause**: Associated points don't have `feature.properties` structure
- **Fix**: Added null check to skip associated points
- **Files**: `src/essence/Tools/Draw/DrawTool.js` (lines 685-686)

**Bug #5: Undefined Properties Error on File Hover**
- **Symptom**: "Cannot read properties of undefined (reading 'style')" when hovering over files
- **Root Cause**: Code tried to access `feature.properties.style` on associated points
- **Fix**: Skip associated points in mouseenter/mouseleave handlers
- **Files**: `src/essence/Tools/Draw/DrawTool_Files.js` (lines 1614, 1641)

**Bug #6: Max Points Click Not Firing**
- **Symptom**: Add Pt button click handler not called when at max points
- **Root Cause**: Button disabled with `.prop('disabled', true)` prevented click events
- **Fix**: Use CSS class `.at-max` instead of disabled attribute
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js` (lines 865-889), `DrawTool_Templater.css` (lines 412-422)

**Bug #7: Wrong Point Numbering After Deletion**
- **Symptom**: New points used array index instead of filling gaps (e.g., C-1, C-2 → delete C-1 → add point → got C-2 instead of C-1)
- **Root Cause**: Used `existingPoints.length + 1` for numbering
- **Fix**: Implemented `findNextAvailableNumber()` function with smart gap-filling
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js` (lines 1019-1038)

### Technical Decisions

**Why Two-Layer System?**
- Enables clean reset behavior (discard temporary, restore permanent)
- Prevents accidental data loss
- Clear separation between editing state and saved state
- Allows proper cleanup on panel close

**Why CSS Class Instead of Disabled Attribute?**
- Preserves click events for user feedback
- Can show helpful CursorInfo message explaining why limit reached
- Better UX than silent button that doesn't respond

**Why Smart Numbering Instead of Simple Increment?**
- Prevents confusing sequences like C-1, C-3, C-4 (missing C-2)
- Matches user expectations
- More professional for scientific workflows
- Minimal performance impact (regex on small arrays)

**Why Deep Copy for Original Properties?**
- Prevents mutation of original data during editing
- Enables true revert functionality
- Simple implementation with JSON.parse/stringify
- Acceptable performance for typical feature property sizes

### Testing Notes

**Manual Testing Completed**:
- ✅ Add point field to template via Configure UI
- ✅ Place multiple points with different colors
- ✅ Edit point names (text input and dropdown modes)
- ✅ Edit point colors via color picker
- ✅ Delete points and verify marker removal
- ✅ Verify smart numbering fills gaps correctly
- ✅ Test max points limit with CursorInfo feedback
- ✅ Close edit panel without saving and verify revert
- ✅ Click Reset button and verify revert
- ✅ Save changes and verify persistence
- ✅ Reload page and verify points still visible
- ✅ Test with empty file (no features)
- ✅ Test with clip over/under modes
- ✅ Hover over files and verify no errors
- ✅ Multiple point fields per template

**Edge Cases Tested**:
- Empty file with clip mode enabled
- Deleting all points then adding new one
- Max points = 0 (unlimited)
- Non-sequential point deletions (e.g., delete 1, 3, 5)
- Comma-separated name patterns with # replacement
- Multiple point fields in single template

**Known Limitations**:
- No unit tests yet (see Definition of Done)
- No multi-user collaboration (last save wins)
- Cannot drag markers to move them
- Fixed circleMarker symbol (no custom icons)
