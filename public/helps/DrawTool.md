## Tool: Draw

_Collaborative vector drawing and annotation on the map._

### Overview

The Draw Tool enables users to create, edit, and manage vector features (points, lines, polygons, arrows, circles, and text) on the map. Drawings are organized into files and support real-time multi-user collaboration via WebSocket synchronization.

### Interface

#### Navigation Tabs

- **Draw** — Create new features and manage drawing tools.
- **Features** — Browse and manage drawn features across files.
- **History** — View change history for drawing files.

#### Drawing Shapes

- **Point** — Place a single point marker on the map.
- **Line** — Draw a polyline by clicking successive points.
- **Polygon** — Draw a closed polygon area.
- **Arrow** — Draw a directional arrow between two points.
- **Circle** — Draw a circle by center and radius.
- **Text** — Place a text annotation on the map.

#### Files

Drawings are organized into named files. Each file can contain multiple features and supports:

- **Lead Maps** — Primary shared map files managed by designated leads.
- **Published Maps** — Finalized maps available to all users.
- **File creation** — Create new drawing files to organize features.
- **Review mode** — Compare and review changes between drawing versions.

### Configuration

| Variable | Description |
|---|---|
| `intentFields` | Custom metadata fields for drawn features |
| `hoverLengthOnLines` | Show segment lengths on line hover |
| `defaultPublicFilter` | Default visibility filter for public files |
