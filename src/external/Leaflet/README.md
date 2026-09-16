# src/external/Leaflet

Leaflet itself is a managed dependency (`leaflet@^1.9.4` in the root `package.json`), imported
in `src/index.js` together with `leaflet/dist/leaflet.css`. It is still exposed as the
`window.L` global — thousands of `L.*` call sites and `MapRenderer`'s `raw` escape hatch rely
on it.

Everything left in this folder is a Leaflet **plugin** that cannot be consumed from npm
as-is. Each file below records the upstream release it came from and the local divergence, so
future upgrades have a starting point. Diffs were taken after normalizing formatting
(prettier) and stripping UMD wrappers, since every vendored file has its wrapper replaced by
MMGIS' `if (window.L) factory(window.L)` form.

If you update one of these files, update its row here as well.

## Plugins kept as deliberate forks

| File | Upstream | Local divergence |
| --- | --- | --- |
| `leaflet.draw.js` | `leaflet-draw@1.0.4` (`dist/leaflet.draw.js`) | Identical except middle-vertex marker opacity `.6` → `.4`. |
| `leaflet.draw.css` | `leaflet-draw@1.0.4` | All `background-image: url('images/spritesheet.*')` rules commented out — MMGIS supplies its own toolbar icons and does not ship Leaflet.draw's sprite images. |
| `leaflet-editable.js` | `leaflet-editable@1.1.0` (`src/Leaflet.Editable.js`) | Vertex icon sizes forced to 12×12 (upstream 8×8 / 20×20 touch), middle-marker opacity `0.5` → `0.4`, two early `return`s dropped in the vertex drag handlers, `connect(e)` → `connect()`, comment typo fixes. |
| `leaflet.snap.js` | `makinacorpus/Leaflet.Snap` (GitHub; npm `leaflet-snap@0.0.4` is an unrelated plugin) | Pinned to a pre-2020 snapshot: upstream later added point-layer snapping preference (`pointsWithinTolerance`) that this copy does not have. Adopting it would change Draw snapping behavior. |
| `leaflet.hotline.js` | `leaflet-hotline@0.4.0` (`src/leaflet.hotline.js`) | `gradient.addColorStop` wrapped in try/catch that warns on bad palette colors instead of throwing. |
| `leaflet.pattern.js` | `teastman/Leaflet.pattern` (npm `leaflet.pattern@0.1.0`) | Adds `L.ImagePattern` and image-shape support that the published release does not contain. |
| `leaflet-pip.js` | `@mapbox/leaflet-pip@1.1.0` | Keeps the Leaflet-aware API MMGIS uses: accepts `L.LatLng`, arrays of layers, and `L.MultiPolygon`; upstream 1.1.0 narrowed `pointInLayer` to `[lng, lat]` + `layer.eachLayer`. |
| `leaflet-velocity.js` | `leaflet-velocity@2.1.1` (`dist/leaflet-velocity.js`) | Null-map guards, MPH conversion, GeoJSON-feature-style input, global-grid fallback, opacity restore timers, direct canvas opacity assignment. |
| `leaflet-velocity.css` | `leaflet-velocity@2.1.1` | Byte-identical; kept next to the forked JS. |
| `Leaflet.PolylineMeasure.js` | `ppete2/Leaflet.PolylineMeasure` master, file dated 2023-11-07 (newer than npm `leaflet.polylinemeasure@3.0.0`) | Adds a `showTooltips` option (default `true`) gating every tooltip `innerHTML`, and comments out the `movestart` → `_mapdragging` handler. |
| `Leaflet.PolylineMeasure.css` | same as above | Cursor rules scoped to `.polyline-measure-*` / `#unitControlId` instead of upstream's broader `.leaflet-control`. |
| `leaflet.rotatedMarker.js` | `leaflet-rotatedmarker@0.2.0` | `_setPos` rewrites an existing `rotateZ(...)` in the transform instead of appending a second one (avoids double rotation with `leaflet-polylinedecorator`). |
| `leaflet.tilelayer.gl.js` | `leaflet.tilelayer.gl@2.2.0` (`src/Leaflet.TileLayer.GL.js`) | Heavily extended: GeoTIFF tile decoding via the managed `geotiff` package with a shared worker `Pool`, MMGIS shaders in `shaders/`, extra uniform/colormap handling. |
| `leaflet.vectorGrid.bundled.js` | `leaflet.vectorgrid@1.3.0` (`dist/Leaflet.VectorGrid.bundled.js`) | MMGIS vector-tile styling/interaction changes; also see `plugins/core/layertypes/VectorTile/lib/SimplifiedVectorGrid.js`. |
| `Path.Drag.js` | `leaflet-path-drag` (classic `L.PathDraggable`, pre-`0.7`) | Trimmed to the canvas-aware `PathDraggable` MMGIS needs; the current npm package (1.9.x) is a full rewrite with a different API. |
| `L.Rain.js` | `leaflet-rain@0.2.0` | Browserify bundle with MMGIS matrix helpers inlined. |
| `L.Rain.css` | `leaflet-rain@0.2.0` | Byte-identical; kept next to the forked JS. |
| `proj4leaflet.js` | `proj4leaflet@1.0.0`–`1.0.2` | MMGIS adds a 4th `planetRadius` argument to `L.Proj.CRS` (sets `L.CRS.Earth.R`) for planetary projections — used by `src/essence/Basics/Map_/Map_.js`; also returns `-Infinity` instead of throwing when a zoom has no resolution. |
| `leaflet-corridor.js` | Derived from `adoroszlai/leaflet-distance-markers` (no npm release), whose MIT header is retained | MMGIS-authored `L.Corridor` (an `L.Polyline` subclass that renders a fixed-width corridor). |
| `leaflet-imagetransform.js` | `ScanEx/Leaflet.imageTransform` (no npm release) | Adds an image cache; provenance of the exact upstream revision not established. |
| `leaflet-latlng-graticule.js` | `cloudybay/leaflet.latlng-graticule` (no npm release) | ~160 changed lines for planetary lat/lng labeling. |
| `leaflet.scalefactor.min.js` | Pre-minified `L.Control.ScaleFactor`; upstream revision not identified | No npm release found; kept as-is. |
| `shaders/` (`vertex.glsl`, `fragment.glsl`) | MMGIS-authored | Used by `leaflet.tilelayer.gl.js`. |

