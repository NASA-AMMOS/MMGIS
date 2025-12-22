# Dual Map Rendering Engines - Technical Specification (Retrospective)

**Status**: ✅ Complete (Retrospective Documentation)
**Implementation Date**: Pre-existing feature
**Last Updated**: 2025-12-22

---

## Executive Summary

MMGIS successfully implements a **tri-rendering architecture** supporting 2D Leaflet mapping, 3D Cesium globe visualization, and OpenSeadragon-based Viewer panel for immersive media content. These three rendering engines provide synchronized views, custom projection support, and seamless interaction between spatial data and high-resolution imagery, photospheres, 3D models, PDFs, and videos. This retrospective specification documents the complete implementation as currently deployed.

---

## 1. Overview

### 1.1 Purpose
The tri-rendering system provides users with complementary visualization modes:
- Traditional 2D mapping with Leaflet for precise measurements and familiar cartographic interactions
- Immersive 3D globe visualization with CesiumJS for terrain-aware spatial understanding
- Dedicated Viewer panel for high-resolution imagery, photospheres, 3D models, documents, and videos

### 1.2 Scope
This specification covers:
- 2D Leaflet rendering engine (Map_)
- 3D Cesium/LithoSphere rendering engine (Globe_)
- **Viewer panel (Viewer_)** with OpenSeadragon, Photosphere, ModelViewer, PDFViewer, and VideoPlayer
- Unified GlobeRenderer abstraction layer
- View synchronization mechanisms
- Custom projection system
- Layer rendering in all contexts
- Feature selection synchronization
- **Media content integration with feature attachments**

### 1.3 Architecture Decision
<!-- HUMAN REVIEW NEEDED -->
**Decision**: Tri-rendering architecture (Map + Globe + Viewer) over single unified renderer
**Rationale**: Leverages strengths of specialized engines - Leaflet's maturity for 2D, Cesium's 3D capabilities, OpenSeadragon's tiled imagery performance
**Trade-offs**: Increased complexity for synchronization, but gains maximum flexibility and specialized feature richness

---

## 2. System Architecture

### 2.1 Component Hierarchy

```
MMGIS Core
├── Map_ (Leaflet 2D)
│   ├── Leaflet Map Instance
│   ├── Layer Management
│   ├── Custom CRS Support
│   └── Projection Utilities
│
├── Globe_ (3D Abstraction)
│   ├── GlobeRenderer (Abstraction Layer)
│   │   ├── LithoSphere Renderer
│   │   └── Cesium Renderer
│   ├── Terrain Management
│   ├── 3D Layer Rendering
│   └── Camera Controls
│
├── Viewer_ (Immersive Media Panel) ⭐ NEW
│   ├── OpenSeadragon Image Viewer
│   │   ├── Deep Zoom Images (DZI)
│   │   ├── Tiled Imagery
│   │   ├── Rotation & Zoom Controls
│   │   └── Image Adjustments
│   ├── Photosphere Viewer (THREE.js)
│   │   ├── 360° Panoramas
│   │   ├── Equirectangular Projection
│   │   └── Camera Controls
│   ├── Model Viewer (THREE.js)
│   │   ├── OBJ/MTL Support
│   │   ├── GLTF/GLB Support
│   │   ├── Orbit Controls
│   │   └── Lighting
│   ├── PDF Viewer (PDF.js)
│   │   ├── Multi-Page Documents
│   │   ├── Text Selection
│   │   └── Download Support
│   └── Video Player
│       ├── MP4/WebM Support
│       ├── Playback Controls
│       └── Fullscreen Mode
│
└── Layers_ (Shared State)
    ├── Layer Data Store
    ├── Opacity Management
    ├── Visibility State
    └── Layer Ordering
```

### 2.2 Rendering Engine Selection

**File**: `src/essence/Basics/Globe_/Globe_.js` (lines 27-32)
**File**: `src/essence/Basics/Globe_/GlobeRenderer.js` (lines 13-27)

<!-- HUMAN REVIEW NEEDED -->
**Configuration**: Renderer type set via `L_.configData.panelSettings.globeRenderer`
**Options**: `'lithosphere'` (default) | `'cesium'`

```javascript
this.rendererType =
    L_.configData.panelSettings?.globeRenderer
    ? L_.configData.panelSettings.globeRenderer
    : 'lithosphere'
```

---

## 3. 2D Rendering: Leaflet (Map_)

### 3.1 Implementation
**File**: `src/essence/Basics/Map_/Map_.js`

### 3.2 Core Features

#### 3.2.1 Map Initialization (lines 48-243)
```javascript
Map_.init = function (essenceFinal) {
    // Configure zoom controls
    var hasZoomControl = L_.configData.look?.zoomcontrol || false

    // Initialize custom or default CRS
    if (L_.configData.projection?.custom === true) {
        var crs = new L.Proj.CRS(/* custom projection */);
        this.map = L.map('map', { crs, /* options */ });
    } else {
        this.map = L.map('map', { /* standard options */ });
    }

    // Set initial view
    this.resetView(L_.view);
}
```

#### 3.2.2 Custom Projection Support (lines 123-200)

**Supported Projections**:
- **EPSG Standard**: Any EPSG code with proj4 string
- **Custom Planetary**: Mars2000, Moon IAU, etc.
- **Non-Mercator**: Arbitrary coordinate systems

**Configuration Example**:
```json
{
  "projection": {
    "custom": true,
    "epsg": "104905",
    "proj": "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +a=3396190 +b=3376200 +units=m +no_defs",
    "origin": [-10669557.4659, 5334778.7329],
    "resunitsperpixel": 4891.9695760101,
    "reszoomlevel": 5,
    "bounds": [-10669557.4659, -5334778.7329, 10669557.4659, 5334778.7329]
  }
}
```

**Resolution Calculation** (lines 130-140):
```javascript
var resolutions = []
var baseResolution = parseFloat(cp.resunitsperpixel)
var zoomLevel = parseInt(cp.reszoomlevel) || 0

for (var i = 0; i <= 20; i++) {
    var zoomDiff = i - zoomLevel
    var resolution = baseResolution / Math.pow(2, zoomDiff)
    resolutions.push(resolution)
}
```

#### 3.2.3 Layer Management (lines 392-504)

**Layer Ordering** (orderedBringToFront):
- Raster layers (tiles, data) maintain z-index order
- Vector layers redrawn from bottom to top
- Draw tool layers always on top

**Layer Types Supported**:
- `tile`: Raster tile layers (TMS/WMTS)
- `vector`: GeoJSON vector layers
- `vectortile`: MVT vector tiles
- `data`: Data layers with custom shaders
- `image`: Single GeoTIFF images
- `video`: Video overlays
- `velocity`: Animated streamlines/particles

