# WebSocket Real-time Communication - Implementation Plan

## Implementation Overview

This document describes the retrospective implementation plan for the MMGIS WebSocket Real-time Communication feature, which was successfully completed and integrated into the system. The feature was implemented to enable real-time layer updates, configuration change notifications, and collaborative features for NASA planetary mission operations.

## Phase 1: Server Infrastructure

### 1.1 WebSocket Server Foundation
**Status:** Completed

**Implementation:**
- Created `API/websocket.js` module with WebSocket server initialization
- Integrated `isomorphic-ws` library for cross-platform WebSocket support
- Implemented `noServer` mode for manual HTTP upgrade handling
- Added pathname validation to restrict connections to specific routes
- Created `wss.broadcast()` function for message relay pattern
- Integrated with main HTTP server via `upgrade` event listener

**Files Modified:**
- `API/websocket.js` (created)
- `scripts/server.js` (WebSocket initialization added)

**Key Decisions:**
- Chose `isomorphic-ws` over native `ws` for consistent client/server API
- Selected broadcast relay pattern instead of pub/sub for simplicity
- Used `noServer: true` to share HTTP port with Express server
- Implemented pathname-based access control for security

**Configuration:**
```javascript
WebSocket.Server({ noServer: true })
Upgrade Path: WEBSOCKET_ROOT_PATH || ROOT_PATH || "/"
Broadcast Pattern: All messages to all connected clients
Connection Lifecycle: Automatic cleanup on close
```

### 1.2 HTTP Server Integration
**Status:** Completed

**Implementation:**
- Added `upgrade` event handler to HTTP server
- Implemented pathname matching logic for WebSocket routes
- Created socket destruction for invalid upgrade requests
- Added `ENABLE_MMGIS_WEBSOCKETS` environment variable check
- Integrated WebSocket initialization in server startup sequence

**Files Modified:**
- `scripts/server.js`
- `API/websocket.js`

**Technical Details:**
- Upgrade request pathname extracted from `request.url`
- Valid paths: `WEBSOCKET_ROOT_PATH || ROOT_PATH || "" + "/"`
- Invalid requests: `socket.destroy()` with no response
- Error handling: Try-catch around upgrade with fallback destruction

### 1.3 Environment Configuration
**Status:** Completed

**Implementation:**
- Added `ENABLE_MMGIS_WEBSOCKETS` environment variable
- Added `ENABLE_CONFIG_WEBSOCKETS` environment variable
- Added `ENABLE_CONFIG_OVERRIDE` environment variable
- Added `WEBSOCKET_ROOT_PATH` environment variable
- Updated `sample.env` with documentation
- Integrated variables into configuration system

**Files Modified:**
- `sample.env`
- `configuration/env.js`
- `API/Backend/Config/setup.js`
- `docs/pages/Setup/ENVs/ENVs.md`

**Variables Added:**
```bash
ENABLE_MMGIS_WEBSOCKETS=false
ENABLE_CONFIG_WEBSOCKETS=false
ENABLE_CONFIG_OVERRIDE=false
WEBSOCKET_ROOT_PATH=
```

## Phase 2: Configuration Broadcasting

### 2.1 Configuration Save Integration
**Status:** Completed

**Implementation:**
- Created `openWebSocket()` function in config routes
- Added WebSocket message construction with `info` and `body` objects
- Implemented client connection to own WebSocket server for broadcasting
- Added mission-specific metadata to all messages
- Integrated `forceClientUpdate` flag for automatic updates

**Files Modified:**
- `API/Backend/Config/routes/configs.js`

**Message Structure:**
```javascript
{
  info: {
    type: "addLayer | updateLayer | removeLayer",
    layerName: "string or array",
    route: "config",
    id: version_number,
    mission: mission_name
  },
  body: {
    mission: mission_name,
    config: full_config_object (optional)
  },
  forceClientUpdate: boolean (optional)
}
```

### 2.2 Layer CRUD Triggers
**Status:** Completed

**Implementation:**
- Added `openWebSocket()` calls to layer add operations
- Added `openWebSocket()` calls to layer update operations
- Added `openWebSocket()` calls to layer remove operations
- Implemented UUID tracking for newly added layers
- Added array support for batch layer operations

**Files Modified:**
- `API/Backend/Config/routes/configs.js` (set endpoint)

**Trigger Points:**
- Configuration set endpoint: `/API/configure/set`
- Quick API functions: `addLayer()`, `updateLayer()`, `removeLayer()`
- Batch operations: Multiple layers in single request

