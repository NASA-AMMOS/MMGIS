# Code Patterns & Project Structure

Copy-paste-modify templates for the main code patterns in MMGIS, plus the detailed directory map.

## Project Structure

```
MMGIS/
├── API/                           # Backend Express server
│   ├── Backend/                  # Feature-domain modules
│   │   ├── Accounts/             # Account management (routes/, setup.js)
│   │   ├── Config/               # Mission configuration (routes/, models/, setup.js)
│   │   ├── Datasets/             # Dataset management (routes/, models/, setup.js)
│   │   ├── Draw/                 # Vector drawing & collaboration (routes/, models/, setup.js)
│   │   ├── Geodatasets/          # Geodata management (routes/, models/, setup.js)
│   │   ├── LongTermToken/        # API token management (routes/, models/, setup.js)
│   │   ├── Shortener/            # URL shortening (routes/, models/, setup.js)
│   │   ├── Stac/                 # STAC catalog integration (routes/, setup.js)
│   │   ├── Users/                # User auth & management (routes/, models/, setup.js)
│   │   ├── Utils/                # Shared backend utilities (routes/)
│   │   ├── Webhooks/             # Webhook processing (routes/, models/, processes/)
│   │   ├── GeneralOptions/       # General options (models/, setup.js)
│   │   └── setupTemplate.js      # Template for new backend modules
│   ├── connection.js             # Database connection config
│   ├── database.js               # Database initialization
│   ├── logger.js                 # Winston logger configuration
│   ├── setups.js                 # Loads all Backend/*/setup.js modules
│   ├── utils.js                  # Shared API utilities
│   └── websocket.js              # WebSocket server setup
├── src/                          # Frontend source code
│   ├── design-system/            # Reusable, generic UI components & theming
│   │   ├── components/           # Generic components (Toast, Modal, Tooltip, Button, Toggle, Dropdown, IconButton)
│   │   ├── themes.js             # Color scheme definitions
│   │   └── themeApplier.js       # Runtime theme application
│   └── essence/                  # Core MMGIS frontend
│       ├── Basics/               # Global singleton controllers
│       │   ├── Layers_/          # L_ — layer lifecycle, visibility, state
│       │   ├── Map_/             # Map_ — 2D rendering (Leaflet)
│       │   ├── Globe_/           # Globe_ — 3D rendering (Cesium/LithoSphere)
│       │   ├── Formulae_/        # F_ — utility/math functions
│       │   ├── ToolController_/  # Tool lifecycle manager
│       │   ├── Viewer_/          # Viewer panel controller
│       │   ├── UserInterface_/   # MMGIS-specific UI (TopBar, Toolbar, Coordinates, CursorInfo)
│       │   ├── TimeControl_/     # Temporal data control and UI
│       │   ├── ComponentController_/ # Component lifecycle manager
│       │   └── Test_/            # Test utilities
│       ├── Tools/                # Interactive tool plugins
│       │   ├── Analysis/         # Data analysis
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
│       │   ├── SegmentTool/      # Segment analysis
│       │   ├── Shade/            # Sun/shadow illumination
│       │   ├── Sites/            # Quick navigation bookmarks
│       │   └── Viewshed/         # Line-of-sight visibility
│       ├── Components/           # Shared UI components
│       ├── Helpers/              # Frontend helper utilities
│       ├── LandingPage/          # Mission selection landing page
│       ├── mmgisAPI/             # JavaScript API for external integration
│       ├── services/             # Frontend service modules
│       └── essence.js            # Main frontend entry point
├── configure/                    # Admin configuration interface (separate React app)
├── scripts/                      # Build and utility scripts
│   ├── build.js                  # Webpack build script
│   ├── server.js                 # Express server startup
│   ├── init-db.js                # Database initialization
│   └── middleware.js             # Request middleware (path validation, auth)
├── tests/                        # Test suite
│   ├── e2e/                     # Playwright E2E tests
│   ├── unit/                    # Jest unit tests
│   ├── pages/                   # Page object models
│   ├── fixtures/                # Test data
│   ├── helpers/                 # Test utilities
│   ├── global-setup.js          # Test environment setup
│   └── test-db-clean.js         # Test database cleanup
├── configuration/                # Build configuration
│   ├── webpack.config.js         # Webpack configuration
│   └── webpackDevServer.config.js # Dev server configuration
├── .knowledge/                   # Agent context: setup, conventions, gotchas
│   ├── AI-GETTING-STARTED.md    # Agent setup guide
│   ├── AI-DEVELOPMENT.md        # Spec-kit workflow guide
│   ├── code-patterns.md         # This file — project tree + code templates
│   ├── conventions-and-gotchas.md # Naming, style, common issues
│   └── knowledge-notes.md       # Auth, DB init, path security gotchas
├── .specify/                     # Spec-kit infrastructure
│   ├── memory/
│   │   └── constitution.md       # Project governance principles
│   ├── templates/                # Spec, plan, tasks templates
│   └── scripts/bash/             # Workflow automation scripts
├── .github/                      # GitHub Actions CI/CD, PR templates, CodeQL
├── specs/                        # Feature specifications (retrospective + new)
├── docs/                         # Jekyll documentation site (docs/pages/)
├── Missions/                     # Mission data storage
├── blueprints/                   # Mission templates (Reference-Mission)
├── adjacent-servers/             # TiTiler, STAC, TiPG, Veloserver proxy configs
├── auxiliary/                    # GDAL tiling and data processing scripts
├── build/                        # Production build output (compiled frontend)
├── examples/                     # Example integrations (ReactWrappedIframe, etc.)
├── private/                      # Private API scripts (Python GDAL raster extraction)
├── public/                       # Static assets, index.html, login pages
├── spice/                        # SPICE kernel download and management
├── views/                        # Pug templates (login, admin login, error pages)
├── AGENTS.md                     # AI agent context (top-level, ~120 lines)
├── CLAUDE.md                     # Claude Code context (references AGENTS.md)
├── Dockerfile                    # Docker image definition
└── docker-compose.sample.yml     # Sample Docker services definition
```