### 3.3 View Management

#### 3.3.1 View Synchronization (lines 282-293)
```javascript
if (Globe_.controls.link) {
    this.map.on('move', (e) => {
        const c = this.map.getCenter()
        Globe_.controls.link.linkMove(c.lng, c.lat)
    })
    this.map.on('mousemove', (e) => {
        Globe_.controls.link.linkMouseMove(e.latlng.lng, e.latlng.lat)
    })
}
```

#### 3.3.2 View State (lines 344-358)
```javascript
resetView: function (latlonzoom, stopNextMove) {
    var lat = parseFloat(latlonzoom[0])
    var lon = parseFloat(latlonzoom[1])
    var zoom = parseInt(latlonzoom[2])

    this.map.setView([lat, lon], zoom)
    this.map.invalidateSize()
}
```

---

## 4. 3D Rendering: Cesium/LithoSphere (Globe_)

### 4.1 GlobeRenderer Abstraction
**File**: `src/essence/Basics/Globe_/GlobeRenderer.js`

### 4.2 Architecture Pattern

**Design**: Abstract Factory + Strategy Pattern
**Purpose**: Allow runtime selection between LithoSphere and Cesium renderers with unified API

```javascript
class GlobeRenderer {
    constructor(containerId, config, rendererType = 'lithosphere') {
        this.rendererType = rendererType

        if (rendererType === 'cesium') {
            this._initCesium()
        } else {
            this._initLithoSphere()
        }
    }

    // Unified API methods
    addLayer(type, layerConfig) { /* ... */ }
    removeLayer(name) { /* ... */ }
    toggleLayer(name, visible) { /* ... */ }
    setCenter(view) { /* ... */ }
    getCenter() { /* ... */ }
}
```

### 4.3 LithoSphere Renderer (lines 52-63)

**Implementation**: Direct passthrough to LithoSphere library
**Features**:
- Custom 3D engine built for planetary mapping
- First-person camera mode
- Advanced terrain rendering
- Mesh-based vector rendering

```javascript
_initLithoSphere() {
    this.renderer = new LithoSphere(this.containerId, this.config)
    this.controls = this.renderer.controls
    this.projection = this.renderer.projection
    this._ = this.renderer._
    this.options = this.renderer.options
    this.mouse = this.renderer.mouse
}
```

### 4.4 Cesium Renderer (lines 68-153)

**Implementation**: Cesium.Viewer with custom configuration
**Features**:
- Industry-standard 3D globe
- Time-dynamic visualization
- WMS/WMTS support
- Terrain provider abstraction

```javascript
_initCesium() {
    this.renderer = new Cesium.Viewer(cesiumContainer, {
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        requestRenderMode: false,
        maximumRenderTimeChange: Infinity
    })

    this._layers = {}
    this._loadingLayers = {}
}
```

#### 4.4.1 Terrain Management (lines 156-383)

**Default Terrain**: Mapzen Terrarium tiles (free, global coverage)
**Custom Terrain**: Configurable via `demFallbackPath`

**Supported Formats**:
- `terrarium`: Mapzen/AWS format: `(R*256 + G + B/256) - 32768`
- `mapbox`: TerrainRGB format: `-10000 + ((R*256*256 + G*256 + B) * 0.1)`
- `rgba`: Alias for TerrainRGB

**Terrain Provider** (lines 184-240):
```javascript
this.renderer.terrainProvider = new Cesium.CustomHeightmapTerrainProvider({
    width: 256,
    height: 256,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    callback: async (x, y, level) => {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${level}/${x}/${y}.png`
        const response = await fetch(url)

        if (response.ok) {
            const imageBitmap = await createImageBitmap(await response.blob())
            // Parse Terrarium format...
            return heightMap
        }

        return EMPTY_HEIGHTS
    }
})
```

### 4.5 Layer Rendering

#### 4.5.1 Tile Layers (lines 405-497)

**Formats Supported**:
- TMS (Tile Map Service)
- WMTS (Web Map Tile Service)
- WMS (Web Map Service)

```javascript
_addCesiumLayer(type, layerConfig) {
    if (type === 'tile') {
        if (layerConfig.format === 'wms') {
            imageryProvider = new Cesium.WebMapServiceImageryProvider({
                url: baseUrl,
                layers: wmsParams.LAYERS,
                parameters: { /* ... */ }
            })
        } else {
            imageryProvider = new Cesium.UrlTemplateImageryProvider({
                url: this._convertTileUrl(processedUrl, layerConfig.format)
            })
        }

        const layer = this.renderer.imageryLayers.addImageryProvider(imageryProvider)
        this._layers[name] = { type: 'tile', layer, /* ... */ }
    }
}
```

#### 4.5.2 Vector Layers (lines 497-688)

**Implementation**: GeoJSON → Cesium Entities
**Features**:
- Feature ID injection for fast lookups
- Per-feature style support
- Clamped vs. floating geometry

```javascript
const geojsonWithIds = JSON.parse(JSON.stringify(layerConfig.geojson))
const featureMap = {}

geojsonWithIds.features.forEach((feature, index) => {
    const internalId = `${name}_${index}`
    featureMap[internalId] = layerConfig.geojson.features[index]
    feature.id = internalId
})

const dataSource = Cesium.GeoJsonDataSource.load(geojsonWithIds, {
    clampToGround: type === 'clamped',
    stroke: strokeColor,
    strokeWidth: defaultStyle.weight || 2,
    fill: fillWithAlpha
})
```

### 4.6 Zoom Synchronization (lines 30-47)

**Problem**: Cesium uses camera height, Leaflet uses zoom levels
**Solution**: Exponential conversion formulas

```javascript
// Leaflet zoom → Cesium height
_zoomToHeight(zoom) {
    return this.EARTH_CIRCUMFERENCE / Math.pow(2, zoom)
}

