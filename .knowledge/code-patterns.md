# Code Patterns & Project Structure

Copy-paste-modify templates for the main code patterns in MMGIS, plus the detailed directory map.

## Project Structure

```
MMGIS/
├── API/                           # Backend Express server
│   ├── Backend/
│   │   ├── APIs/                 # RESTful endpoint handlers
│   │   │   ├── routes.js         # Main route definitions
│   │   │   ├── User.js           # User management & auth
│   │   │   ├── Files.js          # File upload/download
│   │   │   ├── Geodatasets.js    # Geodata management
│   │   │   ├── Draw.js           # Vector drawing & collaboration
│   │   │   └── Websocket.js      # Real-time WebSocket server
│   │   ├── Databases/            # Sequelize models & migrations
│   │   └── Utils/                # Backend utilities
│   ├── connection.js             # Database connection config
│   ├── database.js               # Database initialization
│   ├── logger.js                 # Winston logger configuration
│   └── websocket.js              # WebSocket server setup
├── src/                          # Frontend source code
│   ├── design-system/            # Reusable, generic UI components & theming
│   │   ├── components/           # Generic components (Toast, Modal, Tooltip, Button, etc.)
│   │   ├── themes.js             # Color scheme definitions
│   │   └── themeApplier.js       # Runtime theme application
│   └── essence/
│       ├── Basics/               # Core map/MMGIS-specific functionality
│       │   ├── Map_.js           # Map rendering engine (Leaflet/Cesium)
│       │   ├── UserInterface_/   # MMGIS-specific UI (TopBar, Toolbar, Coordinates, CursorInfo)
│       │   └── TimeControl_/     # Temporal data control and UI
│       ├── Tools/                # Interactive tool plugins (16 core tools)
│       │   ├── Animation/        # Map animation creation (GIF/MP4)
│       │   ├── Chemistry/        # Chemical composition visualization
│       │   ├── Curtain/          # GPR subsurface imagery
│       │   ├── Draw/             # Collaborative vector drawing
│       │   ├── Identifier/       # Pixel value queries
│       │   ├── Info/             # Feature property display
│       │   ├── Isochrone/        # Terrain traversability analysis
│       │   ├── Kinds/            # Layer click behavior configuration
│       │   ├── Layers/           # Layer management interface
│       │   ├── Legend/           # Map legend display
│       │   ├── Measure/          # Distance & elevation profiles
│       │   ├── Query/            # Spatial query interface
│       │   ├── Shade/            # Sun/shadow illumination
│       │   ├── Sites/            # Quick navigation bookmarks
│       │   └── Viewshed/         # Line-of-sight visibility
│       └── Ancillary/            # UI components and helpers
├── configure/                    # Admin configuration interface (separate React app)
├── docs/                         # Documentation (Jekyll site)
├── public/                       # Static assets
├── Missions/                     # Mission data storage
├── scripts/                      # Build and utility scripts
│   ├── build.js                  # Webpack build script
│   ├── server.js                 # Express server startup
│   └── init-db.js                # Database initialization
├── .specify/                     # Spec-kit infrastructure
│   ├── memory/
│   │   └── constitution.md       # Project governance principles
│   ├── templates/                # Spec, plan, tasks templates
│   └── scripts/bash/             # Workflow automation scripts
├── specs/                        # Feature specifications (retrospective + new)
├── configuration/
│   └── webpack.config.js         # Webpack configuration
├── docker-compose.sample.yml     # Sample Docker services definition
├── Dockerfile                    # Dockerfile definition
└── auxiliary/                    # GDAL tiling and data processing scripts
```

### Key Directories

- **`API/Backend/APIs/`** — RESTful endpoint handlers. Each file handles a feature area (auth, files, drawing, etc.)
- **`API/Backend/Databases/`** — Sequelize ORM models and database migrations
- **`src/design-system/`** — Generic, reusable UI components and theming. Components here (Toast, Modal, Tooltip, Button, Toggle, Dropdown, IconButton) are **not MMGIS-specific**. New generic UI components belong here.
- **`src/essence/Basics/UserInterface_/`** — MMGIS-specific UI (TopBar, Toolbar, Coordinates, CursorInfo, BottomBar). Tightly coupled to MMGIS state. **Do not place generic components here** — use `src/design-system/` instead.
- **`src/essence/Tools/`** — Plugin-based interactive mapping tools. Each tool is self-contained.
- **`src/essence/Basics/Map_.js`** — Core map rendering engine managing both Leaflet (2D) and Cesium (3D)
- **`configure/`** — Separate admin interface for mission configuration. Needs its own `npm install && npm run build`.
- **`specs/`** — Feature specifications following spec-kit format

---

## Express Route Handler

```javascript
// API/Backend/APIs/FeatureName.js
const express = require("express");
const router = express.Router();
const authenticate = require("../Utils/authenticate");

router.post("/api/feature", authenticate, async (req, res) => {
  try {
    // Validate input
    const { field } = req.body;
    if (!field) {
      return res.status(400).json({ error: "field is required" });
    }

    // Business logic
    const result = await SomeModel.create({ field });

    // Response
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in /api/feature:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
```

## Sequelize Model

```javascript
// API/Backend/Databases/models/ModelName.js
module.exports = (sequelize, DataTypes) => {
  const ModelName = sequelize.define(
    "ModelName",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      geometry: {
        type: DataTypes.GEOMETRY("POINT", 4326), // PostGIS geometry
        allowNull: true,
      },
    },
    {
      tableName: "model_name",
      timestamps: true,
    },
  );

  ModelName.associate = function (models) {
    // Define associations
  };

  return ModelName;
};
```

## Frontend Tool Plugin

```javascript
// src/essence/Tools/ToolName/ToolName.js
import $ from "jquery";
import F_ from "../../Basics/Formulae_/Formulae_";
import L_ from "../../Basics/Layers_/Layers_";
import Map_ from "../../Basics/Map_/Map_";

const markup = [`<div id='toolName'>`, `</div>`].join("\n");

const ToolName = {
  height: 0,
  width: 300,
  MMGISInterface: null,
  make: function () {
    this.MMGISInterface = new interfaceWithMMGIS();
  },
  destroy: function () {
    this.MMGISInterface.separateFromMMGIS();
  },
  getUrlString: function () {
    return "";
  },
};

function interfaceWithMMGIS() {
  this.separateFromMMGIS = function () {
    separateFromMMGIS();
  };

  // MMGIS should always have a div with id 'toolPanel'
  let tools = $("#toolPanel");
  tools.css("background", "var(--color-k)");
  // Clear it
  tools.empty();
  // Add the markup to tools
  tools.html('<div style="height: 100%">' + markup + "</div>");

  // Add event functions and whatnot

  function separateFromMMGIS() {
    // Event cleanup
  }
}

export default ToolName;
```

## WebSocket Message Handler

```javascript
// API/Backend/APIs/Websocket.js
ws.on("message", function (message) {
  try {
    const msg = JSON.parse(message);

    // Validate message structure
    if (!msg.type || !msg.room) {
      return ws.send(JSON.stringify({ error: "Invalid message format" }));
    }

    // Authenticate
    if (!isAuthenticated(ws.userId)) {
      return ws.send(JSON.stringify({ error: "Unauthorized" }));
    }

    // Route message
    switch (msg.type) {
      case "draw":
        broadcastToRoom(msg.room, msg, ws);
        break;
      default:
        ws.send(JSON.stringify({ error: "Unknown message type" }));
    }
  } catch (err) {
    console.error("WebSocket error:", err);
    ws.send(JSON.stringify({ error: "Invalid JSON" }));
  }
});
```
