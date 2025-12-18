# WebSocket Real-time Communication - Feature Specification

## Overview

The MMGIS WebSocket Real-time Communication system provides bidirectional, real-time messaging capabilities for collaborative features in the Multi-Mission Geographic Information System. The feature was implemented to enable instant layer updates, configuration change notifications, and real-time collaboration between multiple users working on the same mission.

## Feature Description

### Core Capabilities

The WebSocket system supports two primary operational modes, each serving distinct purposes within the MMGIS architecture:

1. **MMGIS WebSockets** - Real-time layer and configuration updates for the main MMGIS client application
2. **Config WebSockets** - Configuration change notifications for the administrative Configure interface

### WebSocket Modes

#### MMGIS WebSockets (`ENABLE_MMGIS_WEBSOCKETS`)

Provides real-time communication for the main MMGIS mapping interface:

- **Layer Update Broadcasting** - Notify all connected clients when layers are added, updated, or removed
- **Configuration Change Detection** - Alert users when the mission configuration has been modified
- **Automatic Reconnection** - Client-side retry logic with exponential backoff
- **Mission-Specific Routing** - Messages are filtered by mission name to ensure proper targeting

**Message Types:**
- `addLayer` - New layer added to mission configuration
- `updateLayer` - Existing layer modified
- `removeLayer` - Layer removed from mission configuration
- Configuration updates (generic changes to mission config)

#### Config WebSockets (`ENABLE_CONFIG_WEBSOCKETS`)

Provides real-time notifications for the Configure administrative interface:

- **Configuration Lock Warnings** - Alert when another user modifies the configuration
- **Version Conflict Detection** - Prevent overwriting changes made by other administrators
- **Automatic Reconnection** - Similar retry logic as MMGIS WebSockets
- **Mission-Specific Filtering** - Only show alerts for the currently active mission

### WebSocket Architecture

#### Server-Side Implementation

**Technology Stack:**
- **isomorphic-ws** - Cross-platform WebSocket library (browser + Node.js)
- **ws** - Native WebSocket Server implementation
- **Upgrade Protocol** - HTTP to WebSocket protocol upgrade handling

**Server Configuration:**
```javascript
Location: API/websocket.js
Server Mode: noServer (manual upgrade handling)
Protocol: ws:// (development) or wss:// (production HTTPS)
Path: {WEBSOCKET_ROOT_PATH || ROOT_PATH}/
Broadcast Pattern: Message relay to all connected clients
```

**Connection Lifecycle:**
1. HTTP server receives upgrade request at configured path
2. Pathname validation ensures requests match `WEBSOCKET_ROOT_PATH` or `ROOT_PATH`
3. WebSocket connection established via `handleUpgrade()`
4. Client added to `wss.clients` collection
5. Message handler attached: all incoming messages broadcast to all clients
6. On close: client automatically removed from collection

**Broadcast Function:**
```javascript
wss.broadcast = function broadcast(data, isBinary) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && data !== undefined) {
      client.send(data, { binary: isBinary });
    }
  });
};
```

#### Client-Side Implementation

**MMGIS Client (src/essence/essence.js):**
- Automatic initialization if `ENABLE_MMGIS_WEBSOCKETS=true`
- Protocol detection: `ws://` for HTTP, `wss://` for HTTPS
- Connection path: `{protocol}://{host}{WEBSOCKET_ROOT_PATH || ROOT_PATH}/`
- Retry interval: 60 seconds initially, doubles on each disconnect (exponential backoff)
- Heartbeat pings: Periodic reconnection attempts every 60+ seconds

**Configure Client (config/js/websocket.js, configure/src/core/Websocket.js):**
- Automatic initialization if `ENABLE_CONFIG_WEBSOCKETS=true`
- Same protocol/path logic as MMGIS client
- Mission-specific message filtering
- UI lock/unlock based on configuration version conflicts

### Message Protocol

#### Message Structure

**Outgoing (Server to Clients):**
```json
{
  "info": {
    "type": "addLayer | updateLayer | removeLayer",
    "layerName": "string | string[]",
    "route": "config",
    "id": "number (config version)",
    "mission": "string (mission name)"
  },
  "body": {
    "mission": "string",
    "config": "object (optional full config)"
  },
  "forceClientUpdate": "boolean (optional, triggers automatic reload)"
}
```

**Incoming (Clients to Server):**
- All messages received are broadcast to all other connected clients
- No server-side message processing or routing logic
- Simple relay pattern: receive → broadcast

#### Message Routing

**Mission Filtering:**
- Clients check `parsed.body.mission` against their current mission
- Messages for different missions are silently ignored
- Uses database mission name for accurate comparison

**Layer Queue Management:**
- Layer changes queue in `L_.addLayerQueue` for user review
- UI control (`LayerUpdatedControl`) shows notification icon with count
- User can preview changes before applying via modal dialog

