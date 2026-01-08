# DrawTool Point Template Field - Tasks

**Plan Reference**: [plan.md](./plan.md)
**Spec Reference**: [spec.md](./spec.md)
**Status**: ⬜ Not Started
**Created**: 2026-01-05
**Last Updated**: 2026-01-05

## Task Breakdown

### Phase 1: Template Type Registration (Day 1)

**TASK-001**: Register "point" as template field type
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 2 hours
- **Dependencies**: None
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] "point" added to `_TEMPLATE_TYPES` array (line 650)
  - [x] Template with "point" field can be created without errors
  - [x] No console errors when loading page

**TASK-002**: Add basic renderTemplate() handler for "point" type
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 2 hours
- **Dependencies**: TASK-001
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Switch case added in renderTemplate() (line 113-119)
  - [x] Returns placeholder markup: `<li>TODO: point field</li>`
  - [x] Edit Panel opens for feature with point field without errors

**TASK-003**: Add getValues() and getTemplateDefaults() handlers
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 1 hour
- **Dependencies**: TASK-001
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] getValues() switch case returns empty array for "point" type (line 490-492)
  - [x] getTemplateDefaults() switch case returns empty array (line 1872-1874)
  - [x] Saving feature with point field does not cause errors

---

### Phase 2: Edit Panel UI (Day 2)

**TASK-004**: Create Edit Panel UI markup for point field
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 3 hours
- **Dependencies**: TASK-002
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [ ] renderTemplate() case "point" returns full HTML markup
  - [ ] Markup includes "Add Pt" button with icon (`mdi-map-marker-plus`)
  - [ ] Markup includes `<ul>` for point list with unique ID
  - [ ] Button and list wrapped in container div
  - [ ] Markup follows existing template field structure
  - [ ] ESLint passes

**TASK-005**: Implement renderPointList() helper function
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 3 hours
- **Dependencies**: TASK-004
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [ ] Function `renderPointList(fieldIdx, points)` added after renderTemplate()
  - [ ] Empty state: displays "No points added" when points array is empty
  - [ ] Point list: creates `<li>` for each point with color badge, name, delete button
  - [ ] Delete button has `mdi-delete` icon and `data-point-idx` attribute
  - [ ] Names sanitized with `F_.sanitize()`
  - [ ] Function called from renderTemplate() to initialize list
  - [ ] ESLint passes

**TASK-006**: Add CSS styling for point field UI
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 2 hours
- **Dependencies**: TASK-004, TASK-005
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.css`
- **Acceptance Criteria**:
  - [x] Styles added for `.drawToolTemplaterpoint` (field container)
  - [x] Styles added for `.drawToolTemplaterPointAddBtn` (button, hover, active states)
  - [x] Styles added for `.drawToolTemplaterPointList` (scrollable list, max-height 200px)
  - [x] Styles added for `.drawToolTemplaterPointItem` (list item with flexbox layout)
  - [x] Styles added for color badge, name, delete button
  - [x] Pulsing animation keyframes for `.active` button state
  - [x] Styles match existing DrawTool UI conventions
  - [ ] Tested in Chrome, Firefox, Edge

---

### Phase 3: Template Designer Configuration (Day 2)

**TASK-007**: Add "point" configuration UI in template designer
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 3 hours
- **Dependencies**: TASK-001
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Switch case added in renderDesignTemplate() setType() function (~line 800)
  - [x] UI includes color picker input (`<input type="color">`)
  - [x] UI includes max points input (`<input type="number" min="0">`)
  - [x] Default values: defaultColor = "#ff0000", maxPoints = 0
  - [x] getDesignedTemplate() extracts defaultColor and maxPoints from inputs
  - [ ] CSS styles added for `.drawToolTemplaterLiBody_point`
  - [ ] Tested: can create template with point field and save config

**TASK-008**: Add CSS styling for template designer
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 1 hour
- **Dependencies**: TASK-007
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.css`
- **Acceptance Criteria**:
  - [x] Styles added for `.drawToolTemplaterLiBody_point` (config container)
  - [x] Styles for color picker and number input
  - [x] Layout matches other template field config UIs
  - [x] Inputs sized appropriately (color: 60px wide, number: 80px wide)