// Cesium height → Leaflet zoom
_heightToZoom(height) {
    return Math.log2(this.EARTH_CIRCUMFERENCE / height)
}
```

**Conversion Examples**:
| Leaflet Zoom | Cesium Height (m) |
|--------------|-------------------|
| 0            | 40,075,017        |
| 5            | 1,252,344         |
| 10           | 39,136            |
| 15           | 1,223             |
| 20           | 38.2              |

---

## 5. Viewer Panel: Immersive Media (Viewer_) ⭐ NEW

### 5.1 Overview

**Location**: `src/essence/Basics/Viewer_/Viewer_.js`

**Purpose**: Dedicated panel for viewing high-resolution imagery, panoramic photospheres, 3D models, documents, and videos associated with map features.

**Key Features**:
- OpenSeadragon-based tiled image viewer for gigapixel imagery
- THREE.js-powered photosphere viewer for 360° panoramas
- THREE.js model viewer for OBJ and GLTF 3D models
- PDF.js document viewer for multi-page PDFs
- HTML5 video player for MP4/WebM videos
- Image adjustment controls (rotation, brightness, contrast, saturation)
- Deep integration with feature attachments from vector layers
- Coordinate system for annotating viewed imagery

### 5.2 Architecture

```
Viewer_
├── ViewerController (Main Module)
│   ├── Content Type Detection
│   ├── Viewer Mode Selection
│   ├── Controls Management
│   └── State Management
│
├── OpenSeadragonViewer
│   ├── DZI Image Loading
│   ├── Tiled Image Rendering
│   ├── Zoom & Pan Controls
│   ├── Rotation Controls
│   ├── Image Adjustments (CSS Filters)
│   └── Annotation Overlay
│
├── PhotosphereViewer (THREE.js)
│   ├── Equirectangular Texture Loading
│   ├── Sphere Geometry
│   ├── Camera Controls (OrbitControls)
│   ├── Rotation Animation
│   └── FOV Adjustment
│
├── ModelViewer (THREE.js)
│   ├── OBJLoader + MTLLoader
│   ├── GLTFLoader
│   ├── Scene Setup
│   ├── Lighting (Ambient + Directional)
│   ├── OrbitControls
│   └── Animation Support
│
├── PDFViewer (PDF.js)
│   ├── Document Loading
│   ├── Page Rendering
│   ├── Navigation Controls
│   ├── Zoom Controls
│   └── Text Selection
│
└── VideoPlayer
    ├── Video Element Management
    ├── Playback Controls
    ├── Fullscreen Support
    └── Subtitle Support
```

### 5.3 OpenSeadragon Image Viewer

**Library**: OpenSeadragon 4.x
**Purpose**: High-resolution tiled imagery with deep zoom capabilities

#### 5.3.1 Initialization

```javascript
// File: src/essence/Basics/Viewer_/OpenSeadragonViewer.js

function initOpenSeadragon(containerSelector, config) {
    const viewer = OpenSeadragon({
        element: document.querySelector(containerSelector),
        prefixUrl: 'public/openseadragon/images/',

        // Navigation
        showNavigator: true,
        navigatorPosition: 'BOTTOM_RIGHT',

        // Controls
        showRotationControl: true,
        showHomeControl: true,
        showFullPageControl: true,

        // Zoom
        zoomInButton: 'viewer-zoom-in',
        zoomOutButton: 'viewer-zoom-out',
        homeButton: 'viewer-home',

        // Rotation
        rotateLeftButton: 'viewer-rotate-left',
        rotateRightButton: 'viewer-rotate-right',

        // Performance
        minZoomImageRatio: 0.5,
        maxZoomPixelRatio: 2,
        visibilityRatio: 1,

        // Gestures
        gestureSettingsMouse: {
            clickToZoom: false,
            dblClickToZoom: true
        }
    })

    return viewer
}
```

#### 5.3.2 DZI Support

**Format**: Deep Zoom Images (Microsoft format)
**Structure**: Hierarchical tiled pyramid

```xml
<!-- example.dzi -->
<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="jpg" Overlap="1" TileSize="256">
  <Size Width="13920" Height="10200"/>
</Image>
```

**Loading**:
```javascript
viewer.open({
    type: 'image',
    url: '/path/to/image.dzi'
})

// Or direct tiled image source
viewer.open({
    type: 'zoomifytileservice',
    width: 13920,
    height: 10200,
    tileSize: 256,
    tilesUrl: '/path/to/tiles/'
})
```

#### 5.3.3 Image Adjustments

**Controls**: Brightness, Contrast, Saturation, Rotation
**Implementation**: CSS filters applied to OpenSeadragon canvas

```javascript
// File: src/essence/Basics/Viewer_/ImageAdjustments.js

class ImageAdjustments {
    constructor(viewer) {
        this.viewer = viewer
        this.brightness = 100  // percent
        this.contrast = 100
        this.saturation = 100
        this.rotation = 0      // degrees

        this._setupControls()
    }

    setBrightness(value) {
        this.brightness = value
        this._applyFilters()
    }

    setContrast(value) {
        this.contrast = value
        this._applyFilters()
    }

    setSaturation(value) {
        this.saturation = value
        this._applyFilters()
    }

    setRotation(degrees) {
        this.rotation = degrees
        this.viewer.viewport.setRotation(degrees)
    }

    _applyFilters() {
        const canvas = this.viewer.canvas
        canvas.style.filter = `
            brightness(${this.brightness}%)
            contrast(${this.contrast}%)
            saturate(${this.saturation}%)
        `
    }

    reset() {
        this.brightness = 100
        this.contrast = 100
        this.saturation = 100
        this.rotation = 0
        this._applyFilters()
        this.viewer.viewport.setRotation(0)
    }
}
```

**UI Controls**:
```javascript
// Brightness slider: 0% to 200%
<input type="range" id="brightness-slider" min="0" max="200" value="100">

// Contrast slider: 0% to 200%
<input type="range" id="contrast-slider" min="0" max="200" value="100">

// Saturation slider: 0% to 200%
<input type="range" id="saturation-slider" min="0" max="200" value="100">

// Rotation buttons: -90°, Reset, +90°
<button id="rotate-left">↶ 90°</button>
<button id="rotate-reset">Reset</button>
<button id="rotate-right">↷ 90°</button>
```

#### 5.3.4 Coordinate System & Annotations

**Purpose**: Allow users to annotate imagery with geometric shapes and text

**Coordinate Mapping**:
- OpenSeadragon uses normalized image coordinates (0-1 range)
- MMGIS converts to pixel coordinates for annotation storage

```javascript
class ViewerAnnotations {
    constructor(viewer) {
        this.viewer = viewer
        this.annotations = []
        this.overlay = viewer.svgOverlay()

        this._setupDrawingTools()
    }

    // Convert OSD normalized coords to pixel coords
    normalizedToPixel(point) {
        const imageRect = this.viewer.world.getItemAt(0).getContentSize()
        return {
            x: point.x * imageRect.x,
            y: point.y * imageRect.y
        }
    }

    // Convert pixel coords to OSD normalized coords
    pixelToNormalized(point) {
        const imageRect = this.viewer.world.getItemAt(0).getContentSize()
        return {
            x: point.x / imageRect.x,
            y: point.y / imageRect.y
        }
    }

    addRectangle(x, y, width, height, properties) {
        const rect = this.overlay.node().appendChild(
            document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        )

        rect.setAttribute('x', x)
        rect.setAttribute('y', y)
        rect.setAttribute('width', width)
        rect.setAttribute('height', height)
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', properties.color || 'red')
        rect.setAttribute('stroke-width', properties.strokeWidth || 2)

        this.annotations.push({
            type: 'rectangle',
            coordinates: { x, y, width, height },
            properties
        })
    }

