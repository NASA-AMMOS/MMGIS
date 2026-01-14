# Plugin-Components System - Technical Plan

**Spec Reference**: [specs/011-plugin-components-system/spec.md](./spec.md)
**Status**: 📋 Draft
**Created**: 2026-01-14
**Issue**: #849

## Technical Context

**Related Systems**:
- Plugin-Tools system (`API/updateTools.js`, `src/pre/tools.js`, `src/essence/Tools/`)
- Plugin-Backend system (`API/Backend/Plugins/`)
- Configure page React application (`configure/src/`)
- MMGIS frontend initialization (`src/essence/essence.js`)

**Dependencies**:
- **Node.js** 20+ (for build system)
- **React** 18 (for Configure page)
- **Redux** (for Configure page state management)
- **Material-UI** (for Configure page components)
- **Webpack** 5 (for build process)
- **Express** 4.18 (for serving generated config files)

**Technology Stack**:
- **Build**: Node.js file system APIs, JSON parsing
- **Frontend**: Vanilla JavaScript (ES6+), jQuery for legacy compatibility
- **Configure Page**: React 18, Redux Toolkit, Material-UI v5
- **Generated Files**: JSON config files, ES6 module exports

## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### Principle I: Documentation-First Development
**Compliance**: ✅ **Pass**
**Notes**: This plan follows documentation-first approach with spec.md created before implementation. All requirements documented with clear acceptance criteria.

### Principle II: Clear Requirements
**Compliance**: ✅ **Pass**
**Notes**: Spec.md includes 6 functional requirements with measurable acceptance criteria. Non-functional requirements specify metrics (< 500ms build time, 100% error isolation). User scenarios have clear personas and workflows.

### Principle III: Incremental Delivery
**Compliance**: ✅ **Pass**
**Notes**: Implementation broken into 7 phases that can be tested independently:
1. Build system (can test component discovery)
2. Component loading system (can test in isolation)
3. Frontend integration (can test initialization)
4. Configure page UI (can test separately)
5. Tab integration (can test conditionally)
6. Documentation (can review independently)
7. Example component (can test as standalone)

Each phase deliverable in 1-2 days. No database changes required, reducing rollback risk.

### Principle IV: Quality Standards
**Compliance**: ✅ **Pass**
**Notes**:
- **Code Quality**: Will follow existing ESLint config, 4-space indentation, single quotes
- **Testing**: Unit tests for build system, integration tests for component initialization, E2E tests for Configure page. Target 80%+ coverage.
- **Security**: No authentication/authorization changes. Component `init()` runs in user context with existing permissions. Input validation on component configs during build.
- **Code Review**: Standard PR process with constitution compliance check

### Principle V: Node.js and Web Mapping Best Practices
**Compliance**: ✅ **Pass**
**Notes**:
- **Node.js**: Uses async/await patterns (not needed for sync file operations), proper error handling with try/catch
- **Frontend**: ES6 modules, event-driven component lifecycle
- **No Database Changes**: Plugin-Components purely client-side, no Sequelize models needed
- **Configuration**: Component configs stored in mission JSON (existing pattern)

### Principle VI: Geospatial Data Integrity
**Compliance**: ✅ **Pass** (Not Applicable)
**Notes**: Plugin-Components system does not handle geospatial data directly. Components may use geospatial features but are responsible for their own data integrity. Documentation will note that components using Map_ or L_ should follow geospatial best practices.

### Principle VII: Real-time Collaboration Safety
**Compliance**: ✅ **Pass** (Not Applicable)
**Notes**: Plugin-Components system does not introduce new WebSocket functionality. Components may use existing WebSocket connections but must follow existing collaboration safety patterns. Documentation will note this constraint.

**Overall**: ✅ **All applicable principles satisfied**

