# MVT Sources for OSM Building Data

Sources that serve Mapbox Vector Tiles (MVT/pbf) with building footprints
and height data, compatible with the MMGIS `vectortile3d` layer type.

## Free, No API Key

### OpenFreeMap
- **TileJSON**: `https://tiles.openfreemap.org/planet`
- **Resolve URL**: `node auxiliary/resolve-tile-url/resolve-tile-url.js https://tiles.openfreemap.org/planet`
- **Schema**: OpenMapTiles
- **Building sublayer**: `building` (with `render_height`, `render_min_height`, `colour`)
- **Max zoom**: 14
- **Rate limits**: None
- **API key**: None
- **License**: ODbL (OpenStreetMap)
- **Notes**: URL includes a dated version segment that changes with data updates.
  Re-run the resolve-tile-url tool when tiles stop loading.

### Versatiles
- **URL**: https://versatiles.org
- **Schema**: OpenMapTiles (same building sublayer structure)
- **Rate limits**: None
- **API key**: None
- **License**: ODbL
- **Notes**: Community-hosted, free. Check their docs for current tile endpoint.

### Self-Hosted OpenMapTiles
- **URL**: https://openmaptiles.org
- **How**: Download pre-built `.mbtiles` planet file, serve with tileserver-gl
- **Planet download**: https://data.maptiler.com/downloads/planet/ (free MapTiler account required for download, not for serving)
- **Serving**: `docker run -p 8080:8080 maptiler/tileserver-gl -p 8080 planet.mbtiles`
- **Schema**: OpenMapTiles
- **API key**: None (self-hosted)
- **License**: ODbL
- **Notes**: Full control, no external dependencies. Planet file is ~80GB.
  Can extract regional subsets with `ogr2ogr` or `osmium`.

## Free Tier, API Key Required

### MapTiler Cloud
- **URL**: https://www.maptiler.com/cloud/
- **Tile URL**: `https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=YOUR_KEY`
- **Schema**: OpenMapTiles
- **Free tier**: 100,000 requests/month
- **API key**: Required (free with registration)
- **License**: ODbL + MapTiler ToS

## OpenMapTiles Building Sublayer Properties

All sources using the OpenMapTiles schema expose these properties
in the `building` sublayer:

| Property | Description |
|----------|-------------|
| `render_height` | Height in meters for extrusion |
| `render_min_height` | Base height in meters (for elevated parts) |
| `colour` | Suggested building color |

Buildings typically appear at zoom 13+ in the OpenMapTiles schema.

## Configuring in MMGIS

1. Resolve the tile URL: `node auxiliary/resolve-tile-url/resolve-tile-url.js <tilejson-url>`
2. In Configure Page, create a `vectortile3d` layer:
   - **URL**: paste the resolved `{z}/{x}/{y}` URL
   - **Min Zoom**: 13
   - **Max Native Zoom**: 14
   - **Height Property**: `render_height`
   - **Base Height Property**: `render_min_height`
   - **Sublayer to Extrude**: `building`
   - **vtLayer** (2D style): `{ "building": { "fill": true, "fillColor": "#cccccc", "fillOpacity": 0.6, "weight": 0.5, "color": "#999999" } }`