    exportAnnotations() {
        // Export as GeoJSON-like structure
        return {
            type: 'AnnotationCollection',
            imageUrl: this.viewer.tileSources,
            annotations: this.annotations
        }
    }
}
```

### 5.4 Photosphere Viewer (THREE.js)

**Purpose**: Immersive 360° panoramic imagery viewer
**Format**: Equirectangular projection images

#### 5.4.1 Initialization

```javascript
// File: src/essence/Basics/Viewer_/PhotosphereViewer.js

class PhotosphereViewer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector)
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(
            75,  // FOV
            this.container.offsetWidth / this.container.offsetHeight,
            0.1,
            1000
        )

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight)
        this.container.appendChild(this.renderer.domElement)

        // Create sphere for photosphere
        this.sphere = this._createSphere()
        this.scene.add(this.sphere)

        // Setup camera controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableZoom = true
        this.controls.enablePan = false
        this.controls.rotateSpeed = -0.5  // Invert for natural feel

        this._animate()
    }

    _createSphere() {
        const geometry = new THREE.SphereGeometry(500, 60, 40)
        geometry.scale(-1, 1, 1)  // Invert for inside view

        const material = new THREE.MeshBasicMaterial({
            map: null,  // Set when loading image
            side: THREE.BackSide
        })

        return new THREE.Mesh(geometry, material)
    }

    loadImage(imageUrl) {
        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(imageUrl, (texture) => {
            this.sphere.material.map = texture
            this.sphere.material.needsUpdate = true
        })
    }

    _animate() {
        requestAnimationFrame(() => this._animate())
        this.controls.update()
        this.renderer.render(this.scene, this.camera)
    }

    setFOV(degrees) {
        this.camera.fov = degrees
        this.camera.updateProjectionMatrix()
    }

    resetView() {
        this.camera.position.set(0, 0, 0.1)
        this.controls.reset()
    }

    dispose() {
        this.sphere.geometry.dispose()
        this.sphere.material.dispose()
        this.renderer.dispose()
        this.controls.dispose()
    }
}
```

#### 5.4.2 Configuration

```json
{
  "photosphere": {
    "initialFOV": 75,
    "minFOV": 30,
    "maxFOV": 120,
    "autoRotate": false,
    "autoRotateSpeed": 0.5,
    "enableZoom": true,
    "enableRotate": true
  }
}
```

### 5.5 Model Viewer (THREE.js)

**Purpose**: Display 3D models (OBJ, GLTF) with orbit controls
**Supported Formats**: OBJ+MTL, GLTF, GLB

#### 5.5.1 Initialization

```javascript
// File: src/essence/Basics/Viewer_/ModelViewer.js

class ModelViewer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector)
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x1a1a1a)

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            this.container.offsetWidth / this.container.offsetHeight,
            0.1,
            10000
        )
        this.camera.position.set(0, 0, 5)

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight)
        this.container.appendChild(this.renderer.domElement)

        // Lighting
        this._setupLighting()

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05

        // Model
        this.model = null

        this._animate()
    }

    _setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        this.scene.add(ambientLight)

        // Directional lights (key, fill, back)
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
        keyLight.position.set(5, 5, 5)
        this.scene.add(keyLight)

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
        fillLight.position.set(-5, 0, -5)
        this.scene.add(fillLight)

        const backLight = new THREE.DirectionalLight(0xffffff, 0.2)
        backLight.position.set(0, 5, -5)
        this.scene.add(backLight)
    }

    loadOBJ(objUrl, mtlUrl) {
        const mtlLoader = new THREE.MTLLoader()
        mtlLoader.load(mtlUrl, (materials) => {
            materials.preload()

            const objLoader = new THREE.OBJLoader()
            objLoader.setMaterials(materials)
            objLoader.load(objUrl, (object) => {
                this._addModelToScene(object)
            })
        })
    }

    loadGLTF(gltfUrl) {
        const loader = new THREE.GLTFLoader()
        loader.load(gltfUrl, (gltf) => {
            this._addModelToScene(gltf.scene)

            // Handle animations if present
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(gltf.scene)
                const action = this.mixer.clipAction(gltf.animations[0])
                action.play()
            }
        })
    }

    _addModelToScene(object) {
        // Remove previous model
        if (this.model) {
            this.scene.remove(this.model)
        }

        this.model = object
        this.scene.add(object)

        // Center and scale model
        this._centerModel()
        this._fitCameraToModel()
    }

    _centerModel() {
        const box = new THREE.Box3().setFromObject(this.model)
        const center = box.getCenter(new THREE.Vector3())
        this.model.position.sub(center)
    }

    _fitCameraToModel() {
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = this.camera.fov * (Math.PI / 180)
        const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))

        this.camera.position.z = cameraZ * 2
        this.camera.updateProjectionMatrix()
    }

    _animate() {
        requestAnimationFrame(() => this._animate())

        this.controls.update()

        if (this.mixer) {
            this.mixer.update(0.01)
        }

        this.renderer.render(this.scene, this.camera)
    }

    dispose() {
        if (this.model) {
            this.scene.remove(this.model)
        }
        this.renderer.dispose()
        this.controls.dispose()
    }
}
```

### 5.6 PDF Viewer (PDF.js)

**Library**: PDF.js (Mozilla)
**Purpose**: Multi-page PDF document viewing

#### 5.6.1 Implementation

```javascript
// File: src/essence/Basics/Viewer_/PDFViewer.js