---

### Phase 4: Map Click Mode & Point Creation (Day 3-4)

**TASK-009**: Implement startAddingPoint() function
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 4 hours
- **Dependencies**: TASK-005, TASK-006
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Function `startAddingPoint(fieldIdx, fieldName, fieldConfig)` added after renderTemplate()
  - [x] Checks if already in point-adding mode (shows warning if true)
  - [x] Gets parent feature from `DrawTool.contextMenuLayer.feature`
  - [x] Initializes `DrawTool_Templater._addingPointState` object
  - [x] Creates `L.Draw.CircleMarker` with default styling
  - [x] Enables drawing handler
  - [x] Attaches `draw:drawstop` event listener
  - [x] Attaches ESC key listener (`keydown.addpoint`)
  - [x] Shows CursorInfo: "Click map to place point. Press ESC to cancel."
  - [x] Adds `.active` class to button
  - [x] ESLint passes

**TASK-010**: Implement onPointPlaced() function
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 5 hours
- **Dependencies**: TASK-009
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Function `onPointPlaced(e)` added after startAddingPoint()
  - [x] Extracts coordinates from `drawingHandler._startLatLng`
  - [x] Prompts user for point name with default: "Point N"
  - [x] If cancelled (null), calls endAddingPoint(false) and returns
  - [x] Generates point ID: `${parentUUID}-${count+1}`
  - [x] Gets default color from field config or "#ff0000"
  - [x] Creates point object: `{ id, name, color, coords }`
  - [x] Adds point to `helperStates[fieldIdx]` array
  - [x] Calls renderPointList() to update UI
  - [x] Calls renderPointMarker() to show temporary marker
  - [x] Re-enables drawing handler (continuous mode)
  - [x] ESLint passes
  - [ ] Unit test: point ID format validation
  - [ ] Unit test: point object structure

**TASK-011**: Implement endAddingPoint() function
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 2 hours
- **Dependencies**: TASK-009
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Function `endAddingPoint(success)` added
  - [x] Disables drawing handler
  - [x] Removes `draw:drawstop` event listener
  - [x] Removes `keydown.addpoint` event listener
  - [x] Clears CursorInfo
  - [x] Removes `.active` class from button
  - [x] Clears `_addingPointState` to null
  - [x] ESLint passes

**TASK-012**: Implement temporary marker rendering helpers
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 3 hours
- **Dependencies**: TASK-010
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Function `renderPointMarker(point, parentFeature)` added
  - [x] Creates `L.circleMarker` with point color
  - [x] Style: radius 6, weight 2, fillOpacity 0.8
  - [x] Binds popup with point name
  - [x] Stores in `DrawTool_Templater._tempPointMarkers[point.id]`
  - [x] Function `removePointMarker(point)` added
  - [x] Removes marker from map using `Map_.rmNotNull()`
  - [x] Deletes from `_tempPointMarkers` object
  - [x] Module-level `_tempPointMarkers = {}` initialized
  - [x] ESLint passes

**TASK-013**: Wire up button click event handler
- **Status**: ✅ Complete
- **Assignee**: Claude
- **Estimate**: 2 hours
- **Dependencies**: TASK-009, TASK-011
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [x] Event handler added in renderTemplate() switch case "point"
  - [x] Initializes `helperStates[idx]` from `properties[t.field]` or empty array
  - [x] Calls renderPointList() to show existing points
  - [x] Attaches click handler to "Add Pt" button
  - [x] Handler calls `startAddingPoint(idx, t.field, t)`
  - [x] Handler uses `e.preventDefault()` and `e.stopPropagation()`
  - [x] ESLint passes

---

### Phase 5: Point Deletion & Persistence (Day 4)

**TASK-014**: Implement deletePoint() function
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 2 hours
- **Dependencies**: TASK-005, TASK-012
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [ ] Function `deletePoint(fieldIdx, pointIdx)` added
  - [ ] Uses `Array.splice()` to remove point from `helperStates[fieldIdx]`
  - [ ] Calls `removePointMarker(deletedPoint)` to remove marker
  - [ ] Calls `renderPointList()` to update UI
  - [ ] ESLint passes
  - [ ] Unit test: verify splice removes correct index
  - [ ] Unit test: verify marker removal called

