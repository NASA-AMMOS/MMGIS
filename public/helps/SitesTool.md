## Tool: Sites

_Quick navigation bookmarks for predefined map locations._

### Overview

The Sites Tool provides a list of predefined locations that users can quickly navigate to. Each site defines a map view (center coordinates and zoom level) along with optional layer visibility overrides.

### Interface

Select a site from the list to navigate the map to that location. The active site is highlighted in the toolbar.

### Configuration

| Variable | Description |
|---|---|
| `sites` | Array of site objects, each with `code`, `view` (lat, lng, zoom), and optional `on`/`off` layer overrides |