### Key Directories

- **`API/Backend/*/`** — Each backend feature is a self-contained module with `setup.js` (registers routes), `routes/` (Express handlers), and `models/` (Sequelize definitions). See `API/Backend/setupTemplate.js` for the pattern.
- **`src/design-system/`** — Generic, reusable UI components and theming. Components here (Toast, Modal, Tooltip, Button, Toggle, Dropdown, IconButton) are **not MMGIS-specific**. New generic UI components belong here.
- **`src/essence/Basics/UserInterface_/`** — MMGIS-specific UI (TopBar, Toolbar, Coordinates, CursorInfo, BottomBar). Tightly coupled to MMGIS state. **Do not place generic components here** — use `src/design-system/` instead.
- **`src/essence/Tools/`** — Plugin-based interactive mapping tools. Each tool is self-contained with `make()`/`destroy()` lifecycle.
- **`src/essence/Basics/Layers_/`** — The `L_` singleton — manages all layer state, visibility, and lifecycle. One of the most important modules.
- **`src/essence/Basics/Map_/`** — The `Map_` singleton — core 2D map rendering engine (Leaflet).
- **`configure/`** — Separate admin interface for mission configuration. Needs its own `npm install && npm run build`.
- **`specs/`** — Feature specifications following spec-kit format.

---

## Express Route Handler

```javascript
// API/Backend/FeatureName/routes/featurename.js
const express = require("express");
const router = express.Router();
const logger = require("../../../logger");
const database = require("../../../database");
const { sequelize } = require("../../../connection");

router.post("/", async (req, res) => {
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
    logger("error", "Error in /api/feature:", "FeatureName", null, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = { router };
```

### Backend Module setup.js

```javascript
// API/Backend/FeatureName/setup.js
const routerFeature = require("./routes/featurename").router;

let setup = {
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/featurename",
      s.ensureUser(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      routerFeature
    );
  },
  onceSynced: (s) => {
    // Called after sequelize.sync() — run migrations here
  },
};

module.exports = setup;
```

## Sequelize Model

```javascript
// API/Backend/FeatureName/models/featurename.js
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const logger = require("../../../logger");

const attributes = {
  name: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false,
  },
  geometry: {
    type: Sequelize.DataTypes.GEOMETRY("POINT", 4326),
    allowNull: true,
  },
};

const FeatureName = sequelize.define("feature_name", attributes);

const up = async () => {
  // Schema migrations — runs in onceSynced callback
  // ALTER TABLE ... ADD COLUMN IF NOT EXISTS
};

module.exports = { FeatureName, up };
```

## Frontend Tool Plugin

```javascript
// src/essence/Tools/ToolName/ToolNameTool.js
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

  let tools = $("#toolPanel");
  tools.css("background", "var(--color-k)");
  tools.empty();
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
// API/websocket.js
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