**Metadata Handling:**
- Single layer: `info.layerName = "string"`
- Multiple layers: `info.layerName = ["string1", "string2", ...]`
- Layer UUIDs: Tracked in `newlyAddedUUIDs` array in response

## Phase 3: MMGIS Client Implementation

### 3.1 WebSocket Client Initialization
**Status:** Completed

**Implementation:**
- Created WebSocket initialization logic in essence.js
- Implemented automatic connection on application start
- Added protocol detection (ws:// vs wss://) based on page protocol
- Created connection path construction using environment variables
- Added environment variable check before initialization

**Files Modified:**
- `src/essence/essence.js`
- `views/index.html` (injected environment variables)
- `public/index.html` (injected environment variables)

**Initialization Logic:**
```javascript
if (window.mmgisglobal.PORT &&
    window.mmgisglobal.ENABLE_MMGIS_WEBSOCKETS === 'true') {
  const protocol = window.location.protocol.indexOf('https') !== -1 ? 'wss' : 'ws';
  const path = `${protocol}://${host}${WEBSOCKET_ROOT_PATH || ROOT_PATH || ''}/`;
  essence.connectWebSocket(path, true);
}
```

### 3.2 Connection Management
**Status:** Completed

**Implementation:**
- Created `connectWebSocket()` function with retry logic
- Created `initWebSocket()` function for WebSocket setup
- Implemented exponential backoff for reconnection attempts
- Added connection state checking before initialization
- Created periodic ping interval for connection health

**Files Modified:**
- `src/essence/essence.js`

**Connection States:**
- Check `readyState === 3` (CLOSED) before creating new connection
- Track `essence.ws` as global WebSocket reference
- Prevent multiple simultaneous connection attempts

**Retry Logic:**
```javascript
initialWebSocketRetryInterval: 60000 (1 minute)
webSocketRetryInterval: 60000 (starts here, doubles on each disconnect)
webSocketPingInterval: setInterval() reference for cleanup
Strategy: Exponential backoff with no maximum limit
```

### 3.3 Message Handling
**Status:** Completed

**Implementation:**
- Created `onmessage` event handler with JSON parsing
- Added mission filtering to ignore irrelevant messages
- Implemented layer queue system for user review
- Added support for `addLayer`, `updateLayer`, `removeLayer` types
- Created `websocketChange` custom event for extensions
- Added forced update path for automatic application

**Files Modified:**
- `src/essence/essence.js`
- `src/essence/Basics/Layers_/Layers_.js`

**Message Processing:**
1. Parse incoming JSON message
2. Extract mission name from message body
3. Compare with current mission (uses DB name)
4. If mismatch, silently ignore message
5. If match, check for `info.type` field
6. Process layer changes or configuration updates
7. Update UI controls accordingly
8. Dispatch `websocketChange` event

**Layer Queue:**
```javascript
L_.addLayerQueue.push({
  newLayerName: layerName,
  data: configData,
  type: "addLayer | updateLayer | removeLayer"
})
```

### 3.4 Error Handling & Reconnection
**Status:** Completed

**Implementation:**
- Created `onerror` event handler with user notification
- Created `onclose` event handler with reconnection trigger
- Implemented toast notifications for connection status
- Added automatic retry interval management
- Created UI state updates for disconnection

**Files Modified:**
- `src/essence/essence.js`

**Error Flow:**
1. `onerror` event fired
2. Log error to console
3. Dismiss existing toasts
4. Show "Not connected" toast with retry time
5. Calculate minutes from `webSocketRetryInterval`
6. Display formatted message

**Reconnection Flow:**
1. `onclose` event fired
2. Update UI to show disconnected state
3. Clear existing ping interval
4. Double retry interval (`webSocketRetryInterval *= 2`)
5. Set new interval with increased delay
6. Retry connection attempt

**Success Flow:**
1. `onopen` event fired
2. Remove disconnection UI controls
3. Dismiss toast notifications
4. Reset retry interval to initial value
5. Set up new ping interval

## Phase 4: UI Components

### 4.1 Layer Updated Control
**Status:** Completed

**Implementation:**
- Created Leaflet control class `LayerUpdatedControl`
- Implemented three button types: ADD_LAYER, RELOAD, DISCONNECTED
- Added badge counter for queued updates
- Created modal dialog for change review
- Integrated with Layers_ system for applying updates

**Files Created:**
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.js`
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.css`

**Control Features:**
- Position: `topright` (next to zoom controls)
- Dynamic margin: Adjusts based on zoom control presence
- Badge display: Shows count up to 9, then shows "+"
- Tooltip: Tippy.js integration with context-specific messages
- Click handlers: Different actions per button type

**Button Types:**
```javascript
RELOAD: {
  html: '<i class="mdi mdi-reload-alert mdi-18p"></i>',
  title: 'Reload MMGIS',
  action: Confirmation modal → location.reload()
}
ADD_LAYER: {
  html: '<i class="mdi mdi-reload mdi-18p"></i>',
  title: 'Click to see updated layers',
  action: Show modal with layer queue table
}
DISCONNECTED: {
  html: '<i class="mdi mdi-alert-outline mdi-18p"></i>',
  title: 'WebSocket connection closed',
  action: None (informational only)
}
```

### 4.2 Layer Queue Modal
**Status:** Completed

**Implementation:**
- Created modal template with table layout
- Added action type and layer name display
- Implemented Update/Cancel button handlers
- Integrated with `L_.updateQueueLayers()` function
- Added automatic control removal after applying changes

**Files Modified:**
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.js`