## Architecture & Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Build Time (npm run build)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  src/essence/                                               │
│  ├── *Private-Components*/                                 │
│  │   └── MyComponent/                                      │
│  │       ├── config.json ─────┐                            │
│  │       └── MyComponent.js   │                            │
│  └── *Plugin-Components*/     │                            │
│      └── OtherComponent/      │                            │
│          ├── config.json ─────┤                            │
│          └── OtherComponent.js│                            │
│                                │                            │
│                                ▼                            │
│                      API/updateTools.js                     │
│                      + updateComponents()                   │
│                                │                            │
│                    ┌───────────┴───────────┐               │
│                    ▼                       ▼               │
│   configure/public/                src/pre/               │
│   componentConfigs.json            components.js           │
│   (JSON metadata)                  (ES6 imports)           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Runtime (Configure Page)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /getComponentConfig                                    │
│      └──> componentConfigs.json                            │
│                    │                                        │
│                    ▼                                        │
│        Components Tab (React)                              │
│        ├── Component Cards (grid)                          │
│        └── Component Modal                                 │
│            ├── ON/OFF toggle                               │
│            ├── Icon field (optional)                       │
│            └── Config form (Maker)                         │
│                    │                                        │
│                    ▼                                        │
│        Save to configuration.components[]                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Runtime (MMGIS Frontend)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  essence.js initialization                                 │
│      │                                                      │
│      ├──> init() - Initialize core                         │
│      ├──> makeMission() - Load mission config              │
│      ├──> fina() - Finalize UI                            │
│      │                                                      │
│      └──> ComponentController.initializeComponents()       │
│                    │                                        │
│                    ├─ Read configuration.components[]      │
│                    ├─ Filter enabled (on: true)            │
│                    └─ For each component:                  │
│                        import from pre/components.js       │
│                        call component.init(vars)           │
│                        (errors caught & logged)            │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

**Component 1: Build System Extension (API/updateTools.js)**
- **Purpose**: Discover component plugins and generate configuration files
- **Responsibilities**:
  - Scan `/src/essence/` for `*Private-Components*` or `*Plugin-Components*` directories
  - Read `config.json` from each component subdirectory
  - Validate JSON structure (log warnings for invalid configs)
  - Generate `configure/public/componentConfigs.json` with all metadata
  - Generate `src/pre/components.js` with ES6 imports and exports
  - Handle errors gracefully without breaking build
- **Interfaces**:
  - Input: File system (component directories and config.json files)
  - Output: `componentConfigs.json` (JSON), `components.js` (ES6 module)
  - Called by: `updateTools()` main export (parallel to tool updates)

**Component 2: Component Controller (src/essence/Basics/ComponentController_/ComponentController_.js)**
- **Purpose**: Initialize enabled components after UI finalization
- **Responsibilities**:
  - Import component modules from `src/pre/components.js`
  - Read mission configuration from global state
  - Filter components where `on: true`
  - Call each component's `init(vars)` method in sequence
  - Catch and log errors without propagating to other components
  - Provide clear error messages for debugging
- **Interfaces**:
  - Input: Mission configuration object, component modules
  - Output: Initialized components (side effects only)
  - Called by: `essence.js` after `fina()`
  - Exports: `initializeComponents()` function

**Component 3: Components Tab (configure/src/components/Tabs/Components/Components.js)**
- **Purpose**: UI for viewing and managing component plugins
- **Responsibilities**:
  - Fetch component configuration from `/getComponentConfig` API
  - Render grid of component cards (similar to Tools tab)
  - Display component status (ON/OFF indicator)
  - Handle card clicks to open ComponentModal
  - Include "Custom Components" info card explaining plugin system
- **Interfaces**:
  - Props: None (uses Redux state)
  - Redux State: `core.componentConfiguration`, `core.configuration.components`
  - Events: Card click → dispatch `setModal({ name: 'component', ... })`

**Component 4: Component Modal (configure/src/components/Tabs/Components/Modals/ComponentModal/ComponentModal.js)**
- **Purpose**: Configure individual component settings
- **Responsibilities**:
  - Display component name and description
  - ON/OFF toggle switch
  - Icon name text field (optional, default used if empty)
  - Dynamic configuration form generated from `config.json` using Maker component
  - Save button → update `configuration.components[]` array
  - Cancel button → discard changes
- **Interfaces**:
  - Props: `componentName`, `componentConfig` (from modal state)
  - Redux Actions: Update `configuration.components[index]`
  - Uses: Maker component for dynamic form rendering

**Component 5: Components Redux Slice (configure/src/components/Tabs/Components/ComponentsSlice.js)**
- **Purpose**: State management for Components tab (optional, may not be needed if using core state)
- **Responsibilities**:
  - Store component-specific UI state if needed
  - May be minimal or empty if core.componentConfiguration is sufficient
