# Layer Types

MMGIS supports 10 layer types, each designed for different geospatial data formats. Layers are configured through the Configure page's Layers tab.

## Layer Type Summary

| Type | Description | Format |
|------|-------------|--------|
| **Vector** | GeoJSON or KML feature layers | `.geojson`, `.kml`, geodatasets |
| **Tile** | Hierarchical raster imagery | TMS, WMTS, WMS, COG |
| **Data** | Tabular datasets linked to features | CSV via datasets |
| **Model** | 3D models on the globe | `.glb`, `.gltf`, `.obj`, `.dae` |
| **Image** | Overlay images (non-tiled) | Direct image files |
| **Vector Tile** | Vector tiles for large datasets | Mapbox Vector Tiles |
| **Velocity** | Wind/velocity field visualization | Veloserver |
| **Video** | Video overlays | Video files |
| **Header** | Organizational headers (no data) | N/A |
| **Query** | Dynamic spatial query layers | PostGIS queries |

## Common Layer Properties

All layers share these core properties:
- **Layer Name**: Unique display name and identifier (no special characters)
- **URL**: Data source path (absolute or relative to mission directory)
- **Initial Visibility**: Whether the layer is on by default
- **Initial Opacity**: 0 (transparent) to 1 (opaque)
- **Legend**: Path to a `legend.csv` file

## Vector Layers

GeoJSON or KML layers. When URL ends with `.kml`, MMGIS auto-converts to GeoJSON.

Key properties:
- **Kind of Layer**: Special interaction type (see Kinds)
- **Controlled**: Whether the layer can be dynamically updated
- **Time Enabled**: Support `{starttime}` and `{endtime}` URL placeholders
- **Stroke/Fill Color**: CSS color strings or `prop:property_key` for data-driven styling
- **Visibility Cutoff**: Hide below a zoom level
- **Dynamic Extent**: Load data based on viewport (for large datasets)

URL formats:
- File path: `path/to/data.geojson`
- Geodataset: `geodatasets:geodataset_name`
- Time-enabled: `path/to/{starttime}/{endtime}/data.geojson`

## Tile Layers

Hierarchical raster imagery (slippy map tiles).

Key properties:
- **Tile Format**: TMS, WMTS, or WMS
- **DEM Tile URL**: Optional elevation data for 3D globe
- **Min/Max Zoom**: Zoom level bounds
- **Bounding Box**: Lat/lon bounds for tile requests
- **Composited Time Tile**: Composite tiles from time-varying data

URL format: `path/to/tiles/{z}/{x}/{y}.png`

## Data Layers

Tabular datasets (CSV) linked to features. Useful when features have extensive metadata that should be loaded on demand rather than upfront.

## Model Layers

3D models rendered on the globe. Supports `.glb`, `.gltf`, `.obj`, `.dae` formats.

## Query Layers

Dynamic layers that query PostGIS geodatasets spatially based on viewport bounds.

## Time-Enabled Layers

Any vector or tile layer can be time-enabled. Time controls appear in the TimeUI panel. URL placeholders:
- `{starttime}`, `{endtime}` — for vector layers
- `{time}` — for tile layers

Time types:
- **Requery**: Re-fetch data from source when time changes
- **Local**: Filter existing data by feature time properties

See `docs/pages/Configure/Layers/` for full documentation on each layer type.