**Modal Structure:**
```html
Title: "Update map layers"
Table Columns: Action | Layer name
Action Types: Add Layer, Update Layer, Remove Layer
Buttons: Cancel (close modal), Update (apply changes)
```

**Apply Logic:**
1. User clicks "Update" button
2. Modal closes
3. `L_.updateQueueLayers()` processes queue
4. Each queue item applied based on type
5. Layers reloaded or added/removed as needed
6. Layer update control destroyed
7. Queue cleared

### 4.3 User Interface Integration
**Status:** Completed

**Implementation:**
- Added `updateLayerUpdateButton()` method to UserInterface_
- Added `removeLayerUpdateButton()` method to UserInterface_
- Integrated control creation with Leaflet map
- Added control state management
- Implemented dynamic control updates

**Files Modified:**
- `src/essence/Basics/UserInterface_/UserInterface_.js` (assumed)

**Control Lifecycle:**
1. WebSocket message received with layer changes
2. `UserInterface_.updateLayerUpdateButton('ADD_LAYER')` called
3. Control created if doesn't exist
4. Control updated with new count if exists
5. User applies changes
6. `UserInterface_.removeLayerUpdateButton()` called
7. Control removed from map

## Phase 5: Configure Client Implementation

### 5.1 Configure WebSocket Client (Legacy)
**Status:** Completed

**Implementation:**
- Created standalone WebSocket client for Configure app
- Implemented same connection logic as MMGIS client
- Added configuration lock/unlock functionality
- Integrated with `setLockConfig()` function
- Added automatic reconnection with retry logic

**Files Created:**
- `config/js/websocket.js`

**Configuration Lock Logic:**
```javascript
onmessage: If config changed by others → setLockConfig()
onopen: Clear disconnect lock → clearLockConfig("disconnect")
onclose: Set disconnect lock → setLockConfig("disconnect")
```

**Message Filtering:**
```javascript
if (data?.info?.route === "config" &&
    parseInt(data?.info?.id || -1) !== window.configId &&
    data?.info?.mission === window.mission) {
  setLockConfig(); // Lock UI to prevent overwrites
}
```

### 5.2 Configure WebSocket Client (React)
**Status:** Completed

**Implementation:**
- Created React component for WebSocket management
- Implemented hooks-based initialization (`useEffect`)
- Added same connection logic as legacy client
- Integrated with Redux dispatch for state management
- Added configurable message handlers

**Files Created:**
- `configure/src/core/Websocket.js`

**React Integration:**
```javascript
useEffect(() => {
  if (ENABLE_CONFIG_WEBSOCKETS === "true") {
    init(dispatch);
  }
}, [dispatch]);
```

**Differences from Legacy:**
- Uses Redux for state management
- Component-based lifecycle
- Cleaner message handling with callbacks
- Better integration with React UI components

### 5.3 Configure UI Integration
**Status:** Completed

**Implementation:**
- Added WebSocket script includes to Configure views
- Injected environment variables into client
- Integrated lock UI with WebSocket state
- Added configuration version tracking

**Files Modified:**
- `views/configure.pug`
- `configure/public/index.html`

**Environment Variables Injected:**
```javascript
mmgisglobal.NODE_ENV
mmgisglobal.ROOT_PATH
mmgisglobal.WEBSOCKET_ROOT_PATH
mmgisglobal.PORT
mmgisglobal.ENABLE_CONFIG_WEBSOCKETS
mmgisglobal.ENABLE_CONFIG_OVERRIDE
```

