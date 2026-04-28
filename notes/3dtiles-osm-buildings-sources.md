# Free Sources for OSM 3D Building Tiles (No Cesium Ion Required)

## Hosted Services

### MapTiler 3D Tiles (Recommended)
- **URL**: https://www.maptiler.com/3d-tiles/
- **Free tier**: 100,000 tile requests/month
- **API key**: Required (free with account registration, not a Cesium ion token)
- **Coverage**: Global OSM buildings with extruded heights
- **Format**: Cesium 3D Tiles (b3dm)
- **License**: ODbL (OpenStreetMap data), MapTiler ToS
- **Example**:
  ```
  https://api.maptiler.com/tiles/v3-4326/tiles.json?key=YOUR_MAPTILER_KEY
  ```

### Google Photorealistic 3D Tiles
- **URL**: https://developers.google.com/maps/documentation/tile/3d-tiles
- **Free tier**: $200/month free Google Maps Platform credit
- **API key**: Google Maps API key required
- **Coverage**: Major metro areas (photorealistic mesh, NOT OSM extrusions)
- **Caveat**: Google ToS restrictions (attribution, no caching, limited use cases)

### 3D BAG (Netherlands Only)
- **URL**: https://3dbag.nl/
- **Free**: Completely free, no API key needed
- **Coverage**: All buildings in the Netherlands (LOD1.2, LOD1.3, LOD2.2)
- **Format**: Pre-built 3D Tiles with tileset.json endpoints
- **License**: CC BY 4.0

### PLATEAU (Japan Only)
- **URL**: https://www.geospatial.jp/ckan/dataset/plateau
- **Free**: Completely free, no API key needed
- **Coverage**: Many Japanese cities (CityGML and 3D Tiles)

## Self-Hosted / DIY Options

### py3dtiles
- **URL**: https://gitlab.com/Oslandia/py3dtiles
- **Approach**: Python library to convert point clouds, CityGML → 3D Tiles
- **License**: Apache 2.0 / LGPL
- **Status**: Actively maintained

### 3DCityDB
- **URL**: https://www.3dcitydb.org/
- **Approach**: Import CityGML into PostgreSQL/PostGIS, export as 3D Tiles
- **License**: Apache 2.0
- **Pipeline**: OSM buildings → CityGML → 3DCityDB → 3D Tiles

### Roll Your Own from OSM Data
- Extract building footprints via Overpass API or PBF files
- Extrude based on height/levels tags
- Generate b3dm tiles, create tileset.json hierarchy
- Tools: loaders.gl, gltf-pipeline, CesiumGS/3d-tiles-tools

## NOT Free Without Ion Token

### Cesium OSM Buildings
- Requires Cesium ion token (asset ID 96188)
- Free tier: 500 monthly sessions — but still needs the token

## Recommendation for MMGIS

**MapTiler** is the lowest-friction option: provides a standard tileset.json URL
that `Cesium3DTileset.fromUrl()` can consume directly, requiring only a query
parameter API key. Good for development and moderate production use.

For full independence from third-party services, use **py3dtiles** or **3DCityDB**
to self-host tiles generated from OSM data.