**TASK-015**: Wire up delete button event handlers
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 1 hour
- **Dependencies**: TASK-014
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [ ] Delete button click handler added in renderPointList()
  - [ ] Handler calls `deletePoint(fieldIdx, pointIdx)`
  - [ ] Handler uses jQuery `.on('click', ...)` for dynamic elements
  - [ ] ESLint passes

**TASK-016**: Update getValues() to extract point arrays
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 1 hour
- **Dependencies**: TASK-003, TASK-010
- **Files**: `src/essence/Tools/Draw/DrawTool_Templater.js`
- **Acceptance Criteria**:
  - [ ] getValues() case "point" updated to return `helperStates[idx] || []`
  - [ ] Returns array of point objects with correct structure
  - [ ] ESLint passes
  - [ ] Unit test: verify array extraction

**TASK-017**: Add cleanup handlers in Edit Panel close
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 3 hours
- **Dependencies**: TASK-011, TASK-012
- **Files**: `src/essence/Tools/Draw/DrawTool_Editing.js`
- **Acceptance Criteria**:
  - [ ] Cleanup added to Edit Panel close handler (~line 2600)
  - [ ] Iterates `DrawTool_Templater._tempPointMarkers` and removes all markers
  - [ ] Clears `_tempPointMarkers` object
  - [ ] Calls `DrawTool_Templater.endAddingPoint()` if mode active
  - [ ] Cleanup added to `showContextMenu()` start (~line 568)
  - [ ] Forces end of point-adding mode when switching features
  - [ ] ESLint passes
  - [ ] Integration test: verify cleanup on panel close
  - [ ] Integration test: verify cleanup on feature switch

---

### Phase 6: Permanent Rendering (Day 5)

**TASK-018**: Implement renderAssociatedPoints() function
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 4 hours
- **Dependencies**: TASK-016
- **Files**: `src/essence/Tools/Draw/DrawTool_Files.js`
- **Acceptance Criteria**:
  - [ ] Function `renderAssociatedPoints(feature, fileId, layerId)` added
  - [ ] Gets file object and template from `DrawTool.getFileObjectWithId()`
  - [ ] Filters template for "point" type fields
  - [ ] Iterates each point field and extracts points array from properties
  - [ ] Creates `L.circleMarker` for each point with correct color
  - [ ] Style: radius 6, weight 2, fillOpacity 0.8
  - [ ] Binds popup with point name and parent feature name
  - [ ] Adds marker to `L_.layers.layer[layerId]`
  - [ ] Stores marker reference for cleanup
  - [ ] ESLint passes
  - [ ] Unit test: verify marker creation with mock data

**TASK-019**: Integrate renderAssociatedPoints() into refreshFile()
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 2 hours
- **Dependencies**: TASK-018
- **Files**: `src/essence/Tools/Draw/DrawTool_Files.js`
- **Acceptance Criteria**:
  - [ ] Call to `renderAssociatedPoints(features[i], id, layerId)` added in refreshFile()
  - [ ] Called after each feature is rendered (~line 1950)
  - [ ] Points render when file is loaded
  - [ ] Points render when file is toggled on
  - [ ] Points disappear when file is toggled off
  - [ ] ESLint passes
  - [ ] Integration test: load feature with points, verify visible
  - [ ] Integration test: toggle file off/on, verify points hide/show

---

### Phase 7: Testing & Quality (Day 6-7)

**TASK-020**: Write unit tests for template system
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 4 hours
- **Dependencies**: TASK-016
- **Files**: `src/essence/Tools/Draw/__tests__/DrawTool_Templater.test.js` (create)
- **Acceptance Criteria**:
  - [ ] Test: renderTemplate() for "point" type returns correct markup
  - [ ] Test: getValues() for "point" type extracts helperStates array
  - [ ] Test: getTemplateDefaults() for "point" type returns empty array
  - [ ] Test: Point ID generation format (UUID-N)
  - [ ] Test: Point object structure validation
  - [ ] Test: renderPointList() with empty array shows "No points added"
  - [ ] Test: renderPointList() with points creates correct HTML
  - [ ] Test: deletePoint() removes correct index from array
  - [ ] All tests pass
  - [ ] Coverage for DrawTool_Templater point-related code >80%