- **Interfaces**:
  - State: Component-specific UI state
  - Actions: Component-specific actions (if needed)

**Component 6: API Endpoint (API/Backend/APIs/routes.js)**
- **Purpose**: Serve component configuration to Configure page
- **Responsibilities**:
  - Add `GET /getComponentConfig` endpoint
  - Read and return `configure/public/componentConfigs.json`
  - Handle file not found (return empty object)
- **Interfaces**:
  - Request: `GET /getComponentConfig`
  - Response: `{ componentName: { config } }` or `{}`

### Data Flow

**Build-Time Flow**:
```
1. Developer creates component directory: src/essence/My-Plugin-Components/Analytics/
2. Developer adds config.json and Analytics.js
3. Developer runs: npm run build
4. updateComponents() scans essence/ for *Components* patterns
5. updateComponents() reads config.json files
6. updateComponents() generates:
   - configure/public/componentConfigs.json
   - src/pre/components.js
7. Build completes successfully
```

**Configuration Flow**:
```
1. User opens Configure page
2. Components tab fetches componentConfigs.json via /getComponentConfig
3. User clicks component card
4. ComponentModal opens with component metadata
5. User toggles ON, enters icon name, configures variables
6. User clicks Save
7. Redux action updates configuration.components[]
8. API call saves mission configuration to database
9. Success snackbar displayed
```

**Runtime Initialization Flow**:
```
1. User loads MMGIS frontend
2. essence.js initializes:
   - init() - Core initialization
   - makeMission() - Load mission config
   - fina() - Finalize UI
3. ComponentController.initializeComponents() called:
   - Reads L_.mission.components (from config)
   - Filters enabled components (on: true)
   - For each component:
     a. Import module from pre/components.js
     b. Call component.init(component.variables)
     c. Catch errors, log to console
     d. Continue to next component
4. All components initialized, MMGIS ready
```

### Database Changes

**Schema Changes**: None required

**Rationale**: Component configuration stored in existing mission configuration JSON structure. The `configuration` column in the `missions` table already stores JSON data including `tools`, `layers`, etc. We add `components` at the same level.

**Mission Configuration Structure**:
```json
{
  "configuration": {
    "tools": [ /* existing tools */ ],
    "components": [
      {
        "on": true,
        "name": "Analytics",
        "icon": "chart-line",
        "js": "Analytics",
        "variables": {
          "trackingId": "UA-12345-67",
          "enablePageViews": true
        }
      }
    ],
    "layers": [ /* existing layers */ ]
  }
}
```

**Migration Strategy**: Not applicable - this is additive. Existing missions without `components` array will continue to work (ComponentController treats missing array as empty).

## API Contracts

### Endpoint 1: `GET /getComponentConfig`

**Purpose**: Fetch component metadata for Configure page

**Request**:
```
GET /getComponentConfig
```

**Response (200)**:
```json
{
  "Analytics": {
    "name": "Analytics",
    "description": "Track user interactions",
    "defaultIcon": "chart-line",
    "hasVars": true,
    "config": {
      "rows": [
        {
          "name": "Settings",
          "components": [
            {
              "field": "variables.trackingId",
              "name": "Tracking ID",
              "type": "text",
              "width": 12
            }
          ]
        }
      ]
    },
    "paths": {
      "Analytics": "essence/My-Plugin-Components/Analytics/Analytics"
    }
  }
}
```

**Response (200) - No Components**:
```json
{}
```

**Error Responses**:
- `500 Internal Server Error`: Failed to read componentConfigs.json (should be rare, treated as empty components)

**Implementation Notes**:
- Reuse existing pattern from `GET /getToolConfig`
- Read from `configure/public/componentConfigs.json`
- No authentication required (same as getToolConfig)
- Return empty object if file not found (components optional)

### Generated Files

**File 1: `configure/public/componentConfigs.json`**

**Purpose**: Component metadata for Configure page UI generation

**Format**:
```json
{
  "ComponentName": {
    "name": "ComponentName",
    "description": "Component description",
    "descriptionFull": {
      "title": "Longer description",
      "example": {}
    },
    "defaultIcon": "icon-name",
    "hasVars": true,
    "paths": {
      "ComponentName": "essence/Path/To/Component"
    },
    "config": {
      "rows": [/* configuration schema */]
    }
  }
}
```

