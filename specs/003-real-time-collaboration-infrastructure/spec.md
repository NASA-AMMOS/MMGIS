# Real-Time Collaboration Infrastructure - Feature Specification

## Overview

The MMGIS Real-Time Collaboration Infrastructure provides the underlying WebSocket-based communication layer that enables multiple collaborative features throughout the system. This infrastructure enables instant synchronization of layer updates, configuration changes, and other real-time interactions between users working on the same mission. Rather than being a user-facing feature itself, this infrastructure supports collaborative functionality in other features including the Draw Tool, Configure interface, and layer management systems.

## Feature Description

### Core Capabilities

The WebSocket infrastructure supports two primary operational modes, providing the foundation for collaborative features throughout MMGIS:

1. **MMGIS WebSockets** (`ENABLE_MMGIS_WEBSOCKETS`) - Infrastructure for real-time layer and configuration synchronization in the main MMGIS client, supporting features like:
   - Draw Tool real-time file synchronization
   - Layer update notifications
   - Configuration change alerts

2. **Config WebSockets** (`ENABLE_CONFIG_WEBSOCKETS`) - Infrastructure for administrative interface collaboration, enabling features like:
   - Configuration conflict detection
   - Multi-admin coordination
   - Version control warnings

### WebSocket Modes

#### MMGIS WebSockets (`ENABLE_MMGIS_WEBSOCKETS`)

Provides the underlying infrastructure for real-time collaboration features in the main MMGIS mapping interface. This infrastructure layer enables several user-facing collaborative features:

**Infrastructure Capabilities:**
- **Message Broadcasting** - Real-time relay of updates to all connected clients
- **Connection Management** - Automatic reconnection with exponential backoff
- **Mission-Specific Routing** - Messages filtered by mission name for proper targeting
- **Protocol Upgrade** - HTTP to WebSocket upgrade handling

**Supported Collaborative Features:**
- **Draw Tool Synchronization** - Real-time file updates across multiple users editing the same drawing files
- **Layer Update Notifications** - Alerts when administrators add, modify, or remove layers
- **Configuration Change Detection** - Notifications when mission configuration changes
- **Custom Event Broadcasting** - Infrastructure for future collaborative features (cursor sharing, chat, etc.)

**Message Protocol Types:**
- `addLayer` - Broadcast layer additions to all clients
- `updateLayer` - Broadcast layer modifications
- `removeLayer` - Broadcast layer deletions
- Configuration updates - Generic mission config change notifications

#### Config WebSockets (`ENABLE_CONFIG_WEBSOCKETS`)

Provides infrastructure for multi-administrator collaboration in the Configure interface, enabling safe concurrent configuration editing:

**Infrastructure Capabilities:**
- **Connection Management** - Persistent WebSocket connections for all active Configure sessions
- **Version Tracking** - Configuration version metadata in all messages
- **Mission Filtering** - Ensures admins only receive updates for their current mission
- **Automatic Reconnection** - Connection recovery with retry logic

**Supported Collaborative Features:**
- **Configuration Lock Warnings** - Alerts administrators when another user modifies the configuration
- **Version Conflict Prevention** - Blocks saves that would overwrite concurrent changes
- **Multi-Admin Coordination** - Enables safe collaboration on mission configuration
- **Real-Time Feedback** - Immediate notification of configuration state changes

### WebSocket Architecture

This infrastructure provides the foundation for all real-time collaborative features in MMGIS, using a broadcast-relay pattern for simplicity and reliability.

#### Server-Side Implementation

**Technology Stack:**
- **isomorphic-ws** - Cross-platform WebSocket library providing consistent API across browser and Node.js
- **ws** - Native WebSocket Server implementation for high performance
- **HTTP Upgrade Protocol** - Standard protocol upgrade from HTTP to WebSocket

**Infrastructure Configuration:**
```javascript
Location: API/websocket.js (WebSocket server initialization)
Server Mode: noServer (manual upgrade handling via HTTP server)
Protocol: ws:// (development) or wss:// (production HTTPS with TLS)
Connection Path: {WEBSOCKET_ROOT_PATH || ROOT_PATH}/
Message Pattern: Broadcast-relay (all messages to all connected clients)
Routing: Client-side mission filtering
```

**Design Rationale:**
- **Broadcast-relay pattern** - Simple, reliable, easy to debug; sufficient for typical NASA mission operations team sizes (<50 concurrent users)
- **Client-side filtering** - Reduces server complexity; clients filter messages by mission name
- **No message authentication** - Relies on HTTP session authentication; suitable for trusted network environments
- **No message persistence** - Stateless design; clients responsible for handling missed messages during disconnection

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

This infrastructure enables real-time collaboration across multiple MMGIS features. The WebSocket layer acts as a central nervous system, broadcasting state changes to all connected clients.

#### Feature Integration: Configure Interface

**How Configure Interface Uses This Infrastructure:**
- **Configuration Saves**: When an administrator saves configuration changes via `/API/configure/set`, the server broadcasts the update to all connected Configure clients
- **Version Conflict Detection**: Configure clients receive version metadata to detect concurrent edits
- **UI Lock/Unlock**: Based on incoming messages, the Configure interface locks or unlocks the save button to prevent overwrites