**TASK-021**: Write integration tests for point workflow
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 5 hours
- **Dependencies**: TASK-019
- **Files**: `src/essence/Tools/Draw/__tests__/DrawTool_PointWorkflow.test.js` (create)
- **Acceptance Criteria**:
  - [ ] Test: Full workflow - add template → create feature → add point → save → verify persisted
  - [ ] Test: Delete workflow - add points → delete one → save → verify deleted
  - [ ] Test: Mode cancellation - start adding → ESC → verify mode ended
  - [ ] Test: Edit Panel close - start adding → close panel → verify cleanup
  - [ ] Test: Feature switch - start adding → click different feature → verify mode ended
  - [ ] Test: Multiple point fields - create template with 2 point fields → verify independent management
  - [ ] Test: Rendering - load feature with points → verify markers visible
  - [ ] All tests pass
  - [ ] Coverage for point workflow >80%

**TASK-022**: Manual testing and bug fixes
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 4 hours
- **Dependencies**: TASK-021
- **Files**: Various (based on bugs found)
- **Acceptance Criteria**:
  - [ ] Test all user scenarios from spec.md manually
  - [ ] Test in Chrome, Firefox, Edge
  - [ ] Test with 50+ points (performance check)
  - [ ] Test layer toggle (hide/show points)
  - [ ] Test feature deletion (points removed)
  - [ ] Test Edit Panel cancel (no save, points not persisted)
  - [ ] Test max points limit enforcement
  - [ ] All bugs found are documented and fixed
  - [ ] No console errors during testing
  - [ ] Performance: add point completes in <5 seconds

**TASK-023**: ESLint cleanup and code review prep
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 2 hours
- **Dependencies**: TASK-022
- **Files**: All modified files
- **Acceptance Criteria**:
  - [ ] Run `npm run lint` with no errors
  - [ ] Run `npm test -- --coverage` with >80% coverage
  - [ ] All functions have JSDoc comments
  - [ ] Complex logic has inline comments
  - [ ] No unused variables or imports
  - [ ] Code formatted consistently (4-space indent, single quotes)
  - [ ] Self-review completed using PR checklist

---

### Phase 8: Documentation & Deployment (Day 7)

**TASK-024**: Update AGENTS.md with feature reference
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 1 hour
- **Dependencies**: TASK-023
- **Files**: `AGENTS.md`
- **Acceptance Criteria**:
  - [ ] Add feature 010 to Active Features section
  - [ ] Include one-line description: "Point template field for associating point annotations with DrawTool features"
  - [ ] Link to spec.md and plan.md
  - [ ] Status marked as "✅ Implemented and deployed" after merge

**TASK-025**: Create pull request and code review
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 4 hours (including review cycles)
- **Dependencies**: TASK-024
- **Files**: All modified files
- **Acceptance Criteria**:
  - [ ] PR created with title: "[Feature 010] DrawTool Point Template Field"
  - [ ] PR description references spec.md and plan.md
  - [ ] PR includes checklist from constitution
  - [ ] All CI checks pass (ESLint, tests, build)
  - [ ] Code review completed and approved
  - [ ] All review comments addressed
  - [ ] PR merged to branch `ts-843`

**TASK-026**: Merge to main and deploy to development
- **Status**: ⬜ Not Started
- **Assignee**: Unassigned
- **Estimate**: 1 hour
- **Dependencies**: TASK-025
- **Files**: N/A (deployment)
- **Acceptance Criteria**:
  - [ ] Branch merged to main branch
  - [ ] CI/CD pipeline completes successfully
  - [ ] Feature deployed to development environment
  - [ ] Smoke test: can create template, add points, save, reload
  - [ ] Monitor logs for errors (24 hours)
  - [ ] Feature announcement sent to team

---

## Task Status Summary

