# Configure Page (CMS)

The Configure page is MMGIS's admin interface for mission setup, user management, layer configuration, and tool customization. It is a separate React application located in the `configure/` directory.

## Accessing

- Navigate to `http://localhost:8888/configure`
- Requires admin permissions (session permission "111" or "110")
- The first user to sign up automatically becomes the Administrator
- Can be hidden with `HIDE_CONFIG=true`

## Building

The configure page must be built separately:

```bash
cd configure && npm install && npm run build && cd ..
```

Without building, the `/configure` route will show a blank page.

## Tabs

The Configure page is organized into tabs:

### Initial Tab

Sets the initial state of MMGIS on page load:
- **Mission Name and Folder**: Rename the mission (disabled by default)
- **Initial Site**: Override initial view with a predefined site code
- **Initial Latitude/Longitude**: Starting coordinates in decimal degrees
- **Initial Zoom**: Starting zoom level
- **Planet Radius Major/Minor**: Planet dimensions in meters
- **Zoom Level of Map Scale**: Default zoom level for functions

### Overall Tab

Global mission settings and metadata.

### Projection Tab

Configure the map projection for the mission's planetary body.

### Look Tab

Customize the visual appearance and theming.

### Panels Tab

Configure panel layouts and content (logos, images, etc.).

### Time Tab

Configure temporal controls and time-enabled layer behavior.

### Tools Tab

Enable/disable interactive tools and configure their settings per mission.

### Coordinates Tab

Configure coordinate display formats and spatial reference frames.

### Layers Tab

The primary interface for adding, configuring, and managing map layers. See the layer type documentation for details on each layer type.

## Managers

At the bottom of the Configure page:
- **Manage Datasets**: Upload and manage CSV-based tabular datasets
- **Manage Geodatasets**: Upload and manage GeoJSON-based spatial datasets
- **Keys/Tokens**: Manage long-term API tokens for automated access

## Configuration API

The Configure page exposes REST endpoints under `/api/configure/*`. These are restricted to Site Admins only. See `06.2-configure-rest-api.md` for endpoint details.

## WebSocket Coordination

When `ENABLE_CONFIG_WEBSOCKETS=true`, multiple admins editing the same mission configuration are notified of concurrent changes and can optionally override conflicts.
