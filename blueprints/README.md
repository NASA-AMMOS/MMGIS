# MMGIS Blueprints

**Blueprints** are reusable mission templates that ship with MMGIS. Each blueprint under `Missions/` contains a complete configuration file, optional layer data, and optional geodatasets — everything needed to bootstrap a working mission via the Configure page.

## Directory Structure

```
blueprints/
├── README.md                           ← you are here
└── Missions/
    ├── Reference-Mission/              ← Earth demo (default variant)
    │   ├── config.reference-mission.json
    │   ├── Layers/                     ← tile, vector, model, and image data
    │   ├── Geodatasets/                ← geodataset CSVs for auto-import
    │   └── Data/                       ← DEMs, COGs, and other raster data
    └── Reference-Mission-Lunar-SouthPole/  ← Lunar South Pole variant
        ├── config.reference-mission-lunar-southpole.json
        ├── Layers/
        │   └── SPole_100m/             ← south pole basemap tiles (z/x/y.png)
        └── Geodatasets/
```

## Reference Mission Variants

The **Reference Mission** system supports multiple variants. Each variant is a self-contained blueprint targeting a different planetary body, projection, or use case.

| Variant Key | Mission Name | Body | Projection | Description |
|-------------|-------------|------|------------|-------------|
| `default` | Reference-Mission | Earth | EPSG:3857 (Web Mercator) | Full-featured demo with 20+ layers and 14 tools |
| `Lunar-SouthPole` | Reference-Mission-Lunar-SouthPole | Moon | IAU2000:30120 (South Polar Stereographic) | Lunar south pole mission with basemap tiles |

### Creating a Reference Mission

1. Navigate to the Configure page at `http://localhost:8888/configure`
2. Click **New Mission**
3. Check **Setup Reference Mission Demo**
4. Select a variant from the dropdown (Earth Default or Lunar South Pole)
5. Click **Make Mission**

If the mission already exists, it will be updated to the latest blueprint version.

### Managing Blueprints (Development Mode)

When viewing a Reference Mission variant in the Configure page with `NODE_ENV=development`, the Home tab provides:

- **Save to Base Blueprint** — persists the current working config back to the blueprint's config file in `blueprints/Missions/`
- **Load from Template** — resets the mission config to the blueprint version

This workflow lets developers iterate on the config in the UI, then save changes back to the repository.

---

## Adding a New Reference Mission Variant

To add a new variant (e.g. a Mars equatorial mission), follow these steps:

### 1. Create the Blueprint Directory

```
blueprints/Missions/Reference-Mission-Mars-Equatorial/
├── config.reference-mission-mars-equatorial.json
├── Layers/
│   └── .gitkeep
└── Geodatasets/
    └── .gitkeep
```

The config file should contain the full MMGIS config JSON with appropriate projection, look, panels, layers, and tools. Use an existing variant config as a starting point.

### 2. Register the Variant in the Backend

Add an entry to `REFERENCE_MISSION_VARIANTS` in `API/Backend/Utils/missionTemplates.js`:

```javascript
const REFERENCE_MISSION_VARIANTS = {
    default: { /* ... */ },
    'Lunar-SouthPole': { /* ... */ },
    // Add your new variant:
    'Mars-Equatorial': {
        missionName: 'Reference-Mission-Mars-Equatorial',
        blueprintDir: 'Reference-Mission-Mars-Equatorial',
        configFile: 'config.reference-mission-mars-equatorial.json',
        label: 'Mars Equatorial',
        description: 'Equirectangular Mars mission (IAU2000:49910)',
    },
};
```

Required fields:
| Field | Purpose |
|-------|---------|
| `missionName` | Name used in the database and file system (`Missions/<missionName>/`) |
| `blueprintDir` | Directory name under `blueprints/Missions/` |
| `configFile` | Config filename inside the blueprint directory |
| `label` | Short label shown in the Configure page dropdown |
| `description` | One-line description shown in the dropdown |

### 3. Register the Variant in the Frontend

Add a matching entry to `REFERENCE_MISSION_VARIANTS` in `configure/src/components/Panel/Modals/NewMissionModal/NewMissionModal.js`:

