# Plugin-Components System - Specification

**Status**: 📋 Draft
**Created**: 2026-01-14
**Last Updated**: 2026-01-14
**Issue**: #849

## Overview

The Plugin-Components system is a new plugin architecture for MMGIS that complements the existing Plugin-Tools and Plugin-Backend systems. It provides a way to add lightweight, page-level enhancements and initialization logic without modifying core MMGIS code. Components are initialized once after the UI is finalized, making them ideal for global features like analytics integrations, keyboard shortcuts, custom behaviors, and background services.

This system enables missions and organizations to maintain custom functionality in separate plugin directories while still benefiting from MMGIS core updates.

## User Scenarios

### P1 - Mission Team Adds Custom Analytics

**As a** mission science operations lead
**I want to** integrate custom analytics tracking into MMGIS without modifying core code
**So that** I can track user behavior for our mission while maintaining easy MMGIS upgrades

**Acceptance Criteria**:
- [ ] Can create a component plugin directory matching `*-Components*` pattern
- [ ] Component has a `config.json` and main script with `init()` method
- [ ] Component initializes after UI is finalized on page load
- [ ] Component can be enabled/disabled via Configure page
- [ ] Component configuration persists in mission config
- [ ] Running `npm run build` discovers and registers the component

**User Flow**:
1. Create `My-Mission-Plugin-Components/AnalyticsComponent/` directory in `/src/essence/`
2. Add `config.json` with component metadata and configuration schema
3. Implement `AnalyticsComponent.js` with `init()` method that sets up tracking
4. Run `npm run build` to register the component
5. Open Configure page, navigate to Components tab
6. Enable AnalyticsComponent and configure tracking ID
7. Save mission configuration
8. Load MMGIS frontend - component initializes and begins tracking

### P2 - Developer Adds Global Keyboard Shortcuts

**As a** MMGIS developer
**I want to** add mission-specific keyboard shortcuts globally across MMGIS
**So that** users can quickly access frequently-used features

**Acceptance Criteria**:
- [ ] Can create component that registers global keyboard event listeners
- [ ] Component configures shortcuts via Configure page variables
- [ ] Component cleans up properly (though destroy() is not required)
- [ ] Multiple components can coexist without conflicts

**User Flow**:
1. Create `MMGIS-Private-Components/KeyboardShortcuts/` directory
2. Implement component with `init()` that adds `keydown` event listeners
3. Configure shortcut mappings in `config.json` variables
4. Enable component via Configure page
5. Test shortcuts work across all MMGIS pages

### P3 - Administrator Manages Component Plugins

**As a** MMGIS administrator
**I want to** view, enable/disable, and configure component plugins
**So that** I can control which custom enhancements are active for my mission

**Acceptance Criteria**:
- [ ] Components tab appears in Configure page when components exist
- [ ] Components tab is hidden when no components are installed
- [ ] Each component shows ON/OFF status indicator
- [ ] Can open component modal to toggle ON/OFF and configure variables
- [ ] Configuration changes save to mission config
- [ ] Can see component description and optional icon in card view (default icon used if not specified)

**User Flow**:
1. Open Configure page and select a mission
2. Navigate to Components tab (visible only if components exist)
3. View grid of available component cards
4. Click a component card to open configuration modal
5. Toggle component ON or OFF
6. Configure component-specific variables
7. Save configuration
8. Reload MMGIS frontend to see changes

## Requirements

### Functional Requirements

**FR-001**: Component Plugin Discovery
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Build system scans `/src/essence/` for directories matching `*Private-Components*` or `*Plugin-Components*` patterns
  - Each component subdirectory is scanned for `config.json`
  - Invalid components log warnings but don't break the build
  - Components can override each other by using the same name (later directories take precedence)

**FR-002**: Component Configuration Schema
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2, P3
- **Acceptance Criteria**:
  - Each component has a `config.json` defining metadata, optional icon, and configuration fields
  - Configuration schema supports same field types as tools (text, number, checkbox, dropdown, objectarray, etc.)
  - Components can have zero configuration variables (simple ON/OFF only)
  - Configuration schema generates UI in Configure page component modal

**FR-003**: Component Initialization Lifecycle
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Components export a single `init()` method (not `initialize()`, `make()`, or `destroy()`)
  - All enabled components' `init()` methods are called after UI finalization (after `fina()`)
  - Components initialize in discovery order (not guaranteed stable order between builds)
  - Component `init()` errors are caught, logged, and don't prevent other components from initializing
  - Components receive their configured variables as a parameter to `init()`

