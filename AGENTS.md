# MMGIS - AI Agent Context

**Project**: MMGIS (Multi-Mission Geographic Information System)
**Version**: 4.1.18
**Last Updated**: 2025-12-18

## Important Instructions

Use the Serena MCP tools when possible for code analysis, symbol navigation, and code modifications.

## Project Overview

**MMGIS** is a web-based mapping and localization solution for science operations on planetary missions, developed by NASA-AMMOS. It provides spatial data infrastructure for mission-critical geospatial visualization and collaboration, supporting both 2D (Leaflet) and 3D (Cesium) mapping with real-time multi-user collaboration.

**Primary Use Case**: Planetary science missions (Mars rovers, lunar operations, etc.) requiring accurate geospatial data visualization, annotation, and team collaboration.

## Quick Start

**Setup**:
```bash
# Install dependencies
npm install

# Set up environment
cp sample.env .env
# Edit .env with your database credentials

# Initialize database and start server
npm start
```

**Build**:
```bash
# Production build
npm run build

# Development build with watch
npm run build:dev
```

**Test**:
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

**Docker**:
```bash
# Build image
docker build -t mmgis .

# Run with docker-compose
docker-compose up -d
```

## Development Workflow with Spec-Kit

This project uses **spec-kit** for feature development. All new features must follow the documentation-first workflow:

### Workflow Commands

1. **Specify**: `/speckit.specify "feature description"`
   - Creates spec.md with requirements and user scenarios
   - Ensures clear understanding before implementation

2. **Plan**: `/speckit.plan`
   - Creates plan.md with technical design
   - Documents architecture and decisions
   - Checks against constitution principles

3. **Tasks**: `/speckit.tasks`
   - Creates tasks.md with breakdown of work
   - Each task is 1-2 days of work maximum
   - Tracks dependencies and blockers

4. **Implement**: `/speckit.implement`
   - Executes tasks from tasks.md
   - Updates task status as work progresses
   - Ensures constitution compliance

5. **Checklist**: `/speckit.checklist`
   - Validates readiness for deployment
   - Checks quality, security, testing, docs

**See `AI-DEVELOPMENT.md` for complete workflow guide and examples.**

## Project Structure

```
MMGIS/
├── API/                           # Backend Express server
│   ├── Backend/
│   │   ├── APIs/                 # RESTful endpoint handlers
│   │   │   ├── routes.js         # Main route definitions
│   │   │   ├── User.js           # User management & auth
│   │   │   ├── Files.js          # File upload/download (MinIO)
│   │   │   ├── Geodatasets.js    # Geodata management
│   │   │   ├── Draw.js           # Vector drawing & collaboration
│   │   │   └── Websocket.js      # Real-time WebSocket server
│   │   ├── Databases/            # Sequelize models & migrations
│   │   └── Utils/                # Backend utilities
│   ├── index.js                  # Server entry point
│   └── package.json              # Backend dependencies
├── src/                          # Frontend source code
│   └── essence/
│       ├── Basics/               # Core map functionality
│       │   └── Map_.js           # Map rendering engine (Leaflet/Cesium)
│       ├── Tools/                # Interactive tool plugins (16+ tools)
│       │   ├── Draw/             # Drawing tool frontend
│       │   ├── Globe/            # 3D Cesium globe
│       │   ├── Measure/          # Measurement tools
│       │   ├── Query/            # Spatial query interface
│       │   ├── TimeControl/      # Temporal data control
│       │   └── [13 more tools]
│       └── Ancillary/            # UI components and helpers
├── configure/                    # Admin configuration interface
│   └── public/                   # Configuration UI
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
├── package.json                  # Root package.json (build scripts)
├── webpack.config.js             # Webpack configuration
└── docker-compose.yml            # Docker services definition
```

### Key Directories

- **`API/Backend/APIs/`** - RESTful endpoint handlers. Each file handles a feature area (auth, files, drawing, etc.)
- **`API/Backend/Databases/`** - Sequelize ORM models and database migrations
- **`src/essence/Tools/`** - Plugin-based interactive mapping tools. Each tool is self-contained with defined interfaces.
- **`src/essence/Basics/Map_.js`** - Core map rendering engine managing both Leaflet (2D) and Cesium (3D)
- **`configure/`** - Separate admin interface for mission configuration, user management, and tool setup
- **`specs/`** - Feature specifications following spec-kit format

## Active Features

_Features documented during retrospective initialization. See individual specs for details._

### 001-authentication-and-user-management
OAuth2 and local authentication with role-based access control for user identity management.
📄 Spec: [specs/001-authentication-and-user-management/spec.md](specs/001-authentication-and-user-management/spec.md)
📋 Plan: [specs/001-authentication-and-user-management/plan.md](specs/001-authentication-and-user-management/plan.md)
**Status**: ✅ Implemented and deployed