## Moved to npm (no vendored copy left)

| Was | Now |
| --- | --- |
| `leaflet1.5.1.js` / `leaflet1.5.1_DEBUG.js` / `leaflet1.5.1.css` / `leaflet1.9.2.js` / `leaflet1.9.2.css` | `leaflet@^1.9.4` |
| `leaflet.geometryutil.js` | `leaflet-geometryutil@0.9.1` (vendored copy differed only in the UMD wrapper) |
| `leaflet.polylineDecorator.js` | `leaflet-polylinedecorator@1.6.0` (vendored copy differed only in the UMD wrapper and an `L` → `L$1` rename) |
| `proj4.js` (proj4 2.6.2) | `proj4` (already a dependency); `src/pre/proj4Global.js` sets `window.proj4` |

### Local patches that were in the deleted vendored copies

- `leaflet1.5.1.js` / `leaflet1.5.1_DEBUG.js`: none. Ignoring formatting, the unminified copy differed
  from upstream `leaflet-src.js` only in the build banner and `version` string (`1.5.1+build.2e3e0ffb`).
- `leaflet1.5.1.css`: three `background-image: url(images/...)` rules
  (`.leaflet-control-layers-toggle`, its retina variant, and `.leaflet-default-icon-path`) were commented
  out, because the vendored copy shipped without Leaflet's `images/` folder for webpack to resolve.
  `leaflet/dist/leaflet.css` restores them; they are inert here since MMGIS uses neither
  `L.Control.Layers` nor `L.Icon.Default` (every `L.marker` call passes an explicit icon).
- `proj4.js`: the UMD wrapper was replaced with an unconditional `window.proj4 = ...`, which is what
  `src/pre/proj4Global.js` now reproduces.