<!-- HUMAN REVIEW NEEDED: Clarify the intended use case for real-time cursor sharing and chat functionality mentioned in the requirements but not implemented in the current codebase -->

### Connection Management

#### Automatic Reconnection

**MMGIS Client Reconnection Logic:**
```javascript
Initial Retry Interval: 60000ms (1 minute)
Retry Strategy: Exponential backoff (doubles on each disconnect)
Max Implied Retry: No hard limit (continues doubling)
Ping Interval: Same as retry interval, updated on reconnect
```

**User Feedback:**
- Toast notifications on connection failure (shows retry time)
- Layer update button displays "disconnected" state
- Automatic dismissal of toasts on successful reconnection

**Connection States:**
- `CONNECTING` (0) - Initial connection attempt
- `OPEN` (1) - Active connection, ready to send/receive
- `CLOSING` (2) - Connection shutdown initiated
- `CLOSED` (3) - Connection terminated, triggers reconnection

#### Error Handling

**Client-Side:**
- `onerror` event: Logs connection failure, shows user notification
- `onclose` event: Triggers reconnection logic, updates UI state
- Try-catch wraps message parsing to prevent client crashes

**Server-Side:**
- Path validation: Destroy socket if pathname doesn't match
- Upgrade errors: Silent socket destruction (no response sent)
- Broadcast safety: Check `client.readyState === WebSocket.OPEN` before sending

### Security Considerations

**Path-Based Access Control:**
- WebSocket upgrade limited to specific pathname
- Respects `WEBSOCKET_ROOT_PATH` environment variable for custom routing
- Invalid paths result in immediate socket destruction

**No Authentication Layer:**
<!-- HUMAN REVIEW NEEDED: WebSocket connections do not currently validate user authentication or permissions. All connected clients receive all broadcast messages regardless of user role or mission access. Consider adding authentication middleware for production deployments with sensitive data. -->

**Protocol Security:**
- Automatic `wss://` (WebSocket Secure) when HTTPS enabled
- Inherits TLS/SSL settings from main HTTP server
- No additional certificate configuration required

### Configuration Options

#### Environment Variables

**`ENABLE_MMGIS_WEBSOCKETS`** (boolean, default: `false`)
- Enables WebSocket server and client for main MMGIS interface
- Controls layer update broadcasting
- Set to `"true"` to activate

**`ENABLE_CONFIG_WEBSOCKETS`** (boolean, default: `false`)
- Enables WebSocket notifications for Configure interface
- Controls configuration conflict warnings
- Set to `"true"` to activate

**`ENABLE_CONFIG_OVERRIDE`** (boolean, default: `false`)
- Requires `ENABLE_CONFIG_WEBSOCKETS=true`
- Allows administrators to override configuration conflicts
- If `false`, saves blocked when version mismatch detected

**`WEBSOCKET_ROOT_PATH`** (string, default: `""`)
- Overrides `ROOT_PATH` for WebSocket connections
- Useful for reverse proxy configurations
- Falls back to `ROOT_PATH` if not set

**`PORT`** (number, default: `8888`)
- Defines WebSocket connection port
- Shared with main HTTP server

**`HTTPS`** (boolean, default: `false`)
- Controls protocol: `ws://` vs `wss://`
- Automatically set based on server TLS configuration

### Integration Points

#### Configuration Management

**Trigger Points:**
- `/API/configure/set` - Main configuration save endpoint
- Layer CRUD operations via `addLayer()`, `removeLayer()`, `modifyLayer()`
- Configuration version changes

**Broadcast Flow:**
```
1. Admin saves configuration change
2. Server validates and persists to database
3. openWebSocket() called with change metadata
4. Server opens client connection to own WebSocket
5. Server sends message with info + body
6. Broadcast relay sends to all connected clients
7. Clients filter by mission and update UI
```

#### Layer Management

**Client-Side Layer Queue:**
```javascript
Location: src/essence/Basics/Layers_/Layers_.js
Queue Structure: L_.addLayerQueue[]
Queue Items: { newLayerName, data, type }
Processing: User-triggered via LayerUpdatedControl modal
```

**Update Types:**
- `addLayer` - Calls `L_.addLayerToLayersData()`
- `updateLayer` - Calls `L_.TimeControl_.reloadLayer()` with force flags
- `removeLayer` - Calls `L_.removeLayerFromLayersData()`

**Forced Updates:**
- If `forceClientUpdate: true`, changes applied immediately
- Bypasses user confirmation modal
- Useful for automated/scripted updates

#### User Interface Components

**LayerUpdatedControl (Leaflet Control):**
- Shows notification icon when updates available
- Three button types: `ADD_LAYER`, `RELOAD`, `DISCONNECTED`
- Badge displays count of queued updates (max shows "+" for 10+)
- Modal interface for reviewing and applying changes
- Positioned top-right, responsive to zoom control presence

