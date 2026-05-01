# MMGIS Directory Structure

Full project directory tree with descriptions.

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
│   └── build/                    # Configuration UI build output
├── docs/                         # Documentation (Jekyll site)
│   └── pages/                    # Documentation pages by category
├── public/                       # Static assets
├── Missions/                     # Mission data storage (per-mission subdirs)
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
├── knowledge/                    # AI agent knowledge base (this directory)
│   ├── reference/                # Detailed reference material
│   ├── AI-GETTING-STARTED.md     # Agent setup guide
│   └── AI-DEVELOPMENT.md         # Spec-kit workflow guide
├── blueprints/                   # Mission blueprints and templates
│   └── Missions/
│       └── Reference-Mission/    # Demo/testing mission blueprint
├── adjacent-servers/             # Proxy logic for TiTiler, STAC, OGC services
├── auxiliary/                    # Data processing scripts (tiling, GDAL)
├── configuration/                # Project configurations
│   └── webpack.config.js         # Webpack configuration
├── package.json                  # Root package.json (build scripts)
├── sample.env                    # Environment variable template
├── docker-compose.sample.yml     # Sample Docker services definition
├── Dockerfile                    # Docker image definition
├── AGENTS.md                     # AI agent context (top-level, this file)
└── CLAUDE.md                     # Claude Code context (references AGENTS.md)
```

## Key Directories

### Backend

- **`API/Backend/APIs/`** — RESTful endpoint handlers. Each file handles a feature area (auth, files, drawing, etc.)
- **`API/Backend/Databases/`** — Sequelize ORM models and database migrations

### Frontend

- **`src/design-system/`** — Generic, reusable UI components and theming. Components here (Toast, Modal, Tooltip, Button, Toggle, Dropdown, IconButton) are **not MMGIS-specific**. New generic UI components belong here.
- **`src/essence/Basics/UserInterface_/`** — MMGIS-specific UI components (TopBar, Toolbar, Coordinates, CursorInfo, BottomBar). Tightly coupled to MMGIS state. **Do not place generic components here.**
- **`src/essence/Tools/`** — Plugin-based interactive mapping tools. Each tool is self-contained.
- **`src/essence/Basics/Map_.js`** — Core map rendering engine managing both Leaflet (2D) and Cesium (3D)
- **`src/essence/Basics/TimeControl_/`** — Temporal data control system

### Configuration & Admin

- **`configure/`** — Separate React admin app (needs its own `npm install && npm run build`)
- **`specs/`** — Feature specifications following spec-kit format
- **`.specify/`** — Spec-kit infrastructure and constitution