class PDFViewer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector)
        this.pdfDoc = null
        this.pageNum = 1
        this.pageCount = 0
        this.scale = 1.5

        this._setupUI()
    }

    _setupUI() {
        this.container.innerHTML = `
            <div class="pdf-controls">
                <button id="pdf-prev">Previous</button>
                <span id="pdf-page-info">Page 1 of 1</span>
                <button id="pdf-next">Next</button>
                <button id="pdf-zoom-in">Zoom In</button>
                <button id="pdf-zoom-out">Zoom Out</button>
                <button id="pdf-download">Download</button>
            </div>
            <canvas id="pdf-canvas"></canvas>
        `

        this.canvas = document.getElementById('pdf-canvas')
        this.ctx = this.canvas.getContext('2d')

        this._bindControls()
    }

    async loadPDF(url) {
        const loadingTask = pdfjsLib.getDocument(url)
        this.pdfDoc = await loadingTask.promise
        this.pageCount = this.pdfDoc.numPages

        this._updatePageInfo()
        this._renderPage(this.pageNum)
    }

    async _renderPage(num) {
        const page = await this.pdfDoc.getPage(num)

        const viewport = page.getViewport({ scale: this.scale })
        this.canvas.height = viewport.height
        this.canvas.width = viewport.width

        const renderContext = {
            canvasContext: this.ctx,
            viewport: viewport
        }

        await page.render(renderContext).promise
    }

    _bindControls() {
        document.getElementById('pdf-prev').addEventListener('click', () => {
            if (this.pageNum > 1) {
                this.pageNum--
                this._renderPage(this.pageNum)
                this._updatePageInfo()
            }
        })

        document.getElementById('pdf-next').addEventListener('click', () => {
            if (this.pageNum < this.pageCount) {
                this.pageNum++
                this._renderPage(this.pageNum)
                this._updatePageInfo()
            }
        })

        document.getElementById('pdf-zoom-in').addEventListener('click', () => {
            this.scale += 0.25
            this._renderPage(this.pageNum)
        })

        document.getElementById('pdf-zoom-out').addEventListener('click', () => {
            this.scale = Math.max(0.5, this.scale - 0.25)
            this._renderPage(this.pageNum)
        })

        document.getElementById('pdf-download').addEventListener('click', () => {
            window.open(this.pdfDoc.url, '_blank')
        })
    }

    _updatePageInfo() {
        document.getElementById('pdf-page-info').textContent =
            `Page ${this.pageNum} of ${this.pageCount}`
    }
}
```

### 5.7 Video Player

**Purpose**: HTML5 video playback with custom controls
**Supported Formats**: MP4, WebM

#### 5.7.1 Implementation

```javascript
// File: src/essence/Basics/Viewer_/VideoPlayer.js

class VideoPlayer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector)
        this._setupUI()
    }

    _setupUI() {
        this.container.innerHTML = `
            <video id="viewer-video" controls>
                <source src="" type="">
                Your browser does not support the video tag.
            </video>
            <div class="video-controls">
                <button id="video-play-pause">Play</button>
                <input type="range" id="video-seek" value="0" min="0" max="100">
                <span id="video-time">0:00 / 0:00</span>
                <button id="video-mute">Mute</button>
                <input type="range" id="video-volume" value="100" min="0" max="100">
                <button id="video-fullscreen">Fullscreen</button>
            </div>
        `

        this.video = document.getElementById('viewer-video')
        this._bindControls()
    }

    loadVideo(url, type = 'video/mp4') {
        const source = this.video.querySelector('source')
        source.src = url
        source.type = type
        this.video.load()
    }

    _bindControls() {
        const playPauseBtn = document.getElementById('video-play-pause')
        const seekSlider = document.getElementById('video-seek')
        const timeDisplay = document.getElementById('video-time')
        const muteBtn = document.getElementById('video-mute')
        const volumeSlider = document.getElementById('video-volume')
        const fullscreenBtn = document.getElementById('video-fullscreen')

        // Play/Pause
        playPauseBtn.addEventListener('click', () => {
            if (this.video.paused) {
                this.video.play()
                playPauseBtn.textContent = 'Pause'
            } else {
                this.video.pause()
                playPauseBtn.textContent = 'Play'
            }
        })

        // Seek
        seekSlider.addEventListener('input', (e) => {
            const time = (e.target.value / 100) * this.video.duration
            this.video.currentTime = time
        })

        // Update seek slider and time display
        this.video.addEventListener('timeupdate', () => {
            const progress = (this.video.currentTime / this.video.duration) * 100
            seekSlider.value = progress

            const currentTime = this._formatTime(this.video.currentTime)
            const duration = this._formatTime(this.video.duration)
            timeDisplay.textContent = `${currentTime} / ${duration}`
        })

        // Mute
        muteBtn.addEventListener('click', () => {
            this.video.muted = !this.video.muted
            muteBtn.textContent = this.video.muted ? 'Unmute' : 'Mute'
        })

        // Volume
        volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value / 100
        })

        // Fullscreen
        fullscreenBtn.addEventListener('click', () => {
            if (this.video.requestFullscreen) {
                this.video.requestFullscreen()
            }
        })
    }

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }
}
```

### 5.8 Integration with Feature Attachments

**Purpose**: Automatically open Viewer panel when feature with media attachment is clicked

#### 5.8.1 Feature Property Configuration

Vector layer features can specify Viewer content via properties:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Landing Site Panorama",
    "viewer": {
      "type": "photosphere",
      "url": "Missions/Mars/Images/landing_site_360.jpg"
    }
  },
  "geometry": {
    "type": "Point",
    "coordinates": [137.441, -4.589]
  }
}
```

**Supported Viewer Types**:
- `"image"` - High-resolution image (OpenSeadragon)
- `"photosphere"` - 360° panorama
- `"model"` - 3D model (OBJ or GLTF)
- `"pdf"` - PDF document
- `"video"` - Video file

#### 5.8.2 Automatic Opening

```javascript
// File: src/essence/Basics/Layers_/Layers_.js

Layers_.selectFeature = function(layerName, feature) {
    // ... existing feature selection logic ...

    // Check if feature has viewer content
    if (feature.properties.viewer) {
        const viewerConfig = feature.properties.viewer

        // Open Viewer panel if not already open
        if (!Viewer_.isOpen()) {
            Viewer_.open()
        }

        // Load content based on type
        switch (viewerConfig.type) {
            case 'image':
                Viewer_.loadImage(viewerConfig.url)
                break
            case 'photosphere':
                Viewer_.loadPhotosphere(viewerConfig.url)
                break
            case 'model':
                Viewer_.loadModel(viewerConfig.url, viewerConfig.format || 'gltf')
                break
            case 'pdf':
                Viewer_.loadPDF(viewerConfig.url)
                break
            case 'video':
                Viewer_.loadVideo(viewerConfig.url)
                break
        }
    }
}
```

### 5.9 Viewer Controller

**Main Module**: Coordinates viewer mode selection and content loading