### 002-geodata-management-and-tile-serving
File upload, geodataset management, vector/raster tile serving with MinIO storage integration.
📄 Spec: [specs/002-geodata-management-and-tile-serving/spec.md](specs/002-geodata-management-and-tile-serving/spec.md)
📋 Plan: [specs/002-geodata-management-and-tile-serving/plan.md](specs/002-geodata-management-and-tile-serving/plan.md)
**Status**: ✅ Implemented and deployed

### 003-vector-drawing-and-collaboration
Real-time collaborative vector drawing with feature history tracking and GeoJSON export.
📄 Spec: [specs/003-vector-drawing-and-collaboration/spec.md](specs/003-vector-drawing-and-collaboration/spec.md)
📋 Plan: [specs/003-vector-drawing-and-collaboration/plan.md](specs/003-vector-drawing-and-collaboration/plan.md)
**Status**: ✅ Implemented and deployed

### 004-websocket-real-time-communication
WebSocket server for real-time collaboration features including cursor sharing and chat.
📄 Spec: [specs/004-websocket-real-time-communication/spec.md](specs/004-websocket-real-time-communication/spec.md)
📋 Plan: [specs/004-websocket-real-time-communication/plan.md](specs/004-websocket-real-time-communication/plan.md)
**Status**: ✅ Implemented and deployed

### 005-mission-project-configuration
Mission creation and configuration with layer management and tool customization.
📄 Spec: [specs/005-mission-project-configuration/spec.md](specs/005-mission-project-configuration/spec.md)
📋 Plan: [specs/005-mission-project-configuration/plan.md](specs/005-mission-project-configuration/plan.md)
**Status**: ✅ Implemented and deployed

### 006-dual-map-rendering-engines
Synchronized 2D (Leaflet) and 3D (Cesium) map rendering with custom projections.
📄 Spec: [specs/006-dual-map-rendering-engines/spec.md](specs/006-dual-map-rendering-engines/spec.md)
📋 Plan: [specs/006-dual-map-rendering-engines/plan.md](specs/006-dual-map-rendering-engines/plan.md)
**Status**: ✅ Implemented and deployed

### 007-interactive-mapping-tools
Plugin-based tool system with 16+ interactive tools (measure, query, search, etc.).
📄 Spec: [specs/007-interactive-mapping-tools/spec.md](specs/007-interactive-mapping-tools/spec.md)
📋 Plan: [specs/007-interactive-mapping-tools/plan.md](specs/007-interactive-mapping-tools/plan.md)
**Status**: ✅ Implemented and deployed

### 008-data-visualization
Time series charts, spectral plots, cross-section views, and statistical analysis.
📄 Spec: [specs/008-data-visualization/spec.md](specs/008-data-visualization/spec.md)
📋 Plan: [specs/008-data-visualization/plan.md](specs/008-data-visualization/plan.md)
**Status**: ✅ Implemented and deployed

### 009-layer-and-map-configuration
Layer styling, data source configuration, visibility controls, and legend management.
📄 Spec: [specs/009-layer-and-map-configuration/spec.md](specs/009-layer-and-map-configuration/spec.md)
📋 Plan: [specs/009-layer-and-map-configuration/plan.md](specs/009-layer-and-map-configuration/plan.md)
**Status**: ✅ Implemented and deployed

### 010-administrative-tools
Admin configuration UI for mission setup, user management, and permission controls.
📄 Spec: [specs/010-administrative-tools/spec.md](specs/010-administrative-tools/spec.md)
📋 Plan: [specs/010-administrative-tools/plan.md](specs/010-administrative-tools/plan.md)
**Status**: ✅ Implemented and deployed

## Architecture

### Tech Stack

**Backend**:
- **Framework**: Express 4.18 (Node.js 20+)
- **Database**: PostgreSQL with PostGIS (geospatial extension)
- **ORM**: Sequelize 6.33
- **Authentication**: Passport.js (local, Google OAuth, GitHub OAuth, LDAP)
- **Storage**: MinIO (S3-compatible object storage)
- **WebSocket**: ws library for real-time communication
- **Session**: express-session with connect-pg-simple

**Frontend**:
- **Languages**: JavaScript (ES6+), TypeScript (partial), SCSS
- **Build**: Webpack 5
- **UI**: Custom jQuery-based UI with Materialize CSS
- **Mapping**:
  - Leaflet 1.x (2D slippy maps)
  - Cesium 1.121 (3D globe with terrain)
- **Visualization**: Chart.js, D3.js, ECharts
- **Geospatial**: Turf.js, Proj4js, GeoTIFF

**Testing**:
- **Framework**: Jest 29
- **Coverage Target**: 80% (see constitution)

**CI/CD**:
- **Platform**: GitHub Actions
- **Deployment**: Docker with docker-compose