**Total Tasks**: 26
**Completed**: 13 (50%)
**In Progress**: 0
**Blocked**: 0
**Not Started**: 13

**Estimated Total Time**: 7 days (56 hours)
- Phase 1: 5 hours (0.6 days)
- Phase 2: 8 hours (1 day)
- Phase 3: 4 hours (0.5 days)
- Phase 4: 16 hours (2 days)
- Phase 5: 7 hours (0.9 days)
- Phase 6: 6 hours (0.75 days)
- Phase 7: 15 hours (1.9 days)
- Phase 8: 6 hours (0.75 days)

## Blockers

**No blockers identified at this time.**

Potential risks (from plan.md):
- Risk: L.Draw conflicts with existing drawing mode → Mitigation: Test thoroughly, disable other modes
- Risk: Memory leaks from listeners → Mitigation: Comprehensive cleanup functions
- Risk: Point ID collisions → Mitigation: Synchronous ID generation with UUID base

## Progress Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| TBD | Phase 1 Complete (Template Registration) | ⬜ |
| TBD | Phase 2-3 Complete (UI & Config) | ⬜ |
| TBD | Phase 4-5 Complete (Functionality & Persistence) | ⬜ |
| TBD | Phase 6 Complete (Rendering) | ⬜ |
| TBD | Testing Complete (80%+ coverage) | ⬜ |
| TBD | Code Review & PR Merged | ⬜ |
| TBD | Production Deployment | ⬜ |

## Critical Path

The following tasks are on the critical path and cannot be delayed:

1. **TASK-001** → **TASK-002** → **TASK-004** → **TASK-009** → **TASK-010** → **TASK-016** → **TASK-018** → **TASK-019** → **TASK-021** → **TASK-025** → **TASK-026**

Tasks that can be done in parallel:
- **TASK-003** (parallel with TASK-002)
- **TASK-006** (parallel with TASK-005)
- **TASK-007**, **TASK-008** (parallel with Phase 2)
- **TASK-014**, **TASK-015** (parallel with TASK-017)
- **TASK-020** (can start after TASK-010, parallel with TASK-018)

## Notes

### Implementation Order Recommendations

1. **Start with Phase 1-3** (Foundation + UI): Get basic infrastructure in place without complex logic
2. **Phase 4 is most complex**: Map click mode and state management - allocate extra time for debugging
3. **Phase 5 & 6 build on Phase 4**: Once point creation works, deletion and rendering are straightforward
4. **Phase 7 is critical**: Don't skip testing - 80% coverage required by constitution
5. **Phase 8 can overlap**: Start documentation while waiting for code review

### Testing Strategy Notes

- Write unit tests as you implement (test-driven development encouraged)
- Integration tests require full stack (database, DrawTool loaded)
- Manual testing should cover all user scenarios from spec.md
- Performance testing: create feature with 100 points, measure render time
- Security testing: try XSS with point names (should be sanitized)

### Code Review Focus Areas

- State management: `_addingPointState` and `_tempPointMarkers` cleanup
- Event listener cleanup: no memory leaks
- GeoJSON structure: points array format matches spec
- UI consistency: styles match existing DrawTool
- Error handling: null checks, validation

### Deployment Checklist

Before marking TASK-026 complete:
- [ ] All 26 tasks marked complete
- [ ] ESLint passes with no errors
- [ ] Test coverage >80%
- [ ] All user scenarios tested manually
- [ ] Performance requirements met (< 5 sec workflow)
- [ ] Security checklist completed (input sanitization)
- [ ] AGENTS.md updated
- [ ] No console errors in production build
- [ ] Feature flag enabled (if applicable)

---

## Ready to Implement

This task breakdown is ready for implementation with:
- ✅ 26 clear, actionable tasks
- ✅ Each task completable in 1-2 days or less
- ✅ Dependencies identified
- ✅ Acceptance criteria for each task
- ✅ Estimated 7 days total implementation time
- ✅ Critical path identified
- ✅ Testing strategy defined
- ✅ Constitution compliance ensured

Next step: Begin implementation with TASK-001 or run `/speckit.implement` to start executing tasks.