**Toast Notifications:**
- Connection failures: "Not connected to WebSocket. Retrying in X minute(s)..."
- Duration: 10 seconds
- Style: `mmgisToast failure` class
- Auto-dismiss on successful reconnection

### Custom Events

**`websocketChange` Event:**
```javascript
Type: CustomEvent
Target: document
Detail: {
  layer: string | string[] | null,
  type: "addLayer" | "updateLayer" | "removeLayer" | null,
  data: parsed message object
}
Purpose: Hook for plugins/extensions to react to WebSocket updates
```

**Usage Example:**
```javascript
document.addEventListener('websocketChange', (event) => {
  console.log('Layer changed:', event.detail.layer);
  console.log('Change type:', event.detail.type);
  // Custom logic here
});
```

## Technical Details

### Dependencies

**Server:**
- `isomorphic-ws` ^5.0.0 - Universal WebSocket client/server
- Node.js `http.Server` - For protocol upgrade handling

**Client:**
- `isomorphic-ws` (bundled) - Browser WebSocket implementation
- Native browser `WebSocket` API support required

### Performance Considerations

**Connection Overhead:**
- Each client maintains one persistent WebSocket connection
- Memory: ~50KB per connection (typical)
- No message history or replay functionality

**Broadcast Scalability:**
- O(n) complexity where n = number of connected clients
- No message queuing or buffering
- Synchronous send to all clients on each broadcast

**Reconnection Load:**
- Exponential backoff prevents thundering herd on server restart
- Maximum observed retry: 60s → 120s → 240s → 480s... (doubles infinitely)

<!-- HUMAN REVIEW NEEDED: Consider implementing a maximum retry interval cap (e.g., 10 minutes) to prevent extremely long wait times after extended outages -->

### Browser Compatibility

**WebSocket Support Required:**
- Chrome 16+
- Firefox 11+
- Safari 7+
- Edge (all versions)
- Opera 12.1+

**No Fallback Mechanism:**
- Feature gracefully disabled if WebSocket unavailable
- No Socket.io or polling fallback implemented
- MMGIS fully functional without WebSocket support

## Known Limitations

1. **No Authentication** - All connected clients receive all messages (mission filtering only)
2. **No Message Persistence** - Messages lost if client disconnected during broadcast
3. **No Room/Channel Support** - All clients on same WebSocket server receive all messages
4. **No Compression** - Messages sent as plain JSON (no gzip/deflate)
5. **No Binary Support** - JSON-only message protocol (binary parameter unused)
6. **Single Server Only** - No clustering or horizontal scaling support
7. **No Rate Limiting** - Client can send unlimited messages (broadcast relay)

<!-- HUMAN REVIEW NEEDED: Evaluate whether message authentication, persistence, or room-based routing should be added for future multi-mission deployments with higher user concurrency -->

## Future Enhancements

Based on the current implementation, potential enhancements could include:

1. **Authentication & Authorization** - Validate user permissions before broadcasting
2. **Message Persistence** - Queue messages for offline clients
3. **Room/Channel Support** - Separate WebSocket connections per mission
4. **Cursor Sharing** - Real-time collaborative cursor positions (mentioned in requirements)
5. **Chat Functionality** - Text-based communication between users (mentioned in requirements)
6. **Compression** - Enable permessage-deflate extension for bandwidth savings
7. **Clustering Support** - Redis pub/sub for multi-server deployments
8. **Message History** - Replay recent events for newly connected clients
9. **Heartbeat Protocol** - Explicit ping/pong for connection health monitoring
10. **Maximum Retry Cap** - Limit exponential backoff to reasonable maximum

## Related Features

- **003-vector-drawing-and-collaboration** - DrawTool file synchronization (different mechanism)
- **005-mission-project-configuration** - Configuration versioning and conflict detection
- **009-layer-and-map-configuration** - Layer CRUD operations that trigger broadcasts

## References

### Key Files

**Server Implementation:**
- `API/websocket.js` - Main WebSocket server initialization and broadcast logic
- `scripts/server.js` - HTTP server and WebSocket integration
- `API/Backend/Config/routes/configs.js` - Configuration save triggers

**Client Implementation:**
- `src/essence/essence.js` - MMGIS client WebSocket initialization and message handling
- `config/js/websocket.js` - Configure client WebSocket (legacy)
- `configure/src/core/Websocket.js` - Configure client WebSocket (React)

**UI Components:**
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.js` - Notification button control
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.css` - Control styling
- `src/essence/Basics/Layers_/Layers_.js` - Layer queue and update logic

### Environment Configuration

- `sample.env` - Environment variable documentation
- `docs/pages/Setup/ENVs/ENVs.md` - Configuration reference documentation