### Architectural Patterns

**Backend**:
- **Pattern**: Layered architecture
- **Structure**: Routes → Controllers (APIs/*.js) → Models (Databases/*.js) → PostgreSQL
- **API Design**: RESTful with WebSocket for real-time features
- **Authentication**: Middleware-based with Passport strategies

**Frontend**:
- **Pattern**: Tool plugin architecture
- **Structure**: Modular tools with defined interfaces (Tool_.js base class)
- **Communication**: Custom event bus for inter-tool communication
- **Rendering**: Dual-engine (Leaflet + Cesium) with synchronized views
- **State Management**: Custom global state object with event-driven updates

**Geospatial Data Flow**:
```
User Upload → MinIO Storage → Backend Processing → PostGIS → Tile Generation → Frontend Rendering
                                                   ↓
                                         Vector/Raster Tiles
```

## Constitution & Governance

This project follows 7 core principles defined in `.specify/memory/constitution.md`:

### I. Documentation-First Development
All features require spec.md before implementation. No code without documentation.

### II. Clear Requirements
Requirements must be specific, measurable, and testable with clear acceptance criteria.

### III. Incremental Delivery
Features delivered in small chunks (1-2 day tasks) that can be independently tested and deployed.

### IV. Quality Standards
- **ESLint**: Must pass with no errors
- **Test Coverage**: 80% minimum
- **Security**: Input validation, no SQL injection, XSS prevention
- **Code Review**: All PRs require approval

### V. Node.js and Web Mapping Best Practices
- Async/await over callbacks
- Proper error handling
- GeoJSON as standard format
- Leaflet for 2D, Cesium for 3D
- Sequelize ORM for database

### VI. Geospatial Data Integrity
- Always specify CRS explicitly
- Validate geodata on ingestion
- Test coordinate transformations
- Document projection choices
- Maintain data provenance

### VII. Real-time Collaboration Safety
- Authenticate all WebSocket connections
- Validate message payloads
- Handle concurrent edits gracefully
- Rate limit message frequency
- Test with multiple users (10+)

**All code must comply with these principles before merging.**

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server (backend + frontend watch)
npm start

# Start backend only
node scripts/server.js

# Build frontend with watch
npm run build:dev

# Lint code
npm run lint
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.js
```

### Database
```bash
# Initialize database
node scripts/init-db.js

# Run migrations
npm run migrate

# Seed database
npm run seed
```

### Docker
```bash
# Build Docker image
docker build -t mmgis .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f mmgis

# Stop services
docker-compose down
```

### Deployment
```bash
# Production build
npm run build

# Start production server
npm run start:prod

# Deploy bundle
npm run deploy:bundle
```

## Code Patterns

### Backend: Express Route Handler

```javascript
// API/Backend/APIs/FeatureName.js
const express = require('express');
const router = express.Router();
const authenticate = require('../Utils/authenticate');

router.post('/api/feature', authenticate, async (req, res) => {
    try {
        // Validate input
        const { field } = req.body;
        if (!field) {
            return res.status(400).json({ error: 'field is required' });
        }

        // Business logic
        const result = await SomeModel.create({ field });

        // Response
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        console.error('Error in /api/feature:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
```

### Backend: Sequelize Model

```javascript
// API/Backend/Databases/models/ModelName.js
module.exports = (sequelize, DataTypes) => {
    const ModelName = sequelize.define('ModelName', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        geometry: {
            type: DataTypes.GEOMETRY('POINT', 4326), // PostGIS geometry
            allowNull: true
        }
    }, {
        tableName: 'model_name',
        timestamps: true
    });

    ModelName.associate = function(models) {
        // Define associations
    };

    return ModelName;
};
```

### Frontend: Tool Plugin

```javascript
// src/essence/Tools/ToolName/ToolName.js
define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_'
], function($, d3, F_, L_) {
    const ToolName = {
        height: 0,
        width: 280,

        make: function() {
            // Initialize tool UI
            this.MMGISInterface = new interfaceWithMMGIS();
        },

        destroy: function() {
            // Cleanup on tool close
            this.MMGISInterface.separateFromMMGIS();
        }
    };

    function interfaceWithMMGIS() {
        this.separateFromMMGIS = function() {
            // Event cleanup
        };
    }

    return ToolName;
});
```

### WebSocket Message Handling

```javascript
// API/Backend/APIs/Websocket.js
ws.on('message', function(message) {
    try {
        const msg = JSON.parse(message);

        // Validate message structure
        if (!msg.type || !msg.room) {
            return ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }

        // Authenticate
        if (!isAuthenticated(ws.userId)) {
            return ws.send(JSON.stringify({ error: 'Unauthorized' }));
        }

        // Route message
        switch (msg.type) {
            case 'draw':
                broadcastToRoom(msg.room, msg, ws);
                break;
            default:
                ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
    } catch (err) {
        console.error('WebSocket error:', err);
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
});
```

## Configuration

### Environment Variables (.env)

**Required**:
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASS` - Database password
- `NODE_ENV` - Environment (development | production)
- `PORT` - Server port (default: 8888)
- `SESSION_SECRET` - Secret for session encryption

**Optional**:
- `MINIO_ENDPOINT` - MinIO endpoint for file storage
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `WITH_STAC` - Enable STAC service (true/false)
- `WITH_TITILER` - Enable TiTiler service (true/false)

**See full list**: [Environment Variables Documentation](https://nasa-ammos.github.io/MMGIS/setup/envs)

### Config Files

- **`webpack.config.js`** - Frontend build configuration
- **`jest.config.js`** - Test configuration
- **`.eslintrc.js`** - Linting rules
- **`tsconfig.json`** - TypeScript configuration (partial)
- **`docker-compose.yml`** - Docker services (MMGIS, PostgreSQL, MinIO, STAC, TiTiler)
- **`API/Backend/Databases/config.json`** - Sequelize database configuration

## Testing Strategy

### Unit Tests
- **Location**: Alongside source files (`*.test.js`, `*.spec.js`)
- **Coverage**: Business logic, utility functions, data transformations
- **Framework**: Jest with JSDOM for browser APIs
- **Run**: `npm test`

### Integration Tests
- **Location**: `API/Backend/**/*.test.js`
- **Coverage**: API endpoints, database interactions, authentication flows
- **Run**: `npm test -- --testPathPattern=API`

### E2E Tests
- **Location**: TBD (consider adding Playwright or Cypress)
- **Coverage**: Critical user workflows (drawing, mission config, collaboration)

### Coverage Target
- **Minimum**: 80% overall
- **Critical paths**: 100% (auth, data validation, geospatial transformations)

**Check coverage**: `npm test -- --coverage`

## Key Conventions

### Naming Conventions
- **Files**: PascalCase for modules (e.g., `User.js`, `Map_.js`)
- **Directories**: camelCase (e.g., `essence/`, `Ancillary/`)
- **Variables**: camelCase (e.g., `userName`, `geodatasetId`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DB_HOST`, `API_URL`)
- **CSS Classes**: kebab-case (e.g., `.tool-panel`, `.map-container`)