**File 2: `src/pre/components.js`**

**Purpose**: ES6 module with component imports for frontend

**Format**:
```javascript
import Analytics from '../essence/My-Plugin-Components/Analytics/Analytics'
import KeyboardShortcuts from '../essence/MMGIS-Private-Components/KeyboardShortcuts/KeyboardShortcuts'

export const componentConfigs = {"Analytics":{...},"KeyboardShortcuts":{...}}
export const componentModules = {Analytics, KeyboardShortcuts}
```

## Technical Decisions

### Decision 1: Reuse updateTools.js vs New File

**Context**: Need build-time component discovery similar to tools

**Options Considered**:
1. **Extend updateTools.js** - Add `updateComponents()` function to existing file
   - Pros: Keeps all plugin discovery in one place, reuses logger
   - Cons: File becomes larger, mixes tool and component concerns
2. **Create updateComponents.js** - Separate file for component discovery
   - Pros: Separation of concerns, cleaner architecture
   - Cons: Code duplication, two files to maintain

**Decision**: Extend updateTools.js with `updateComponents()` function

**Rationale**:
- Plugin discovery logic is nearly identical (scan directories, read config.json, generate files)
- Sharing logger and utility functions reduces duplication
- File size manageable (current 217 lines, adding ~150 lines = ~370 total)
- Consistent with existing pattern (updateTools.js already handles both standard and plugin tools)
- Easier to ensure both systems stay in sync

**Consequences**:
- updateTools.js will export `{ updateTools, updateComponents }`
- scripts/build.js will call both functions
- Future plugin systems can be added to same file if pattern continues

### Decision 2: Component Lifecycle - init() Only

**Context**: Components need initialization but spec says no destroy()

**Options Considered**:
1. **init() only** - Single lifecycle method
   - Pros: Simple, matches spec requirements, reduces complexity
   - Cons: No built-in cleanup mechanism
2. **init() + destroy()** - Full lifecycle like tools
   - Pros: Proper cleanup, matches tool pattern
   - Cons: More complex, may not be needed for one-time initialization

**Decision**: init() only

**Rationale**:
- Spec explicitly states components have only `init()` method
- Components are for one-time initialization, not activate/deactivate UI
- If cleanup needed, component can register its own page unload handlers
- Simpler mental model: "components run once at startup"
- Tools have full lifecycle because they're interactive (make/destroy when toggled)

**Consequences**:
- Components responsible for their own cleanup if needed
- Documentation will note cleanup best practices
- Cannot "restart" components without page reload
- Lighter-weight than tools (appropriate for background enhancements)

### Decision 3: Components Tab Visibility

**Context**: Should Components tab always be visible or conditional?

**Options Considered**:
1. **Always visible** - Show tab even when no components exist
   - Pros: Consistent UI, users know feature exists
   - Cons: Empty state for most users, clutters interface
2. **Conditional visibility** - Hide tab when componentConfigs is empty
   - Pros: Clean UI for users without components, matches spec
   - Cons: Slight complexity in tab rendering logic

**Decision**: Conditional visibility (hidden when no components)

**Rationale**:
- Spec explicitly requires: "Components tab is hidden when no components are installed"
- Most MMGIS instances won't use components (similar to plugin tools)
- Keeps Configure page focused on relevant features
- Pattern already used for STAC/TiTiler tabs (conditional based on env vars)

**Consequences**:
- Tab rendering logic checks `Object.keys(componentConfigs).length > 0`
- Tab index shifts dynamically based on visibility
- Documentation will explain how to make tab appear (add components + build)

### Decision 4: Error Handling Strategy

**Context**: How to handle component init() errors?

**Options Considered**:
1. **Fail fast** - Stop initialization if any component errors
   - Pros: Forces developers to fix issues
   - Cons: One bad component breaks entire page
2. **Catch and log** - Log errors but continue initializing other components
   - Pros: Graceful degradation, better user experience
   - Cons: Errors may go unnoticed in production

**Decision**: Catch and log with clear error messages