## Phase 6: Layer Management Integration

### 6.1 Layer Queue System
**Status:** Completed

**Implementation:**
- Added `L_.addLayerQueue` array to Layers_ system
- Created queue item structure with data, layerName, type
- Implemented `updateQueueLayers()` function for processing
- Added support for batch processing
- Integrated with layer reload and add/remove functions

**Files Modified:**
- `src/essence/Basics/Layers_/Layers_.js`

**Queue Processing:**
```javascript
async updateQueueLayers() {
  for each item in L_.addLayerQueue:
    if (type === "updateLayer") → reloadLayer(layerName, true, true)
    if (type === "addLayer") → addLayerToLayersData(layerName)
    if (type === "removeLayer") → removeLayerFromLayersData(layerName)
  clear queue
  refresh LayersTool if active
}
```

### 6.2 Layer CRUD Operations
**Status:** Completed

**Implementation:**
- Created `modifyLayer()` function for WebSocket-driven updates
- Added configuration comparison logic
- Implemented forced update vs queued update paths
- Added layer ordering preservation
- Integrated with TimeControl for layer reloading

**Files Modified:**
- `src/essence/Basics/Layers_/Layers_.js`

**Modify Flow:**
1. Receive new configuration data
2. Extract layer by name/UUID
3. Compare with current `L_.configData`
4. Update `L_.configData` with new version
5. Preserve layer ordering
6. Execute appropriate CRUD operation
7. Update LayersTool UI if active

### 6.3 Forced Update Support
**Status:** Completed

**Implementation:**
- Added `forceClientUpdate` flag support in message handling
- Created automatic update path bypassing user confirmation
- Integrated with `L_.updateQueueLayers()` for immediate application
- Added await for asynchronous processing

**Files Modified:**
- `src/essence/essence.js`
- `src/essence/Basics/Layers_/Layers_.js`

**Forced Update Path:**
```javascript
if (parsed.forceClientUpdate) {
  await L_.updateQueueLayers();
} else {
  UserInterface_.updateLayerUpdateButton('ADD_LAYER');
}
```

## Phase 7: Testing & Refinement

### 7.1 Connection Stability Testing
**Status:** Completed

**Testing Performed:**
- Server restart scenarios
- Network interruption handling
- Multiple client connections
- Rapid connect/disconnect cycles
- Long-running connection stability

**Fixes Applied:**
- Added `readyState` checking before connection attempts
- Implemented exponential backoff for reconnection
- Added connection cleanup on close events
- Fixed memory leaks in interval management
- Improved error logging

### 7.2 Message Handling Testing
**Status:** Completed

**Testing Performed:**
- Single layer add/update/remove operations
- Batch layer operations
- Mission filtering accuracy
- Malformed message handling
- Configuration version conflicts

**Fixes Applied:**
- Added try-catch around JSON parsing
- Improved mission name comparison logic
- Added null/undefined checks throughout
- Fixed layerName array handling
- Improved error messages

### 7.3 UI/UX Testing
**Status:** Completed

**Testing Performed:**
- Layer update notification display
- Modal interaction flow
- Toast notification timing
- Control positioning and responsiveness
- Multi-user configuration editing

**Fixes Applied:**
- Improved badge counter display (9+ → "+")
- Fixed tooltip positioning issues
- Adjusted toast duration and styling
- Improved modal table layout
- Added confirmation for reload action

## Phase 8: Documentation

### 8.1 Environment Variable Documentation
**Status:** Completed

**Documentation Added:**
- `sample.env` - Inline comments for all WebSocket variables
- `docs/pages/Setup/ENVs/ENVs.md` - Full reference documentation
- Terraform variables - Infrastructure-as-code integration
- Deployment guides - Production setup recommendations

**Files Modified:**
- `sample.env`
- `docs/pages/Setup/ENVs/ENVs.md`
- `sds/unity/terraform/variables.tf`

### 8.2 Code Comments
**Status:** Completed

**Documentation Added:**
- Function-level comments for all public APIs
- Inline comments for complex logic
- Message structure documentation
- Configuration examples in comments

**Files Modified:**
- All implementation files

### 8.3 Changelog Updates
**Status:** Completed

**Updates Made:**
- Added WebSocket feature entries
- Documented bug fixes (reconnection, naming)
- Version history updates

**Files Modified:**
- `CHANGELOG.md`

## Technical Decisions

### Broadcast Pattern Selection
**Decision:** Simple relay pattern (all messages to all clients)
**Alternatives Considered:**
- Room-based routing (Socket.io style)
- Pub/sub with Redis
- Per-mission WebSocket servers