```javascript
const REFERENCE_MISSION_VARIANTS = {
  default: { /* ... */ },
  "Lunar-SouthPole": { /* ... */ },
  "Mars-Equatorial": {
    missionName: "Reference-Mission-Mars-Equatorial",
    label: "Mars Equatorial",
    description: "Equirectangular Mars mission (IAU2000:49910)",
  },
};
```

Also add the mission name to `REFERENCE_MISSION_NAMES` in `configure/src/components/Tabs/Home/Home.js` so the "Save to Base Blueprint" button appears:

```javascript
const REFERENCE_MISSION_NAMES = new Set([
  "Reference-Mission",
  "Reference-Mission-Lunar-SouthPole",
  "Reference-Mission-Mars-Equatorial",  // add here
]);
```

### 4. Write Tests

Add unit test assertions to `tests/unit/missionTemplates.spec.js`:

```javascript
test('contains the Mars-Equatorial variant', () => {
    const mars = REFERENCE_MISSION_VARIANTS['Mars-Equatorial'];
    expect(mars).toBeDefined();
    expect(mars.missionName).toBe('Reference-Mission-Mars-Equatorial');
});
```

Add config-level assertions for projection values (custom, epsg, proj string, bounds, origin, resunitsperpixel).

Optionally add an E2E smoke test at `tests/e2e/reference-mission-mars-equatorial.spec.js` following the pattern in `tests/e2e/reference-mission-lunar-southpole.spec.js`.

### 5. Verify

```bash
# Run unit tests
PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test tests/unit/missionTemplates.spec.js

# Lint changed files
NODE_ENV=development npx eslint API/Backend/Utils/missionTemplates.js \
  configure/src/components/Panel/Modals/NewMissionModal/NewMissionModal.js \
  configure/src/components/Tabs/Home/Home.js
```

---

## Earth Reference Mission (Default Variant)

The default variant is a comprehensive demonstration of all MMGIS features, layer types, data formats, tools, and configuration options. It is centered on the San Francisco Bay Area.

### Purpose

1. **Reference Documentation** — site administrators can examine this configuration to understand how to set up specific features
2. **Demonstration Platform** — showcase the full extent of MMGIS capabilities for stakeholders, new users, and mission teams
3. **Testing Target** — provides a stable, feature-complete mission for Playwright E2E testing and development validation

### Layer Catalog

The Earth Reference Mission includes **44 layers** organized into two main categories:

- **GeoJSON Data Features** (18 layers) — features driven by geometry types and feature properties
- **Layer Configuration** (18 layers) — features driven by Configure page settings
- **Tile Layers** (8 layers) — raster basemaps and imagery from various sources (ArcGIS, GIBS, STAC/TiTiler COGs)

All vector layers are flat-file GeoJSON (or KML) stored in `Missions/Reference-Mission/Layers/Vectors/` using SF Bay Area coordinates (~37.8N, -122.4W).

For the full layer catalog with per-layer details, see the config file directly:
`blueprints/Missions/Reference-Mission/config.reference-mission.json`

### Tools (14)

Layers, Legend, Info, Draw, Measure, Chemistry, Sites, Search, Viewshed, TimeControl, Identifier, DataShaders, Model, Help.

---

## Lunar South Pole Variant

A minimal mission using IAU2000:30120 south polar stereographic projection for the Moon's south pole.

- **Projection**: `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=1737400 +b=1737400 +units=m +no_defs`
- **Bounds**: [-1095700, -1095600, 1095600, 1095700]
- **Basemap**: `Layers/SPole_100m/` — 100m/pixel lunar south pole tiles (zoom 0–2, TMS)
- **Globe**: disabled (2D polar stereographic only)
- **Tools**: Layers, Legend, Info, Draw, Measure

---

## Contributing

When adding new features to MMGIS:

1. **Update a Reference Mission** — add configuration examples to the appropriate variant's config file
2. **Add Sample Data** — if the feature requires new data formats, add representative files to `Layers/`
3. **Update This README** — document the new variant or layer in the appropriate section
4. **Consider a New Variant** — if the feature is body-specific or projection-specific, it may warrant its own variant rather than modifying the Earth default

---

## License

Mission configurations and sample data are part of MMGIS and fall under the same Apache-2.0 license.

**Attributions**:
- External tile data: OpenStreetMap contributors, Esri, Maxar, and others
- NASA 3D models: NASA/JPL-Caltech (Public Domain)
- Sample vector data: Synthetic data created for demonstration purposes