**Rationale**:
- Spec requires: "Component init() errors are caught, logged, and don't prevent other components from initializing"
- Better user experience (one bad component doesn't break MMGIS)
- Matches NFR-003: "Component initialization errors don't break MMGIS"
- Errors logged to console for debugging (developers can see them)
- Production monitoring can catch console errors if needed

**Consequences**:
- ComponentController wraps each init() call in try/catch
- Error format: `[ComponentController] Error initializing component "Analytics": <error message>`
- Component developers must test their code thoroughly (errors are silently caught)
- Documentation will emphasize importance of testing component init()

### Decision 5: Component Config Storage Location

**Context**: Where to store component configuration in mission config?

**Options Considered**:
1. **Top-level components[]** - Same level as configuration object
   - Pros: Flat structure
   - Cons: Inconsistent with tools (which are in configuration.tools)
2. **configuration.components[]** - Same level as tools
   - Pros: Consistent with tools, grouped with other config
   - Cons: None

**Decision**: configuration.components[] (same level as tools)

**Rationale**:
- User feedback: "components can just sit at the same level as tools"
- Consistent data model (all configurable features in configuration object)
- Easier to export/import mission configs (everything in one place)
- Matches mental model: components are configurable like tools

**Consequences**:
- ComponentController reads from `L_.mission.components` (where L_.mission = configuration)
- Configure page updates `configuration.components[]` array
- Migration not needed (missing array treated as empty)

## Implementation Notes

### Code Quality

**ESLint**:
- Must pass `npm run lint` with no errors
- Follow existing .eslintrc.js configuration
- 4-space indentation, single quotes
- No unused variables or imports

**Code Style**:
- Function naming: camelCase (e.g., `initializeComponents()`)
- File naming: PascalCase for modules (e.g., `ComponentController_.js`)
- Comments: JSDoc for public functions
- Keep functions small (< 50 lines preferred)
- Extract constants for magic strings

**File Structure**:
```
src/essence/Basics/ComponentController_/
  ├── ComponentController_.js    # Main controller
  └── ComponentController_.test.js  # Unit tests

configure/src/components/Tabs/Components/
  ├── Components.js              # Tab component
  ├── ComponentsSlice.js         # Redux slice (if needed)
  └── Modals/
      └── ComponentModal/
          ├── ComponentModal.js  # Modal component
          └── ComponentModal.test.js  # Tests
```

### Testing Strategy

**Unit Tests**:
- `API/updateTools.test.js`: Test `updateComponents()` function
  - Test component directory discovery
  - Test config.json parsing
  - Test error handling for invalid JSON
  - Test file generation (componentConfigs.json, components.js)
  - Test empty components case
  - Mock file system with jest mocks
- `ComponentController_.test.js`: Test component initialization
  - Test reading mission configuration
  - Test filtering enabled components
  - Test calling component init() methods
  - Test error handling (component throws error)
  - Test empty components array
  - Mock component modules

**Integration Tests**:
- `essence.js` integration: Test ComponentController called after fina()
- Configure page API: Test /getComponentConfig endpoint
  - Test successful response
  - Test missing componentConfigs.json
  - Test empty components

**E2E Tests** (Playwright):
- Configure page: Test Components tab visibility
  - Create test component, verify tab appears
  - Remove component, verify tab hidden
- Configure page: Test component modal
  - Click component card, verify modal opens
  - Toggle ON/OFF, verify state changes
  - Configure variables, save, verify persistence
- Frontend: Test component initialization
  - Enable test component, reload page
  - Verify component init() called (check console log)
  - Verify component receives correct variables

**Target Coverage**: 80% minimum
- Build system: 85%+ (comprehensive error handling)
- ComponentController: 90%+ (critical initialization logic)
- Configure page: 75%+ (UI components harder to test)

**Test Commands**:
```bash
# Run all tests
npm test

# Run specific test file
npm test -- ComponentController_.test.js

# Run with coverage
npm test -- --coverage

# E2E tests (if implemented)
npm run test:e2e
```

### Security Considerations

**Component Code Execution**:
- **Risk**: Components run arbitrary JavaScript code on page load
- **Mitigation**:
  - Components must be explicitly added by developers (not user-uploadable)
  - Plugin directories gitignored by default (private to installation)
  - Code review required for any core-bundled example components
  - Documentation warns about security implications
  - No remote component loading (all bundled at build time)

**Configuration Injection**:
- **Risk**: Malicious component config could inject XSS via variables
- **Mitigation**:
  - Component variables passed as plain data (not executed)
  - Configure page uses React (auto-escapes outputs)
  - Components responsible for sanitizing their own outputs
  - Documentation includes security best practices

**Build System**:
- **Risk**: Invalid JSON could cause build to crash
- **Mitigation**:
  - try/catch around JSON.parse()
  - Graceful error logging
  - Build continues even if component fails to load
  - Invalid components skipped, not included in build

**API Access**:
- **Risk**: /getComponentConfig could expose sensitive data
- **Mitigation**:
  - Endpoint returns only metadata (no sensitive data)
  - Same access level as /getToolConfig (no additional exposure)
  - Component configs public by design (like tool configs)

**No Additional Attack Surface**: Components use existing MMGIS APIs and permissions. They cannot bypass authentication or authorization.

### Performance Considerations

**Build Time**:
- **Requirement**: Component discovery < 500ms (NFR-002)
- **Approach**:
  - Synchronous file operations acceptable (build-time only)
  - Scan only two directory patterns (*Private-Components*, *Plugin-Components*)
  - Cache nothing (build regenerates everything)
  - Parallel to tool discovery (not sequential)
- **Measurement**: Log timing in updateComponents(), warn if > 500ms

**Runtime Initialization**:
- **Requirement**: Component init() should not block page load
- **Approach**:
  - Initialize after fina() (UI already rendered)
  - Sequential initialization acceptable (components should be fast)
  - Errors caught and logged (no retry logic)
  - No async/await needed (components handle their own async if needed)
- **Measurement**: Add timing logs in ComponentController

**Configure Page Load**:
- **Requirement**: Components tab should render quickly
- **Approach**:
  - Fetch componentConfigs.json once on mount
  - Store in Redux state (no repeated fetches)
  - Render cards in grid (Material-UI handles virtualization if needed)
  - Modal lazy loads (only when opened)
- **Measurement**: React DevTools profiler, aim for < 100ms render

**Memory**:
- **Consideration**: Each component module loaded into memory
- **Approach**:
  - Components should be lightweight (few KB each)
  - No limit on component count (same as tools)
  - ES6 imports tree-shakeable if component not enabled
- **Measurement**: Browser DevTools memory profiler

## Rollout Plan

### Phase 1: Build System Foundation
**Deliverables**:
- Extend `API/updateTools.js` with `updateComponents()` function
- Generate `configure/public/componentConfigs.json`
- Generate `src/pre/components.js`
- Add `/getComponentConfig` API endpoint
- Unit tests for build system

**Success Criteria**:
- `npm run build` discovers components successfully
- Generated files have correct format
- Build completes even with no components
- Invalid components logged as warnings
- Tests pass with 80%+ coverage

**Testing**:
- Create test component directory
- Run build, verify generated files
- Test with invalid config.json
- Test with no components

### Phase 2: Frontend Component Controller
**Deliverables**:
- Create `ComponentController_.js`
- Implement `initializeComponents()` function
- Add error handling and logging
- Unit tests for ComponentController

**Success Criteria**:
- ComponentController reads configuration.components[]
- Enabled components initialized successfully
- Component init() errors caught and logged
- Multiple components initialize in sequence
- Tests pass with 90%+ coverage

**Testing**:
- Test with mock components
- Test error scenarios
- Test empty components array

### Phase 3: Frontend Integration
**Deliverables**:
- Integrate ComponentController into `essence.js`
- Call `initializeComponents()` after `fina()`
- Integration tests

**Success Criteria**:
- Components initialize after UI finalization
- Page loads successfully with components
- Console logs show component initialization
- No performance regression

**Testing**:
- Load MMGIS with test component
- Verify init() called
- Check timing logs

### Phase 4: Configure Page Components Tab
**Deliverables**:
- Create `Components.js` tab component
- Create `ComponentsSlice.js` (if needed)
- Fetch and display component cards
- Handle card clicks
- Tests for Components tab

**Success Criteria**:
- Components tab fetches componentConfigs
- Cards display correctly in grid
- ON/OFF indicators show component state
- Card clicks trigger modal (stubbed)
- Tests pass

**Testing**:
- Render with mock componentConfigs
- Test empty state
- Test card interactions

### Phase 5: Component Configuration Modal
**Deliverables**:
- Create `ComponentModal.js`
- ON/OFF toggle
- Icon field (optional)
- Dynamic form using Maker
- Save/cancel functionality
- Tests for modal

**Success Criteria**:
- Modal opens with component data
- Toggle changes ON/OFF state
- Form renders from config.json schema
- Save updates configuration.components[]
- Cancel discards changes
- Tests pass

**Testing**:
- Test modal with various component configs
- Test save/cancel flows
- Test form validation

### Phase 6: Tab Visibility & Polish
**Deliverables**:
- Add conditional tab rendering in `Main.js`
- Hide tab when no components
- Add "Custom Components" info card
- Polish UI styling
- E2E tests

**Success Criteria**:
- Tab hidden when componentConfigs empty
- Tab visible when components exist
- Tab matches Tools tab UX
- All user scenarios pass
- E2E tests pass

**Testing**:
- Test with and without components
- Test tab switching
- Test complete user workflows

### Phase 7: Documentation & Example
**Deliverables**:
- Update `docs/pages/Contributing/Contributing.md`
- Add Component Plugins section
- Document directory patterns, config.json structure, init() method
- Create example component
- Update AGENTS.md with component system info

**Success Criteria**:
- Documentation complete and accurate
- Example component demonstrates best practices
- Developers can create components without support
- Documentation reviewed and approved

**Testing**:
- Follow documentation to create new component
- Verify all steps work as documented

## Risks & Mitigations

**Risk 1**: Component init() errors break MMGIS page load
- **Impact**: High
- **Likelihood**: Medium
- **Mitigation**:
  - Wrap each init() call in try/catch
  - Log errors to console with clear component name
  - Continue initializing other components
  - Test with intentionally failing component
  - Document best practices for component error handling

**Risk 2**: Build system fails with invalid component configs
- **Impact**: Medium
- **Likelihood**: Medium
- **Mitigation**:
  - Validate JSON with try/catch around JSON.parse()
  - Log warnings but continue build
  - Skip invalid components
  - Test with malformed JSON files
  - Provide clear error messages indicating which component failed

**Risk 3**: Components tab doesn't hide when empty
- **Impact**: Low (UX annoyance, not functional issue)
- **Likelihood**: Low
- **Mitigation**:
  - Implement conditional rendering early
  - Test both empty and populated states
  - E2E test for tab visibility
  - Code review to verify logic

**Risk 4**: Performance regression from component initialization
- **Impact**: Medium
- **Likelihood**: Low
- **Mitigation**:
  - Initialize after fina() (UI already rendered)
  - Add timing logs to measure impact
  - Recommend components keep init() fast
  - Document performance best practices
  - Test with multiple components

**Risk 5**: Naming collision between standard and plugin components
- **Impact**: Medium (one component overrides another)
- **Likelihood**: Low
- **Mitigation**:
  - Document that later directories override earlier
  - Recommend unique component names
  - Log warning when component overridden
  - Same behavior as tools (consistent with existing system)

**Risk 6**: Generated files not in gitignore
- **Impact**: Low (repository pollution)
- **Likelihood**: Low
- **Mitigation**:
  - Verify `configure/public/componentConfigs.json` gitignored
  - Verify `src/pre/components.js` gitignored
  - Test that generated files don't appear in git status

## Open Technical Questions

1. **Should ComponentController be a singleton or static module?**
   - **Recommendation**: Static module with exported functions (like ToolController pattern)
   - **Rationale**: No state to maintain, simpler to import and use

2. **Should components.js export be synchronous or dynamic imports?**
   - **Recommendation**: Synchronous imports (like tools.js)
   - **Rationale**: Components needed at startup, no lazy loading benefit

3. **Should we add telemetry for component initialization?**
   - **Recommendation**: Yes, add console logs for timing
   - **Rationale**: Helps debug performance issues, can be removed in production build

4. **Should example component be in MMGIS core or separate repo?**
   - **Recommendation**: Include in core as `MMGIS-Private-Components/ExampleComponent/`
   - **Rationale**: Demonstrates pattern, gitignored by default, easy for developers to reference

5. **Should components have access to other component instances?**
   - **Recommendation**: No, components should be independent
   - **Rationale**: Reduces coupling, prevents dependency issues, matches spec decision #5

All open questions have recommendations. Will proceed with recommended approach unless feedback suggests otherwise.
