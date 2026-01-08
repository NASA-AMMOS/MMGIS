# DrawTool Point Template Field - Technical Plan

**Spec Reference**: [spec.md](./spec.md)
**Status**: 📋 Draft
**Created**: 2026-01-05

## Technical Context

**Related Systems**:
- DrawTool template system (DrawTool_Templater.js)
- DrawTool feature rendering (DrawTool_Files.js)
- DrawTool Edit Panel (DrawTool_Editing.js)
- Leaflet.Draw library for map click handling
- MMGIS layer management system (Layers_.js)
- PostgreSQL with Sequelize ORM for feature persistence

**Dependencies**:
- Leaflet 1.x (already in use)
- Leaflet.Draw (already in use for drawing features)
- jQuery (already in use for UI)
- CursorInfo module (for user feedback)
- F_ utilities (for sanitization and helper functions)

**Technology Stack**:
- **Frontend**: JavaScript (ES6+), jQuery, SCSS
- **Mapping**: Leaflet.js with Leaflet.Draw plugin
- **State Management**: Module-level state objects
- **UI**: Custom DrawTool UI components
- **Data Storage**: PostgreSQL (via existing DrawTool API)

## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### Principle I: Documentation-First Development
**Compliance**: ✅
**Notes**: Spec.md created and approved before implementation. This plan.md documents technical approach before code. Tasks.md will break down implementation.

### Principle II: Clear Requirements
**Compliance**: ✅
**Notes**: Spec contains 12 functional requirements with measurable acceptance criteria. Success metrics defined (< 5 second workflow, 80% test coverage, no data loss).

### Principle III: Incremental Delivery
**Compliance**: ✅
**Notes**: Implementation divided into 6 phases that can be tested independently. Each phase adds functionality without breaking existing features. PR size will be kept reasonable by phasing.

### Principle IV: Quality Standards
**Compliance**: ✅
**Notes**:
- **Code Quality**: Will follow ESLint rules, 4-space indentation, single quotes
- **Testing**: Target 80% test coverage with unit tests for template system and integration tests for point workflow
- **Security**: Input validation on point names (sanitize with F_.sanitize), no new authentication endpoints
- **Code Review**: All changes will go through PR review process

### Principle V: Node.js and Web Mapping Best Practices
**Compliance**: ✅
**Notes**:
- Using async/await for database operations (already in DrawTool.addDrawing)
- Leaflet for 2D mapping (existing pattern)
- GeoJSON format for feature storage (existing pattern)
- Coordinates stored as [lng, lat] arrays (GeoJSON standard)
- Sequelize ORM for database persistence (existing pattern)
- Event-driven architecture with jQuery event handlers (existing pattern)