```javascript
// File: src/essence/Basics/Viewer_/Viewer_.js

const Viewer_ = {
    currentViewer: null,
    currentMode: null,

    init: function() {
        this.container = document.getElementById('viewer-container')
        this.openSeadragonViewer = null
        this.photosphereViewer = null
        this.modelViewer = null
        this.pdfViewer = null
        this.videoPlayer = null
    },

    open: function() {
        this.container.classList.add('visible')
    },

    close: function() {
        this.container.classList.remove('visible')
        this._disposeCurrentViewer()
    },

    isOpen: function() {
        return this.container.classList.contains('visible')
    },

    loadImage: function(url) {
        this._switchMode('image')

        if (!this.openSeadragonViewer) {
            this.openSeadragonViewer = new OpenSeadragonViewer('#viewer-content')
        }

        this.openSeadragonViewer.open(url)
        this.currentViewer = this.openSeadragonViewer
    },

    loadPhotosphere: function(url) {
        this._switchMode('photosphere')

        if (!this.photosphereViewer) {
            this.photosphereViewer = new PhotosphereViewer('#viewer-content')
        }

        this.photosphereViewer.loadImage(url)
        this.currentViewer = this.photosphereViewer
    },

    loadModel: function(url, format = 'gltf') {
        this._switchMode('model')

        if (!this.modelViewer) {
            this.modelViewer = new ModelViewer('#viewer-content')
        }

        if (format === 'obj') {
            const mtlUrl = url.replace('.obj', '.mtl')
            this.modelViewer.loadOBJ(url, mtlUrl)
        } else {
            this.modelViewer.loadGLTF(url)
        }

        this.currentViewer = this.modelViewer
    },

    loadPDF: function(url) {
        this._switchMode('pdf')

        if (!this.pdfViewer) {
            this.pdfViewer = new PDFViewer('#viewer-content')
        }

        this.pdfViewer.loadPDF(url)
        this.currentViewer = this.pdfViewer
    },

    loadVideo: function(url) {
        this._switchMode('video')

        if (!this.videoPlayer) {
            this.videoPlayer = new VideoPlayer('#viewer-content')
        }

        this.videoPlayer.loadVideo(url)
        this.currentViewer = this.videoPlayer
    },

    _switchMode: function(mode) {
        if (this.currentMode !== mode) {
            this._disposeCurrentViewer()
            this.currentMode = mode
        }
    },

    _disposeCurrentViewer: function() {
        if (this.currentViewer && this.currentViewer.dispose) {
            this.currentViewer.dispose()
        }
        this.currentViewer = null
    }
}
```

---

## 6. View Synchronization

### 6.1 Link Control (lines 1342-1580)

**Implementation**: Bidirectional event-based synchronization

#### 6.1.1 Map → Globe
**File**: `Map_.js` lines 282-293

```javascript
this.map.on('move', (e) => {
    const c = this.map.getCenter()
    Globe_.controls.link.linkMove(c.lng, c.lat)
})
```

#### 6.1.2 Globe → Map
**File**: `GlobeRenderer.js` lines 1485-1507

```javascript
const onCameraMove = () => {
    if (!linkControl._isLinked) return

    const center = this.getCenter()
    if (options.onMove) {
        linkControl._linkPanned = true
        options.onMove(center.lng, center.lat, 0)

        setTimeout(() => {
            linkControl._linkPanned = false
        }, 500)
    }
}
```

#### 6.1.3 Feedback Loop Prevention (lines 1487-1501, 1556-1562)

**Problem**: Map moves Globe, Globe moves Map → infinite loop
**Solution**: Debounced flag with timeout

```javascript
// Set flag before triggering move
linkControl._linkPanned = true
options.onMove(center.lng, center.lat, 0)

// Clear flag after 500ms
clearTimeout(linkControl._linkPannedTimeout)
linkControl._linkPannedTimeout = setTimeout(() => {
    linkControl._linkPanned = false
}, 500)

// Check flag before responding to move
linkControl.linkMove = function (lng, lat) {
    if (this._isLinked && !this._linkPanned) {
        self.setCenter({ lng, lat, zoom: self.getCenter().zoom })
    }
}
```

### 6.2 Link UI (lines 1376-1423)