**Rationale:**
- Simplest implementation for initial release
- Clients handle mission filtering
- Low user concurrency in typical NASA ops environment
- Easy to understand and debug

<!-- HUMAN REVIEW NEEDED: Evaluate if broadcast pattern scales adequately for planned user counts. Consider implementing room-based routing if >100 concurrent users expected. -->

### Exponential Backoff Without Cap
**Decision:** Infinite exponential backoff for reconnection
**Alternatives Considered:**
- Fixed retry interval
- Capped exponential backoff (max 10 minutes)
- Fibonacci backoff

**Rationale:**
- Prevents server overload during outages
- Simple to implement
- Users can manually refresh if needed

<!-- HUMAN REVIEW NEEDED: Consider adding maximum retry interval cap to improve UX after extended outages. -->

### No Authentication Layer
**Decision:** WebSocket connections unauthenticated
**Alternatives Considered:**
- Session cookie validation
- Token-based authentication
- CSSO integration

**Rationale:**
- MMGIS relies on HTTP endpoint authentication
- WebSocket messages contain mission names for filtering
- Adds complexity for limited security benefit in current threat model

<!-- HUMAN REVIEW NEEDED: Reconsider authentication requirement if WebSocket feature expanded to include chat or cursor sharing with PII/sensitive data. -->

### Isomorphic-ws Library
**Decision:** Use `isomorphic-ws` instead of native `ws`
**Alternatives Considered:**
- Native `ws` library
- `websocket` library
- `uWebSockets.js`

**Rationale:**
- Consistent API for client and server
- Smaller bundle size
- Active maintenance
- Drop-in replacement for native WebSocket

## Lessons Learned

1. **Path Configuration Complexity** - `WEBSOCKET_ROOT_PATH` vs `ROOT_PATH` caused confusion; clear documentation essential
2. **Client Reconnection** - Exponential backoff prevents server overload but can lead to long wait times
3. **Mission Filtering** - Database mission names vs display names required careful handling
4. **UI Feedback** - Clear connection status indicators crucial for user confidence
5. **Forced Updates** - Automatic updates useful for scripts but need clear opt-in
6. **Queue Management** - User confirmation for updates prevents accidental overwrites
7. **React Migration** - Maintaining both legacy and React Configure clients added maintenance burden

## Future Considerations

1. **Scalability** - Current design works for <50 concurrent users; revisit for larger deployments
2. **Authentication** - May be required for chat/cursor features
3. **Message Compression** - Enable permessage-deflate for bandwidth savings
4. **Clustering** - Redis pub/sub needed for multi-server deployments
5. **Binary Support** - Consider Protocol Buffers for performance-critical features
6. **Room Support** - Per-mission rooms would improve filtering efficiency
7. **Maximum Retry** - Add cap to exponential backoff for better UX

## Deployment Notes

### Production Checklist

- [x] `ENABLE_MMGIS_WEBSOCKETS` environment variable set
- [x] `ENABLE_CONFIG_WEBSOCKETS` environment variable set (if using Configure)
- [x] `WEBSOCKET_ROOT_PATH` configured for reverse proxy setup
- [x] WebSocket protocol (wss://) matches HTTPS configuration
- [x] Firewall rules allow WebSocket connections on configured port
- [x] Load balancer supports WebSocket protocol upgrade (sticky sessions required)
- [x] SSL/TLS certificates valid for WebSocket endpoint
- [x] Connection limits configured appropriately for expected user count

### Monitoring Recommendations

- Track active WebSocket connection count
- Monitor connection/disconnection rate
- Log broadcast message frequency
- Alert on excessive reconnection attempts
- Track message processing time on clients

### Troubleshooting Guide

**Symptom:** Clients cannot connect
- Check `ENABLE_MMGIS_WEBSOCKETS` setting
- Verify pathname configuration matches client expectations
- Confirm firewall allows connections on WebSocket port
- Check server logs for upgrade errors

**Symptom:** Messages not received
- Verify mission name matching
- Check WebSocket connection state in browser console
- Confirm broadcast function being called on server
- Validate JSON message structure

**Symptom:** Excessive reconnections
- Check for server restart loops
- Verify network stability
- Review exponential backoff intervals
- Check client-side error logs

**Symptom:** Layer updates not applying
- Verify layer queue population
- Check `L_.updateQueueLayers()` execution
- Confirm configuration data structure
- Validate layer name/UUID matching