### Code Style
- **Indentation**: 4 spaces (enforced by ESLint)
- **Quotes**: Single quotes for strings
- **Semicolons**: Optional but consistent within file
- **Line length**: 100 characters preferred
- **Async**: Use async/await over callbacks and raw promises

### Git Workflow
- **Branches**:
  - `master` - Main production branch
  - `feature/NNN-feature-name` - Feature branches (from spec-kit)
  - `hotfix/description` - Emergency fixes
- **Commits**:
  - Start with feature number if applicable: `[001] Add OAuth2 authentication`
  - Use imperative mood: "Add feature" not "Added feature"
- **PRs**:
  - Reference spec in description: `Implements specs/001-auth/spec.md`
  - Include checklist from spec-kit
  - Link to related issues

### Tool Plugin Conventions
- Each tool is a self-contained module in `src/essence/Tools/ToolName/`
- Implement `make()` and `destroy()` lifecycle methods
- Use `interfaceWithMMGIS()` for event handling and cleanup
- Register tool in configuration UI

## Troubleshooting

### Issue: Database connection fails
**Solution**:
- Check `.env` has correct `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`
- Verify PostgreSQL is running: `docker-compose ps`
- Check PostgreSQL logs: `docker-compose logs db`

### Issue: WebSocket connections not working
**Solution**:
- Ensure WebSocket port is not blocked by firewall
- Check browser console for WebSocket errors
- Verify authentication is working (WebSocket requires valid session)
- Review `API/Backend/APIs/Websocket.js` logs

### Issue: Maps not rendering
**Solution**:
- Check browser console for Leaflet/Cesium errors
- Verify tile URLs are accessible
- Check mission configuration in configure interface
- Ensure layers are enabled and visible

### Issue: File upload fails
**Solution**:
- Verify MinIO is running: `docker-compose ps`
- Check MinIO credentials in `.env`
- Ensure `Missions/` directory is writable
- Check file size limits in Express configuration

### Issue: Build fails with Webpack errors
**Solution**:
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for syntax errors in modified files
- Review `webpack.config.js` for misconfigurations
- Check Node.js version (requires 20+)

## References

- **Official Documentation**: https://nasa-ammos.github.io/MMGIS/
- **GitHub Repository**: https://github.com/NASA-AMMOS/MMGIS
- **Constitution**: `.specify/memory/constitution.md`
- **Spec-Kit Workflow**: `AI-DEVELOPMENT.md`
- **API Documentation**: Swagger UI at `/api-docs` when server running