**Button States**:
- **Unlinked**: Dark background (#1d1f20), white icon
- **Linked**: Yellow background (#ffdd5c), black icon

```javascript
_updateButtonState: function () {
    if (this._isLinked) {
        this._buttonElement.style.background = '#ffdd5c'
        svg.style.color = 'black'
    } else {
        this._buttonElement.style.background = '#1d1f20'
        svg.style.color = 'white'
    }
}
```

---

## 7. Feature Selection Synchronization

### 7.1 Map → Globe Selection
**File**: `Layers_.js` lines 2065-2169

```javascript
selectFeature(layerName, feature, relation, field) {
    // Find matching layer feature
    for (let i = 0; i < layerKeys.length; i++) {
        const geometryMatch = /* compare geometries */
        const propertiesMatch = /* compare properties */

        if (geometryMatch && propertiesMatch) {
            // Set flag to prevent Globe click handler from firing
            if (L_.Globe_?.litho?._justSelectedFromMap !== undefined) {
                L_.Globe_.litho._justSelectedFromMap = true

                setTimeout(() => {
                    L_.Globe_.litho._justSelectedFromMap = false
                }, 500)
            }

            // Highlight in Globe
            if (L_.Globe_?.highlight) {
                L_.Globe_.highlight(layerName, f)
            }

            layers[layerKeys[i]].fireEvent('click')
            return
        }
    }
}
```

### 7.2 Globe → Map Selection
**File**: `GlobeRenderer.js` lines 1149-1257

```javascript
_setupGlobalClickHandler() {
    this._cesiumClickHandler.setInputAction((click) => {
        // Prevent feedback loop
        if (this._justSelectedFromMap) {
            return
        }

        const pickedObject = this.renderer.scene.pick(click.position)
        if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id

            // Find layer and feature
            for (const layerName of Object.keys(this._layers)) {
                if (layerInfo.dataSource.entities.contains(entity)) {
                    const originalFeature = layerInfo.featureMap[entity.id]

                    // Call onClick with original feature
                    layerInfo.onClick(originalFeature, [lng, lat], { name: layerName })
                    break
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}
```

### 7.3 Highlight Rendering

#### 7.3.1 Leaflet Highlight
**File**: `Layers_.js` lines 1163-1218

```javascript
highlight(layer, forceColor) {
    const color = forceColor ||
                  L_.configData.look?.highlightcolor ||
                  'red'

    try {
        if (layer.feature?.properties?.annotation === true) {
            // Annotation highlight
        } else if (layer.feature?.properties?.arrow === true) {
            // Arrow highlight
        } else {
            // Standard vector highlight
            layer.setStyle({
                color: color,
                stroke: color,
                weight: 4
            })
        }
    } catch (err) {
        // Marker highlight
        layer._icon.style.filter = `drop-shadow(${color} 2px 0px 0px) ...`
    }
}
```

#### 7.3.2 Cesium Highlight
**File**: `GlobeRenderer.js` lines 1586-2100

**LithoSphere** (lines 1601-1673):
```javascript
_highlightFeatureLithoSphere(layerName, feature) {
    // Find matching mesh or clamped feature
    if (mesh.feature && this._compareFeaturesForLitho(mesh.feature, feature)) {
        mesh.feature._active = true

        if (mesh.restyle) {
            mesh.restyle()
        }
    }
}
```

**Cesium** (lines 1678-1722):
```javascript
_highlightFeatureCesium(layerName, feature) {
    // Find entity by comparing geometries
    for (const [id, storedFeature] of Object.entries(layerInfo.featureMap)) {
        const geometryMatch = this._compareGeometry(
            storedFeature.geometry,
            feature.geometry
        )

        if (geometryMatch) {
            const entity = dataSource.entities.getById(id)
            this._highlightEntity(entity)
        }
    }
}
```

---

## 8. Coordinate Precision Handling

### 8.1 Problem Statement
**Issue**: Cesium receives precision-reduced GeoJSON (GEOJSON_PRECISION=10), Leaflet has full precision
**Impact**: Geometry comparisons fail when selecting features across renderers

### 8.2 Solution (lines 1819-1862)

```javascript
// Layers_.js constants
L_.GEOJSON_PRECISION: 10

// Round coordinates before comparison
_roundCoordinates(coords, precision) {
    if (typeof coords[0] === 'number') {
        return coords.map(c => parseFloat(c.toFixed(precision)))
    } else {
        return coords.map(c => this._roundCoordinates(c, precision))
    }
}

_roundGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return geometry
    const rounded = JSON.parse(JSON.stringify(geometry))
    rounded.coordinates = this._roundCoordinates(rounded.coordinates, 10)
    return rounded
}

// Compare with precision awareness
_compareGeometry(geometry1, geometry2) {
    const rounded1 = this._roundGeometry(geometry1)
    const rounded2 = this._roundGeometry(geometry2)
    return JSON.stringify(rounded1) === JSON.stringify(rounded2)
}
```

---

## 9. Time-Enabled Layers

### 9.1 Cesium Time Support (lines 806-937)

**Configuration**:
```json
{
  "time": {
    "enabled": true,
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-12-31T23:59:59Z",
    "format": "%Y-%m-%dT%H:%M:%SZ"
  }
}
```

**URL Template Replacement** (lines 765-804):
```javascript
_replaceTimeParameters(url, timeConfig) {
    const timeFormat = timeConfig.format
        ? d3.utcFormat(timeConfig.format)
        : d3.utcFormat('%Y-%m-%dT%H:%M:%SZ')

    let processedUrl = url

    // Replace {time} and {endtime}
    if (timeConfig.end) {
        const formattedEnd = timeFormat(Date.parse(timeConfig.end))
        processedUrl = processedUrl
            .replace(/{time}/g, formattedEnd)
            .replace(/{endtime}/g, formattedEnd)
    }

    // Replace {starttime}
    if (timeConfig.start) {
        const formattedStart = timeFormat(Date.parse(timeConfig.start))
        processedUrl = processedUrl.replace(/{starttime}/g, formattedStart)
    }

    return processedUrl
}
```

**Layer Refresh** (lines 831-914):
```javascript
_refreshTimeEnabledLayer(layerName) {
    const layerInfo = this._layers[layerName]

    // Store current state
    const alpha = layerInfo.layer.alpha
    const show = layerInfo.layer.show
    const index = this.renderer.imageryLayers.indexOf(layerInfo.layer)

    // Remove old layer
    this.renderer.imageryLayers.remove(layerInfo.layer)

    // Create new URL with updated time
    const url = this._replaceTimeParameters(
        layerInfo.timeConfig.originalUrl,
        layerInfo.timeConfig
    )

    // Create new provider
    const newProvider = /* create imagery provider */

    // Add new layer
    const newLayer = this.renderer.imageryLayers.addImageryProvider(newProvider)
    newLayer.alpha = alpha
    newLayer.show = show

    // Update reference
    layerInfo.layer = newLayer
}
```

---

## 10. Configuration API

### 10.1 Mission Configuration

```json
{
  "msv": {
    "mission": "MissionName",
    "site": "SiteName",
    "view": [0, 0, 5],
    "radius": {
      "major": 3396190,
      "minor": 3376200
    }
  },
  "projection": {
    "custom": true,
    "epsg": "104905",
    "proj": "+proj=eqc ...",
    "origin": [-10669557.4659, 5334778.7329],
    "resunitsperpixel": 4891.9695760101,
    "reszoomlevel": 5,
    "bounds": [-10669557.4659, -5334778.7329, 10669557.4659, 5334778.7329]
  },
  "panelSettings": {
    "globeRenderer": "cesium",
    "demFallbackPath": "path/to/dem/{z}/{x}/{y}.png",
    "demFallbackFormat": "tms",
    "demFallbackType": "terrarium"
  },
  "panels": ["map", "globe", "viewer"]
}
```

### 10.2 Layer Configuration

```json
{
  "layers": [
    {
      "name": "LayerName",
      "display_name": "Display Name",
      "type": "tile",
      "url": "https://tiles.example.com/{z}/{x}/{y}.png",
      "tileformat": "tms",
      "minZoom": 0,
      "maxZoom": 18,
      "maxNativeZoom": 15,
      "initialOpacity": 1.0,
      "visibility": true,
      "layer3dType": "clamped",
      "time": {
        "enabled": true,
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-12-31T23:59:59Z",
        "format": "%Y-%m-%dT%H:%M:%SZ"
      }
    }
  ]
}
```

---

## 11. Performance Considerations

### 11.1 Optimization Strategies

#### 11.1.1 Cesium Request Render Mode
**File**: `GlobeRenderer.js` line 98

<!-- HUMAN REVIEW NEEDED -->
**Setting**: `requestRenderMode: false`
**Impact**: Continuous rendering for smoother interactions
**Trade-off**: Higher GPU/CPU usage vs. better responsiveness

#### 11.1.2 Layer Loading Prevention
**File**: `GlobeRenderer.js` lines 499-510

```javascript
if (this._loadingLayers[name]) {
    return  // Prevent duplicate async loads
}

if (existingLayer && existingLayer.type === 'vector') {
    this.renderer.dataSources.remove(existingLayer.dataSource)
}

this._loadingLayers[name] = true
```

#### 11.1.3 Feature ID Mapping
**File**: `GlobeRenderer.js` lines 520-539

**Strategy**: O(1) feature lookup via ID injection
```javascript
const featureMap = {}
geojsonWithIds.features.forEach((feature, index) => {
    const internalId = `${name}_${index}`
    featureMap[internalId] = originalFeature
    feature.id = internalId
})

// Later: instant lookup
const entity = dataSource.entities.getById(internalId)
```

#### 11.1.4 Viewer Performance

**OpenSeadragon Optimizations**:
- **Tile Caching**: Browser caches loaded DZI tiles
- **Progressive Loading**: Lower resolution tiles load first
- **Viewport Culling**: Only visible tiles are requested

**THREE.js Optimizations**:
- **Geometry Simplification**: Use lower-poly models for interactive preview
- **Texture Compression**: Use compressed texture formats (KTX, DDS)
- **Instancing**: Reuse geometries and materials
- **Frustum Culling**: Only render visible meshes

### 11.2 Memory Management

#### 11.2.1 Layer Cleanup
```javascript
removeLayer(name) {
    const layerInfo = this._layers[name]
    if (layerInfo) {
        if (layerInfo.featureMap) {
            delete layerInfo.featureMap
        }
        delete this._layers[name]
    }
}
```

#### 11.2.2 Viewer Cleanup

```javascript
Viewer_.close = function() {
    // Dispose current viewer to free memory
    this._disposeCurrentViewer()

    // Clear container
    const content = document.getElementById('viewer-content')
    content.innerHTML = ''

    // Remove event listeners
    this._removeEventListeners()
}
```

---

## 12. Testing & Validation

### 12.1 Test Scenarios

#### 12.1.1 Projection Accuracy
- [ ] Earth (EPSG:3857) rendering matches expected coordinates
- [ ] Mars2000 projection displays accurately
- [ ] Custom planetary projections calculate resolutions correctly
- [ ] Coordinate transformations between projections

#### 12.1.2 Synchronization
- [ ] Map pan updates Globe center
- [ ] Globe camera move updates Map center
- [ ] Feedback loops do not occur
- [ ] Link toggle works immediately
- [ ] Synchronization works across zoom levels

#### 12.1.3 Feature Selection
- [ ] Click on Map highlights in Globe
- [ ] Click on Globe highlights in Map
- [ ] Selection works for points, lines, polygons
- [ ] Multiple features at same location handled correctly
- [ ] Precision-reduced geometry matching works

#### 12.1.4 Layer Rendering
- [ ] Tile layers display in both views
- [ ] Vector layers render correctly in both views
- [ ] Time-enabled layers update in Cesium
- [ ] Layer visibility synchronizes
- [ ] Layer ordering maintained in both views

#### 12.1.5 Viewer Panel
- [ ] OpenSeadragon loads DZI images correctly
- [ ] Photosphere renders 360° panoramas
- [ ] Model viewer displays OBJ and GLTF models
- [ ] PDF viewer displays multi-page documents
- [ ] Video player plays MP4/WebM videos
- [ ] Image adjustments apply correctly
- [ ] Feature attachments automatically open Viewer
- [ ] Viewer disposal cleans up resources

#### 12.1.6 Performance
- [ ] Large vector datasets render smoothly
- [ ] High-resolution terrain loads efficiently
- [ ] Memory usage stays within acceptable limits
- [ ] No memory leaks on layer toggle
- [ ] Viewer mode switches without memory leaks
- [ ] Large DZI images load progressively

---

## 13. Known Limitations

### 13.1 Current Constraints

1. **Time Support**: Cesium time-enabled layers only, Leaflet requires manual refresh
2. **Filter Effects**: Cesium doesn't support CSS filter effects (brightness, contrast, saturation)
3. **First-Person Camera**: Only available in LithoSphere renderer
4. **Model Layers**: Not implemented for Cesium renderer core features
5. **Curtain Layers**: Not implemented for Cesium renderer core features
6. **Viewer Annotations**: Annotation storage not yet persisted to database
7. **Photosphere FOV**: Limited to 30°-120° range
8. **Model Animations**: GLTF animations supported but not controllable via UI

### 13.2 Browser Compatibility
- **Cesium**: Requires WebGL 2.0 support
- **LithoSphere**: Requires WebGL 1.0 support
- **Custom Projections**: Requires proj4js library
- **OpenSeadragon**: Works in all modern browsers
- **THREE.js**: Requires WebGL 1.0 minimum
- **PDF.js**: Works in all modern browsers

---

## 14. Future Enhancements

### 14.1 Potential Improvements
<!-- HUMAN REVIEW NEEDED -->

1. **Performance**
   - Implement tile prefetching
   - Add progressive vector loading
   - Optimize terrain tile caching
   - Add WebGPU renderer option for THREE.js

2. **Features**
   - Add 3D model support for Cesium
   - Implement curtain layers for Cesium
   - Add filter effects via post-processing
   - Persistent annotation storage
   - Photosphere hotspot navigation
   - GLTF animation timeline controls
   - Multi-document viewer (side-by-side PDFs)
   - Synchronized video playback across multiple sources

3. **Synchronization**
   - Synchronize camera orientation (pitch, heading)
   - Add smooth animation between synchronized moves
   - Implement bi-directional terrain height queries
   - Viewer panel sync with Map/Globe selection

4. **Developer Experience**
   - Add TypeScript definitions
   - Create renderer plugin system
   - Improve error messages
   - Viewer API for programmatic control

---

## 15. References

### 15.1 Dependencies
- **Leaflet**: 1.x (2D mapping library)
- **Cesium**: 1.x (3D globe library)
- **LithoSphere**: Custom 3D rendering engine
- **proj4js**: Projection transformation library
- **OpenSeadragon**: 4.x (Deep zoom image viewer)
- **THREE.js**: r155+ (3D graphics library)
- **PDF.js**: 3.x (PDF document viewer)

### 15.2 Related Documentation
- Leaflet API: https://leafletjs.com/reference.html
- Cesium API: https://cesium.com/docs/
- Proj4 Documentation: https://proj.org/
- OpenSeadragon Documentation: https://openseadragon.github.io/
- THREE.js Documentation: https://threejs.org/docs/
- PDF.js Documentation: https://mozilla.github.io/pdf.js/

### 15.3 MMGIS Code Files
- `src/essence/Basics/Map_/Map_.js` - 2D Leaflet implementation
- `src/essence/Basics/Globe_/Globe_.js` - 3D globe abstraction
- `src/essence/Basics/Globe_/GlobeRenderer.js` - Renderer abstraction layer
- `src/essence/Basics/Layers_/Layers_.js` - Shared layer management
- `src/essence/Basics/Viewer_/Viewer_.js` - Viewer panel controller
- `src/essence/Basics/Viewer_/OpenSeadragonViewer.js` - Image viewer
- `src/essence/Basics/Viewer_/PhotosphereViewer.js` - 360° viewer
- `src/essence/Basics/Viewer_/ModelViewer.js` - 3D model viewer
- `src/essence/Basics/Viewer_/PDFViewer.js` - PDF document viewer
- `src/essence/Basics/Viewer_/VideoPlayer.js` - Video playback

---

## 16. Changelog

### Version History
- **Pre-2025**: Initial implementation with LithoSphere + Leaflet
- **2024-2025**: Added Cesium renderer option
- **2025-12-18**: Retrospective documentation created
- **2025-12-22**: Added comprehensive Viewer panel documentation (OpenSeadragon, Photosphere, ModelViewer, PDFViewer, VideoPlayer)

---

**Document Status**: ✅ Complete
**Review Status**: 🔍 Pending technical review
**Implementation Status**: ✅ Deployed and operational