**Broadcast Flow:**
```
1. Admin A saves configuration change
2. Server validates and persists to database (version ID increments)
3. openWebSocket() called with change metadata
4. Server opens client connection to own WebSocket server
5. Message sent with {info: {id: version, mission: "X"}, body: {...}}
6. WebSocket server broadcasts to all connected clients
7. Admin B's Configure client receives message
8. Admin B's client compares message version with local version
9. If mismatch: UI locks with "Configuration changed by another user" warning
10. Admin B must refresh to get latest version before saving
```

**Integration Files:**
- `API/Backend/Config/routes/configs.js` - Triggers broadcasts on config save
- `configure/src/core/Websocket.js` - React Configure client receiver
- `config/js/websocket.js` - Legacy Configure client receiver

#### Feature Integration: Layer Management

**How Layer Management Uses This Infrastructure:**
- **Layer Addition**: When an administrator adds a new layer via Configure, all MMGIS clients receive `addLayer` notification
- **Layer Updates**: Configuration changes to existing layers broadcast as `updateLayer` messages
- **Layer Removal**: Layer deletions broadcast as `removeLayer` messages
- **User Control**: Rather than forcing immediate updates, changes queue for user review via LayerUpdatedControl UI

**Client-Side Processing:**
```javascript
Location: src/essence/Basics/Layers_/Layers_.js
Queue Structure: L_.addLayerQueue[] array
Queue Items: { newLayerName: string, data: config, type: "addLayer|updateLayer|removeLayer" }
User Interface: LayerUpdatedControl button with badge counter
Processing: User clicks "Update" → L_.updateQueueLayers() applies changes
```

**Update Flow:**
```
1. Admin adds layer "Mars CTX" in Configure interface
2. Server saves layer to mission configuration
3. openWebSocket() broadcasts {type: "addLayer", layerName: "Mars CTX", mission: "MSL"}
4. All connected MMGIS clients receive message
5. Clients filter by mission name (skip if different mission)
6. Matching clients queue layer for review: L_.addLayerQueue.push({...})
7. LayerUpdatedControl shows notification badge with count
8. User clicks button to review queued changes
9. Modal displays table of pending updates
10. User clicks "Update" to apply changes
11. L_.addLayerToLayersData() adds new layer to map
12. Queue cleared, control removed
```

**Automated Updates:**
- **Forced Update Path**: If `forceClientUpdate: true` flag set in message, bypasses user confirmation
- **Use Case**: Automated scripts or administrative overrides
- **Implementation**: Immediately calls `L_.updateQueueLayers()` without UI interaction

**Integration Files:**
- `src/essence/essence.js` - WebSocket message receiver, queue populator
- `src/essence/Basics/Layers_/Layers_.js` - Queue management, update application
- `src/essence/Basics/UserInterface_/LayerUpdatedControl.js` - UI notification control

#### Feature Integration: Draw Tool Collaboration

**How Draw Tool Uses This Infrastructure:**
The Draw Tool leverages this WebSocket infrastructure to enable real-time collaborative vector drawing. When multiple users work on the same drawing file, the infrastructure ensures all users see updates immediately.

**Collaborative Drawing Flow:**
```
1. User A adds a polygon to drawing file "Site_Survey_Sol_150"
2. Server persists feature to database (user_features table)
3. Draw Tool backend broadcasts file update via openWebSocket()
4. Message includes {file_id, action: "add", feature_id, geometry, properties}
5. WebSocket infrastructure broadcasts to all connected clients
6. User B (also viewing "Site_Survey_Sol_150") receives message
7. User B's Draw Tool adds feature to local layer without server fetch
8. Both users now see the new polygon in real-time
```

**Synchronization Scenarios:**
- **Feature Addition**: New drawings appear instantly on all users' maps
- **Feature Editing**: Geometry or property changes broadcast immediately
- **Feature Deletion**: Removed features disappear from all users' views
- **File Updates**: Changes to file metadata (name, description, permissions) broadcast to subscribers

**Draw Tool Integration Files:**
- `src/essence/Tools/Draw/DrawTool.js` - Subscribes to file-specific WebSocket messages
- `API/Backend/APIs/Draw.js` - Broadcasts feature CRUD operations
- `API/Backend/APIs/Files.js` - Broadcasts file metadata changes

**Note**: While the WebSocket infrastructure provides the communication layer, the Draw Tool implements its own message protocol and routing logic for file-specific updates. See spec 007 (Interactive Mapping Tools) for Draw Tool implementation details.

#### User Interface Components

**LayerUpdatedControl (Leaflet Control):**
- Shows notification icon when layer updates available
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

This infrastructure spec documents the underlying WebSocket communication layer. User-facing collaborative features that leverage this infrastructure are documented in:

- **007-interactive-mapping-tools** - Draw Tool collaborative editing (uses this infrastructure for real-time file synchronization)
- **005-mission-project-configuration** - Mission configuration system (uses this infrastructure for admin conflict detection)
- **009-layer-and-map-configuration** - Layer management system (uses this infrastructure for layer update notifications)
- **010-administrative-tools** - Configure interface (uses this infrastructure for multi-admin coordination)

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