**FR-004**: Component Configuration UI
- **Priority**: P1 (Must Have)
- **User Scenarios**: P3
- **Acceptance Criteria**:
  - Configure page has a Components tab that matches the Tools tab UX
  - Components tab is hidden when no components are discovered
  - Each component shows as a card with optional icon, name, description, and ON/OFF indicator
  - Clicking a component card opens a modal with ON/OFF toggle and configuration form
  - Configuration form is generated from `config.json` using the Maker pattern
  - Component configuration saves to `configuration.components` array in mission config (same level as `configuration.tools`)

**FR-005**: Build-Time Component Registration
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - `npm run build` discovers components and generates `configure/public/componentConfigs.json`
  - `npm run build` generates `src/pre/components.js` with component module imports
  - Generated files include all component metadata and configuration schemas
  - Build completes successfully even if no components are found

**FR-006**: Documentation for Component Development
- **Priority**: P1 (Must Have)
- **User Scenarios**: P1, P2
- **Acceptance Criteria**:
  - Contributing documentation includes Component Plugins section
  - Documentation explains directory naming patterns
  - Documentation lists component file structure requirements
  - Documentation includes example use cases (analytics, shortcuts, enhancements)
  - Documentation notes that `npm run build` is required after adding components

### Non-Functional Requirements

**NFR-001**: Consistency with Existing Plugin Systems
- **Category**: Usability
- **Metric**: Plugin-Components follows same patterns as Plugin-Tools and Plugin-Backend
- Component directory patterns match tool patterns (`*Private-Components*` or `*Plugin-Components*` vs `*Private-Tools*` or `*Plugin-Tools*`)
- Component `config.json` structure matches tool config structure
- Configure page Components tab matches Tools tab UX
- Component discovery and registration follows tool discovery flow

**NFR-002**: Build Performance
- **Category**: Performance
- **Metric**: Component discovery adds minimal overhead to build process
- Component scanning completes in under 500ms for typical projects
- Build fails gracefully with clear errors if component configs are invalid

**NFR-003**: Error Handling
- **Category**: Reliability
- **Metric**: Component initialization errors don't break MMGIS
- Invalid `config.json` files log warnings during build but don't stop build
- Component `init()` errors are caught, logged to console, and don't prevent other components from running
- Missing component modules fail gracefully with clear error messages

**NFR-004**: Documentation Quality
- **Category**: Usability
- **Metric**: Developers can create component plugins without additional support
- Documentation includes complete example
- Documentation explains all configuration options
- Documentation clearly states when to use components vs tools

## Success Criteria

**Definition of Done**:
- [ ] All functional requirements implemented
- [ ] All acceptance criteria met
- [ ] Plugin-Components system follows same architecture as Plugin-Tools
- [ ] Configure page Components tab works identical to Tools tab
- [ ] Components tab hidden when no components exist
- [ ] Build system discovers and registers components
- [ ] Component initialization works after page load
- [ ] Documentation updated with Component Plugins section
- [ ] Example component demonstrates pattern
- [ ] Tests written and passing (target coverage: 80%+)
- [ ] Code reviewed and approved
- [ ] Documentation reviewed and approved

**Metrics**:
- Component discovery time: < 500ms
- Build success rate with invalid components: 100% (logs warnings, doesn't fail)
- Component init error isolation: 100% (one component error doesn't affect others)

## Open Questions

1. **Should components have access to MMGIS core modules (L_, Map_, F_, etc.)?**
   - **Decision**: Yes, components should be able to import MMGIS core modules for extending functionality

2. **Should there be a maximum number of components that can be enabled?**
   - **Decision**: No limit - same as tools

3. **Should components have a priority/order field for initialization sequence?**
   - **Decision**: No - components should not depend on each other's initialization order. Document this as a constraint.

4. **Should we include an example component in the MMGIS repo?**
   - **Decision**: Yes - include `MMGIS-Private-Components/ExampleComponent/` with detailed comments

5. **Should components be able to communicate with each other?**
   - **Decision**: Not directly - components can use global MMGIS event bus if needed, but should generally be independent

## References

- **Issue #849**: https://github.com/NASA-AMMOS/MMGIS/issues/849
- **Plugin-Tools System**: `src/essence/Tools/`, `API/updateTools.js`
- **Configure Page Tools Tab**: `configure/src/components/Tabs/Tools/`
- **Contributing Documentation**: `docs/pages/Contributing/Contributing.md`
- **Tool Configuration Schema**: `src/essence/Tools/Draw/config.json` (comprehensive example)