### Principle VI: Geospatial Data Integrity
**Compliance**: ✅
**Notes**:
- Coordinates captured from Leaflet map clicks (inherits map CRS)
- Stored as [lng, lat] arrays in GeoJSON properties
- No coordinate transformations needed (stored in map's native CRS)
- Validation: coordinates validated by Leaflet.Draw before capture
- Testing: Will include tests with known coordinates to verify storage/retrieval

### Principle VII: Real-time Collaboration Safety
**Compliance**: ✅
**Notes**:
- Points stored in feature properties, updated via existing DrawTool.updateFeature() API
- Follows existing "last write wins" pattern for feature edits
- No new WebSocket messages required (uses existing feature update mechanism)
- Input sanitization on point names using F_.sanitize()
- Future enhancement: WebSocket sync for real-time point updates across users

## Architecture & Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Configure UI                            │
│  (Template Designer - Add "point" field type)               │
└───────────────────┬─────────────────────────────────────────┘
                    │ saves template config
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  (Stores templates with point field configurations)         │
└───────────────────┬─────────────────────────────────────────┘
                    │ loads template
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    DrawTool Edit Panel                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ DrawTool_Templater.renderTemplate()                 │   │
│  │  - Renders "Add Pt" button                          │   │
│  │  - Renders point list (color, name, delete)         │   │
│  └──────────┬──────────────────────────────────────────┘   │
│             │ user clicks "Add Pt"                          │
│             ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ startAddingPoint()                                   │   │
│  │  - Creates L.Draw.CircleMarker                       │   │
│  │  - Enables map click mode                            │   │
│  │  - Shows CursorInfo                                  │   │
│  └──────────┬──────────────────────────────────────────┘   │
└─────────────┼──────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Leaflet Map                             │
│  (User clicks map to place point)                           │
└───────────────────┬─────────────────────────────────────────┘
                    │ draw:drawstop event
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 onPointPlaced(event)                         │
│  - Prompts for point name                                   │
│  - Generates unique point ID                                │
│  - Creates point object {id, name, color, coords}           │
│  - Adds to helperStates array                               │
│  - Renders temporary marker                                 │
│  - Re-renders point list                                    │
└───────────────────┬─────────────────────────────────────────┘
                    │ user clicks "Save Changes"
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              DrawTool.updateFeature()                        │
│  (Saves feature with points array in properties)            │
└───────────────────┬─────────────────────────────────────────┘
                    │ saves to database
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  (Feature properties contain point arrays)                  │
└───────────────────┬─────────────────────────────────────────┘
                    │ on page load/refresh
                    ▼
┌─────────────────────────────────────────────────────────────┐
│           DrawTool_Files.refreshFile()                       │
│  - Renders parent features                                  │
│  - Calls renderAssociatedPoints()                           │
│  - Creates L.circleMarker for each point                    │
│  - Stores in filesandFeatureLayers for cleanup              │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

**Component 1: Template Field Type Registration**
- **File**: `DrawTool_Templater.js`
- **Purpose**: Add "point" as a recognized template field type
- **Responsibilities**:
  - Register "point" in `_TEMPLATE_TYPES` array
  - Provide switch case handlers in renderTemplate, getValues, getTemplateDefaults
  - Render configuration UI in renderDesignTemplate (Configure page)
- **Interfaces**:
  - Input: Template definition object with "point" type fields
  - Output: Rendered UI elements (button, list) in Edit Panel
  - Output: Point arrays in feature properties

**Component 2: Edit Panel UI**
- **File**: `DrawTool_Templater.js` (renderTemplate function)
- **Purpose**: Render interactive UI for adding and managing points
- **Responsibilities**:
  - Render "Add Pt" button with icon
  - Render point list with color badges, names, delete buttons
  - Show empty state when no points exist
  - Attach event handlers to button and delete actions
- **Interfaces**:
  - Input: Template field configuration, existing points array from properties
  - Output: HTML markup injected into Edit Panel
  - Events: Click on "Add Pt" button, click on delete buttons

**Component 3: Map Click Mode Controller**
- **File**: `DrawTool_Templater.js` (new helper functions)
- **Purpose**: Manage state for point-adding mode
- **Responsibilities**:
  - Create and enable L.Draw.CircleMarker handler
  - Show visual feedback (button highlight, CursorInfo)
  - Prevent multiple simultaneous point-adding modes
  - Handle ESC key and mode cancellation
  - Listen for draw:drawstop event
- **Interfaces**:
  - Input: Field index, field name, template configuration
  - Output: Updated module-level `_addingPointState` object
  - Events: draw:drawstop, keydown (ESC), Edit Panel close

**Component 4: Point Creation Logic**
- **File**: `DrawTool_Templater.js` (onPointPlaced function)
- **Purpose**: Create point objects from map clicks
- **Responsibilities**:
  - Extract coordinates from Leaflet event
  - Prompt user for point name (with default suggestion)
  - Generate unique point ID (parent UUID + sequence)
  - Create point object with all required fields
  - Add to in-memory helperStates array
  - Render temporary marker on map
  - Update point list UI
- **Interfaces**:
  - Input: Leaflet draw:drawstop event, parent feature UUID
  - Output: Point object `{ id, name, color, coords }`
  - Side effects: Prompt dialog, DOM updates, map marker creation

**Component 5: Point Rendering System**
- **File**: `DrawTool_Files.js` (new renderAssociatedPoints function)
- **Purpose**: Render permanent point markers when features load
- **Responsibilities**:
  - Iterate through template point fields
  - Extract points arrays from feature properties
  - Create L.circleMarker for each point
  - Bind popup with point name
  - Add to layer management system for visibility control
  - Store in filesandFeatureLayers for cleanup
- **Interfaces**:
  - Input: Feature object, file ID, layer ID
  - Output: Leaflet circle markers added to map
  - Integration: Uses existing L_.layers.layer structure

**Component 6: Cleanup and Lifecycle Management**
- **File**: `DrawTool_Editing.js` (Edit Panel close handlers)
- **Purpose**: Clean up temporary state and markers
- **Responsibilities**:
  - Remove temporary point markers when Edit Panel closes
  - End point-adding mode when user switches features
  - Clear CursorInfo and button active states
  - Remove event listeners
- **Interfaces**:
  - Input: Edit Panel close event, showContextMenu event
  - Output: Clean module-level state
  - Side effects: Remove DOM elements, map markers, event listeners

### Data Flow

```
[User Action] → [UI Component] → [State Update] → [Persistence] → [Rendering]

1. Template Creation Flow:
   Configure UI → Add "point" field → Save template → PostgreSQL

2. Point Addition Flow:
   Click "Add Pt" → Enable L.Draw → Click map → Prompt name →
   Create point object → Add to helperStates → Render temp marker →
   Update point list UI

3. Point Deletion Flow:
   Click delete button → Remove from helperStates → Remove temp marker →
   Re-render point list

4. Save Feature Flow:
   Click "Save Changes" → getValues() extracts helperStates →
   DrawTool.updateFeature(properties) → PostgreSQL update

5. Load Feature Flow:
   Page load → DrawTool_Files.refreshFile() →
   Render parent feature → renderAssociatedPoints() →
   Create permanent markers → Add to layer system

6. Layer Toggle Flow:
   Toggle file off → Remove all layers in filesandFeatureLayers →
   Points disappear with parent feature
```

### Database Changes

**Schema Changes**:
- **No new tables or columns required**
- Points stored in existing `features.properties` JSONB column
- Uses existing DrawTool feature storage mechanism

**Data Structure** (within features.properties):
```json
{
  "name": "Feature Name",
  "uuid": "abc-123",
  "style": { ... },
  "_": { "id": 456, "file_id": 789 },

  "samplePoints": [
    {
      "id": "abc-123-1",
      "name": "Point A",
      "color": "rgb(255,0,0)",
      "coords": [-118.123, 34.567]
    }
  ]
}
```

**Migration Strategy**:
- No migration needed (new field type, backward compatible)
- Existing features without point fields continue to work
- New point fields only added to features using templates with "point" type
- If template removed, points remain in properties but are not rendered/editable

## API Contracts

**No new API endpoints required**. Uses existing DrawTool endpoints:

### Existing Endpoint: `POST /api/draw/update`

**Request**:
```json
{
  "file_id": 123,
  "id": 456,
  "properties": {
    "name": "Feature Name",
    "samplePoints": [
      {
        "id": "abc-123-1",
        "name": "Point A",
        "color": "rgb(255,0,0)",
        "coords": [-118.123, 34.567]
      }
    ]
  },
  "geometry": { ... }
}
```

**Response (200)**:
```json
{
  "status": "success",
  "message": "Updated!"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid feature ID or properties
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

**Template Storage** (existing `/api/files/settemplate` endpoint):
```json
{
  "file_id": 123,
  "template": {
    "name": "Traverse Template",
    "template": [
      {
        "type": "point",
        "field": "samplePoints",
        "default": [],
        "defaultColor": "#ff0000",
        "maxPoints": 0
      }
    ]
  }
}
```

## Technical Decisions

### Decision 1: Store Points in Feature Properties vs. Separate DrawTool Features

**Context**: Points need to be associated with parent features. Two approaches:
1. Store as separate DrawTool features with parent reference
2. Store in parent feature's properties as array

**Options Considered**:
1. **Separate Features**
   - Pros: Cleaner separation, easier to query individually, can have independent permissions
   - Cons: Complex parent-child relationship, harder to ensure referential integrity, more database rows, harder to delete parent with children

2. **Embedded in Properties** (CHOSEN)
   - Pros: Tight coupling (delete parent → delete points automatically), simpler data model, single save operation, matches user mental model
   - Cons: Cannot query points independently, properties JSONB could grow large with many points

**Decision**: Embed points in parent feature properties as array
**Rationale**:
- Points are metadata annotations, not independent features
- Tighter coupling matches user expectation (deleting feature should delete points)
- Simpler implementation (no foreign keys, no cascading deletes)
- Performance: single database read/write for feature + all points
- Spec explicitly states "not as separate DrawTool features"

**Consequences**:
- Cannot query "all points across all features" without scanning all features
- Properties JSONB size could grow (mitigated by max points limit)
- Undo/redo more complex (entire feature must be versioned)

### Decision 2: Temporary Markers During Editing vs. Direct Layer Addition

**Context**: When points are added in Edit Panel, should we:
1. Add temporary markers that get cleaned up
2. Add directly to permanent layer

**Options Considered**:
1. **Temporary Markers** (CHOSEN)
   - Pros: Clear separation between "editing" and "saved" state, easier cleanup, matches existing DrawTool pattern
   - Cons: Need to manage two marker sets (temp + permanent)

2. **Direct Layer Addition**
   - Pros: Simpler code, single marker set
   - Cons: Harder to handle cancel/close without save, harder to differentiate unsaved changes

**Decision**: Use temporary markers stored in `_tempPointMarkers` during editing
**Rationale**:
- Matches existing DrawTool pattern (drawing creates temp feature, saving makes it permanent)
- Clear visual distinction possible (could style temp markers differently)
- Easier to implement cancel behavior (just clear temp markers)
- Avoids race conditions with refreshFile() rendering

**Consequences**:
- Need cleanup logic when Edit Panel closes
- Slight code complexity managing two marker sets
- Temporary markers not visible to other users in real-time (future enhancement)

### Decision 3: Browser Prompt for Point Name vs. Inline Input

**Context**: How should user enter point name?

**Options Considered**:
1. **Browser `prompt()` Dialog** (CHOSEN)
   - Pros: Simple, built-in, blocks until user responds, familiar UX
   - Cons: Not customizable, looks dated, blocks UI

2. **Inline Input Field**
   - Pros: Modern UX, customizable, non-blocking
   - Cons: More complex (need to manage input state, position, focus), requires additional UI code

3. **Modal Dialog**
   - Pros: Customizable, better UX than prompt
   - Cons: Requires modal component, more code

**Decision**: Use browser `prompt()` for v1
**Rationale**:
- Simplest implementation (single line of code)
- Matches existing DrawTool patterns (annotations use prompts)
- Non-blocking point-adding mode (mode stays active after prompt)
- Can be enhanced to modal in v2 if user feedback demands

**Consequences**:
- Less modern UX (acceptable for mission tools prioritizing function over form)
- Browser-specific prompt styling (uncontrollable)
- Cancel behavior requires handling `null` return value

### Decision 4: helperStates Array vs. Direct DOM Manipulation

**Context**: How to track points during editing session?

**Options Considered**:
1. **helperStates Array** (CHOSEN)
   - Pros: Single source of truth, matches existing dropdown pattern, easy to validate before save
   - Cons: Need to keep DOM in sync with array

2. **Direct DOM Manipulation**
   - Pros: Simpler (no state management)
   - Cons: Harder to extract values on save, no validation before render, error-prone

**Decision**: Use `helperStates[fieldIdx]` array as source of truth
**Rationale**:
- Matches existing template field pattern (dropdown uses helperStates)
- Easy to implement getValues() (just return helperStates[idx])
- Enables validation before save
- Clear data flow: array → render → DOM

**Consequences**:
- Must re-render point list on every change (splice, push)
- DOM elements need `data-point-idx` attributes for delete handlers

## Implementation Notes

### Code Quality
- Follow ESLint rules (no errors, warnings addressed)
- 4-space indentation, single quotes
- Function names: camelCase (startAddingPoint, onPointPlaced, renderPointList)
- Comment complex logic (especially point ID generation, state cleanup)
- Keep functions small (< 50 lines preferred)
- Use `const` for immutable, `let` for reassignable (no `var`)

### Testing Strategy

**Unit Tests**:
- `DrawTool_Templater.renderTemplate()` for "point" type (verify button, list rendered)
- `DrawTool_Templater.getValues()` for "point" type (verify array extraction)
- `DrawTool_Templater.getTemplateDefaults()` for "point" type (verify empty array)
- Point ID generation logic (verify format, uniqueness)
- Point list rendering (verify HTML structure with mocked data)
- Delete point logic (verify splice, re-render called)
- Mode cancellation (verify state cleaned up)

**Integration Tests**:
- Full workflow: Add point template → Create feature → Add point → Save → Reload → Verify point visible
- Delete workflow: Add points → Delete one → Save → Reload → Verify deleted point gone
- Mode cancellation: Start adding → Press ESC → Verify mode ended
- Edit Panel close: Start adding → Close panel → Verify cleanup
- Multiple point fields: Create template with 2 point fields → Verify independent management

**E2E Tests** (Manual for v1, automated later):
- Configure UI: Add "point" field type → Verify saved in template
- Point placement: Click map → Enter name → Verify marker and list updated
- Point deletion: Click delete → Verify marker removed
- Feature save: Add points → Save → Verify persisted
- Layer toggle: Toggle file off/on → Verify points disappear/reappear

**Target Coverage**: 80% minimum

### Security Considerations

**Input Validation**:
- Point names sanitized with `F_.sanitize()` before rendering
- Coordinates validated by Leaflet.Draw (always within map bounds)
- Max points limit enforced client-side (disable button when limit reached)
- Template configuration validated on save (server-side)

**XSS Prevention**:
- Use `F_.sanitize()` for all user-provided names in point list and popups
- No `innerHTML` with unsanitized data
- jQuery `.text()` for text content (auto-escapes)

**No New Attack Surface**:
- No new API endpoints
- Uses existing authentication/authorization (DrawTool features require login)
- No WebSocket messages (uses existing HTTP endpoints)

**Data Validation**:
- Point ID format validated (must match `{uuid}-{number}`)
- Color format validated (must be valid CSS color)
- Coordinates validated (must be [lng, lat] array with numbers)

### Performance Considerations

**Point Rendering Optimization**:
- Render points only when parent feature is visible
- Use L.circleMarker (faster than L.marker for large counts)
- Store markers in filesandFeatureLayers for efficient removal
- Batch point marker creation (single refreshFile() call)

**Memory Management**:
- Clean up temporary markers on Edit Panel close
- Remove event listeners on mode exit
- Clear helperStates on panel close
- Leverage existing layer cleanup in DrawTool_Files

**Target Performance**:
- <100ms to render 50 points on feature load
- <50ms to add single point to list (click → marker visible)
- <20ms to delete single point from list
- No visible lag with 100 points per feature (NFR-001)

**Optimization Techniques**:
- Debounce point list re-rendering if needed (unlikely with delete-only)
- Use document fragments for batch DOM updates if needed
- Cache parent feature UUID to avoid repeated lookups

## Rollout Plan

### Phase 1: Template Type Registration (Day 1)
**What gets deployed**:
- Add "point" to `_TEMPLATE_TYPES` array
- Basic renderTemplate() switch case (just renders "TODO: point field")
- Basic getValues(), getTemplateDefaults() handlers (return empty array)

**Success criteria**:
- ESLint passes
- Template with "point" field can be created without errors
- Edit Panel opens for feature with point field (even if non-functional)

**Risk**: Low (minimal changes, no complex logic)

### Phase 2: Edit Panel UI (Day 2)
**What gets deployed**:
- Full renderTemplate() markup (button, list, empty state)
- renderPointList() helper function
- Point list HTML/CSS styling
- No functionality yet (button does nothing)

**Success criteria**:
- "Add Pt" button renders correctly
- Point list shows empty state
- CSS matches DrawTool style
- No console errors

**Risk**: Low (pure UI, no business logic)

### Phase 3: Template Designer Config (Day 2)
**What gets deployed**:
- renderDesignTemplate() switch case for "point" type
- Configuration UI (color picker, max points input)
- Save/load config values in getValues()

**Success criteria**:
- Configure UI shows "point" field option
- Can set default color and max points
- Config saved in template definition
- Config loaded when editing template

**Risk**: Low (existing template designer pattern)

### Phase 4: Map Click Mode & Point Creation (Day 3-4)
**What gets deployed**:
- startAddingPoint() function
- onPointPlaced() function
- endAddingPoint() function
- renderPointMarker() / removePointMarker() helpers
- Event listeners (button click, ESC key, draw:drawstop)
- CursorInfo integration
- Point ID generation

**Success criteria**:
- Clicking "Add Pt" enables map click mode
- Visual feedback (button highlight, cursor info)
- Clicking map creates point object
- Point added to helperStates array
- Temporary marker appears on map
- Point list updates with new point
- Can add multiple points
- ESC cancels mode

**Risk**: Medium (complex state management, event coordination)

### Phase 5: Point Deletion & Persistence (Day 4)
**What gets deployed**:
- deletePoint() function
- Delete button event handlers
- Integration with getValues() for save
- Cleanup handlers in Edit Panel close

**Success criteria**:
- Clicking delete removes point from list and map
- Clicking "Save Changes" persists points to database
- Closing Edit Panel cleans up temporary markers
- Switching features cancels point-adding mode

**Risk**: Medium (cleanup logic must be thorough)

### Phase 6: Permanent Rendering (Day 5)
**What gets deployed**:
- renderAssociatedPoints() function in DrawTool_Files.js
- Integration with refreshFile()
- Popup bindings for point markers
- Layer visibility integration

**Success criteria**:
- Page reload shows saved points
- Points render with correct color/name
- Points have popups with name + parent feature name
- Toggling file off/on hides/shows points
- Deleting parent feature removes points

**Risk**: Low (follows existing layer rendering pattern)

## Risks & Mitigations

**Risk 1**: L.Draw.CircleMarker conflicts with existing DrawTool drawing mode
- **Impact**: High (could break existing point drawing)
- **Likelihood**: Medium
- **Mitigation**:
  - Only create L.Draw.CircleMarker when "Add Pt" clicked
  - Check for existing drawing mode before enabling
  - Disable other DrawTool buttons during point-adding mode
  - Test thoroughly with different drawing modes active

**Risk 2**: Memory leaks from uncleaned event listeners or markers
- **Impact**: Medium (performance degradation over time)
- **Likelihood**: Medium
- **Mitigation**:
  - Comprehensive cleanup in endAddingPoint()
  - Cleanup on Edit Panel close event
  - Use jQuery `.off()` with namespaced events
  - Test with repeated open/close cycles
  - Monitor browser memory during testing

**Risk 3**: Point IDs not unique (race condition or sequence error)
- **Impact**: High (data corruption, points could overwrite each other)
- **Likelihood**: Low
- **Mitigation**:
  - Generate IDs synchronously (no async gaps)
  - Use parent UUID (already unique) + sequence
  - Validate ID format before save
  - Unit test ID generation with multiple points
  - Test concurrent point addition (same feature, multiple rapid clicks)

**Risk 4**: Large point arrays (100+) cause performance issues
- **Impact**: Medium (slow rendering, laggy UI)
- **Likelihood**: Low (max points limit mitigates)
- **Mitigation**:
  - Enforce max points limit (disable button when reached)
  - Performance test with 100+ points
  - Use efficient rendering (circle markers, no complex symbols)
  - Profile with Chrome DevTools
  - Consider pagination/virtualization if needed (future)

**Risk 5**: Coordinate precision loss during JSON serialization
- **Impact**: Medium (slight position inaccuracy)
- **Likelihood**: Low (JavaScript numbers are IEEE 754 doubles, sufficient precision)
- **Mitigation**:
  - Store coordinates as-is from Leaflet (no rounding)
  - Test with high-precision coordinates
  - Document precision limits if discovered
  - Use PostgreSQL NUMERIC if precision issues found (future)

**Risk 6**: User closes browser during point-adding mode (temporary markers lost)
- **Impact**: Low (annoyance, not data loss)
- **Likelihood**: Medium
- **Mitigation**:
  - Expected behavior (user hasn't saved yet)
  - Clear in UX (must click "Save Changes")
  - Consider localStorage autosave (future enhancement)
  - Document in user guide

## Open Technical Questions

1. **Styling**: Should temporary markers have different styling than permanent markers?
   - **Recommendation**: Use same styling for v1 (simpler). Can differentiate in v2 if user feedback requests.

2. **Max Points Enforcement**: Should server validate max points limit?
   - **Recommendation**: Client-side only for v1 (sufficient for mission use). Add server validation if abuse detected.

3. **Point Coordinates Precision**: How many decimal places to display in popups?
   - **Recommendation**: Use 6 decimal places (standard for Leaflet, ~0.1m accuracy). Test with mission data.

4. **WebSocket Integration**: Should point additions broadcast to other users in real-time?
   - **Recommendation**: No for v1 (spec says "last write wins"). Add in v2 as enhancement to existing DrawTool collaboration.

5. **Undo/Redo**: Should point addition/deletion support undo/redo?
   - **Recommendation**: No for v1 (explicitly out of scope in spec). User can cancel without saving or delete points individually.

6. **Color Picker UI**: Use native `<input type="color">` or custom color picker?
   - **Recommendation**: Native for v1 (simpler, works everywhere). Matches existing DrawTool style pickers.

---

## Implementation Readiness

This plan is ready for task breakdown (`/speckit.tasks`) with:
- ✅ Clear architecture and component responsibilities
- ✅ Constitution compliance verified for all 7 principles
- ✅ Technical decisions documented with rationale
- ✅ Risks identified with mitigations
- ✅ Phased rollout strategy (6 phases, 5 days estimated)
- ✅ Testing strategy defined (unit, integration, E2E)
- ✅ Performance and security considerations addressed
- ✅ No new API endpoints or database migrations required

**Estimated Implementation Time**: 5 days (one developer)
**Testing Time**: 2 days (manual + automated)
**Total**: 7 days (1.5 weeks)
