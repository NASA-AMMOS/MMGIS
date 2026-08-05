# Layer-type plugins — the renderer contract

A **layer type** (`vector`, `tile`, `data`, `model`, …) is a plugin that owns how
a layer of that type is drawn and managed on each rendering surface. Every
built-in type is plugin-backed; there is no per-type branching left in core.

This document is the contract. If you implement these methods, core wires your
type into the map and both globe engines, opacity/visibility, the time bar,
refresh/reload, and teardown — with no core changes.

> The dispatcher and JSDoc typedefs live in
> [`src/essence/Basics/Layers_/interface/LayerInterface.js`](../../../src/essence/Basics/Layers_/interface/LayerInterface.js).

---

## Anatomy of a plugin

```
plugins/core/layertypes/<Type>/
  plugin.json                    # manifest (identity, capabilities, modules, configure-page config, …)
  map.js                         # map (Leaflet) renderer module       — optional
  globe/cesium.js                # Cesium globe renderer module        — optional
  globe/lithosphere.js           # LithoSphere globe renderer module   — optional
  globe/layerConfig.js           # engine-neutral globe layer config, shared
                                 #   by the engine modules — a helper, not a surface
  config.js                      # parse-time ownership of the config  — optional
  filter.js                      # the type's filtering strategy       — optional
  time.js                        # what time means to this type        — optional
  source.js                      # how the type acquires its data      — optional
  legend.js                      # a legend derived from the render     — optional
  lib/                           # anything else the type needs
```

`plugin.json` declares which surfaces/engines the type supports and maps them to
modules:

```jsonc
{
  "typeId": "tile",
  "overridable": false,
  "capabilities": {
    "renderers": {
      "map":   { "engines": ["leaflet"] },
      "globe": { "engines": ["cesium", "lithosphere"] }
    }
  },
  "modules": {
    "map": "./map",
    "globe": {
      "cesium": "./globe/cesium",
      "lithosphere": "./globe/lithosphere"
    }
  }
}
```

`modules` keys are **surfaces** — `map`, `globe.<engine>`, `config`, `filter`,
`time`, `source`, `legend` — not export names, which is why this is not the
`paths` of tools and interactions (there a key is the export identifier a mission
names in `"js"`). Every surface is optional: `Header` declares no modules at all
and `Model` has no `map`.

A type small enough not to want a directory of files may instead declare a single
`"module": "./myType"` exporting the same surface keys (`{ map, globe, config, … }`).

A surface a type does not support is `false` (e.g. `"map": false` for a
globe-only type). **Startup validation cross-checks `capabilities.renderers`
against the module files actually present** — a declared engine with no module
(or a module with no declared engine) is an error.

### `extends` — inherit a type you only differ from

`"extends": "<typeId>"` gives a type every surface and capability it doesn't
declare itself, from one parent. It is what makes "a vector whose data comes
from somewhere else" a one-file plugin rather than a fork of Vector:

```jsonc
{
  "typeId": "ogcfeatures",
  "extends": "vector",              // drawing, picking, filtering, both globes
  "module": "./ogcfeatures",        // export default { source: { fetch } }
  "capabilities": { "renderers": { "map": { "engines": ["leaflet"] } } }
}
```

Resolution is per surface, and one level deep only (a parent that itself
`extends` does not chain) — `LayerTypeRegistry.get()` merges the parent's
modules under the child's (`globe` merged per engine), and `capabilities()`
merges the parent's capabilities under the child's, one level into each group,
so overriding `map.styling` doesn't drop an inherited `map.stacking`. Declare
only what differs; the validator does not warn an extending type about
capabilities its parent supplies.

`npm run plugins -- create layertype <Name>` scaffolds a standalone renderer —
`map.js` with `make`/`destroy` — because it cannot know what you are building. If
your type draws like something MMGIS already draws, that scaffold is the wrong
starting point: delete `map.js`, put `"extends"` and a single `"module"` in the
manifest, and implement only the surface that differs.

Inheriting the *renderer* while replacing only `config` is the common case, and
it is why a new data source is usually a `config` surface (`expand` to turn one
entry into a service's collections, `resolveUrl` to have the last word on what
core fetches) rather than a renderer at all.

---

## The operations (identical on map and globe)

A renderer module is `export default { …operations }`. Both surfaces speak the
**same operation vocabulary**, so the interface reads identically on map and
globe — only the core defaults differ.

| operation | when it runs | required? | core default if you omit it |
|---|---|---|---|
| `make` | build the engine layer from data + register it | **required** | — |
| `render` | globe only: add an already-built engine layer config | optional | — |
| `destroy` | teardown | optional | generic engine removal (Leaflet `removeLayer` / native) |
| `setOpacity` | apply opacity | optional | engine-uniform applier (Leaflet/LithoSphere); Cesium needs a per-type applicator |
| `setVisibility` | show / hide | optional | same rule as `setOpacity` |
| `onToggle` | the layer finished being toggled, core's bookkeeping settled | optional | nothing extra to do |
| `setStyle` | dynamic restyle / render-param change (color maps, rescale, feature styles, COG params) | optional | no-op (styling is type-specific) |
| `timeChange` | the time bar moved | optional | reload the layer |

Data acquisition is not one of these operations. Core fetches, and core owns the
dynamic-extent refetch on pan/zoom (see `Layers_/capture/LayerCapturer`); a type
whose data does not come out of a url core can fetch declares the [`source`
surface](#source--data-core-cannot-fetch-itself) instead.

### Ownership rule

> **Core owns the semantic operation and all cross-cutting coordination**
> (opacity/visibility policy, ordering, the registries, sublayers/attachments,
> secondary maps, active-feature highlight). **A plugin supplies a method only
> where the engine has no uniform primitive core can call.**

That's why map plugins rarely implement `setOpacity`/`setVisibility` (Leaflet is
uniform), LithoSphere globe modules usually implement only `make` (it manages
layers natively by name), and Cesium modules implement more (imagery-alpha vs
entity-`show` vs primitive — no uniform primitive to lean on).

---

## The non-render surfaces

A type also owns the decisions core used to make *about* it. Each is a module
with its own small vocabulary, declared like any other surface
(`"modules": { "config": "./config/tile" }`), and each operation is optional with
a core default — a type that declares no `filter` module simply isn't filterable.

### `config` — the layer's config object is the type's

| operation | signature | when | core default |
|---|---|---|---|
| `expand` | `async (layerObj) → layerObj \| layerObj[]` | mission-config parsing, before `name` becomes the uuid | the entry is unchanged |
| `normalize` | `(layerObj) → layerObj` | parsing, before core reads the layer | unchanged |
| `resolveUrl` | `(url, layerObj, ctx) → url` | every time core resolves the layer's url | the url core resolved |

`expand` is how one configured layer becomes many: Vector turns a STAC catalog
url into a `header` whose sublayers are the catalog's children. Returned objects
go through the rest of parsing normally, so each one needs the identity fields a
configured layer has — a `uuid` unique among its siblings and a `name` (core
replaces `name` with the uuid as it parses) — and a sublayer must not carry the
parent's `sublayers`. Both operations may mutate and return `layerObj` or return
a new object; core uses the return value.

`resolveUrl` gets the **last** word, after core has expanded STAC, stripped
`COG:` and made mission-relative paths absolute; `ctx.wasCOG` says whether it
did. Tile uses it to re-root urls that come back out of MMGIS' own tile server.

```js
// config/tile.js
function normalize(layerObj) {
    if (layerObj.throughTileServer === true) layerObj.tileformat = 'wmts'
    return layerObj
}

function resolveUrl(url, layerObj, ctx = {}) {
    if (!(layerObj.throughTileServer || ctx.wasCOG) || F_.isUrlAbsolute(url))
        return url
    return window.mmgisglobal.IS_DOCKER === 'true' ? `/${url}` : `../../${url}`
}

export default { normalize, resolveUrl }
```

### `filter` — the type's filtering strategy

| operation | signature | when | core default |
|---|---|---|---|
| `getAggregations` | `async (layerName, filters, ctx) → Object` | the filter UI needs what can be filtered on | none |
| `filter` | `async (layerName, filters, ctx) → void` | the layer's filter state is applied | none |

Declaring `filter` **is** what makes a layer filterable (`Filtering.isFilterable`
asks for the op, not a capability), so a type with no strategy needs no opt-out.
Where the features live is the type's business, not core's: Vector filters
locally, but dispatches to the server for a geodataset-backed layer holding only
what is in view. `filters` is the layer's filter state and is also where a type
may cache (Vector keeps its GeoJSON there); `ctx.refresh` asks it not to.

### `source` — how the type acquires its data

| operation | signature | when | core default |
|---|---|---|---|
| `fetch` | `async (layerObj, ctx) → GeoJSON` | every acquisition of a vector-ish layer: initial make, refresh, time change and each dynamic-extent view change | core's own url transports (a file/api url, a `geodatasets:` name, KML) |

Declare `source` when the layer's data does not come out of a url that core can
fetch — a `POST` body, request headers, pagination, an SDK, several requests
stitched together. It is the *only* thing that moves out of core: the extent,
the debounce and settling, the zoom gate, request staleness, the move threshold,
clearing and updating the layer, and telling reload subscribers all stay core's,
so `fetch` is a pure "given this, give me GeoJSON" function.

Return a `FeatureCollection` (a bare array of features or `{ Features }` is
normalized), or `null` to leave the layer as it is. Throwing is logged and
treated as `null`. A `source`-backed type may have no `url` configured at all.

| `ctx` field | what it is |
|---|---|
| `url` | the layer's url with time placeholders resolved and mission-relative paths made absolute; `''` when the layer has none |
| `trigger` | `'make'` (initial/refresh), `'view'` (dynamic extent moved) or `'time'` (the time window moved) |
| `view` | the current extent for a dynamic-extent request: `minx`/`miny`/`maxx`/`maxy`, `zoom`, `tilt`, `center`, and `source` (`'map'` or `'globe'`) — `null` otherwise |
| `dynamicExtent` | `true` when this is a viewport-driven request |
| `crsCode` | the mission's CRS code without its `EPSG:` prefix |
| `time` | `{ start, end, startProp, endProp, requery }` for a time-enabled layer, else `null` |
| `filters` | the layer's encoded value filters, when a filter is active |
| `spatialFilter` | the layer's encoded spatial filter, when one is active |

`ctx.view` is `null` — and `trigger` is never `'view'` — unless the layer opts
into dynamic extent with `variables.dynamicExtent: true`. That is a layer
configuration setting rather than something the type declares, so a
viewport-driven source should default it in its `config.expand` (and offer it as
a `config` row) rather than assume a mission author knows to set it. Note also
that a dynamic-extent layer is driven *only* by the view: core deliberately
leaves it out of the time-bar reload, so a layer that is both time-enabled and
dynamic-extent is refetched when the view settles, with the current time window
in `ctx.time`.

```js
// source.js — an OGC API Features collection, bbox-limited to the view
async function fetch(layerObj, ctx) {
    const url = new URL(ctx.url)
    url.searchParams.set('limit', layerObj.variables?.limit ?? 1000)
    if (ctx.view)
        url.searchParams.set(
            'bbox',
            [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy].join(',')
        )
    if (ctx.time?.requery)
        url.searchParams.set('datetime', `${ctx.time.start}/${ctx.time.end}`)

    const res = await window.fetch(url, { headers: { Accept: 'application/geo+json' } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

export default { fetch }
```

**What the inherited renderer does with what you return.** A type that
`extends` `vector` gets Vector's styling, and it reads the features you produced
— so styling a `source` type is a matter of what `fetch` puts in each feature,
not of writing a renderer. In precedence order:

| what | where | notes |
|---|---|---|
| a per-feature override | `feature.properties.style` | a Leaflet path-options object (`color`, `weight`, `fillColor`, `fillOpacity`, `radius`, `dashArray`, and `minZoom`/`maxZoom` to hide the feature outside a zoom range). It **replaces** the configured style for that feature, and it is the only styling that wins over everything below |
| a legend the layer derived | `layerObj._legend` entries with `styleMatching` | colours a feature by matching one of its properties; see the `legend` surface below |
| the layer's configured style | `style` in the layer config | Configure's per-layer colour/weight/radius. A value of `prop-<name>` means "read this from the feature's property `<name>`", so `"color": "prop-magnitude"` colours from data with no per-feature style at all |

So the cheapest way to style live data is to compute the property you want to
style by in `fetch`, and let the mission's `style` name it with `prop-`; write
`properties.style` only when a feature must look a specific way regardless of
how the layer is configured.

### `legend` — a legend that comes from the render, not the config

| operation | signature | when | core default |
|---|---|---|---|
| `derive` | `(layerObj) → boolean` | the LayersTool/LegendTool wants a legend and the layer has none configured | nothing — the layer simply has no legend |

`derive` is handed the layer's config, not its data. Render state you need to
build a legend from lives on the live layer — `L_.layers.layer[layerObj.name]`
for what the map is holding, `layerObj.variables`/`layerObj._cogRange` and
friends for render parameters — so a legend derived from the *data* (a value
range, a category set) is cheapest to compute in `source.fetch` or `make` and
stash on the layer for `derive` to read.

Most legends are configured (`legend` url, `variables.legend`) and core reads
them. Declare `legend` when the legend *is* the render: a single-band COG's
colormap over its rescale range, a data shader's ramp, a velocity magnitude
scale. Write the entries to `layerObj._legend` (the shape the LegendTool draws,
also reachable via `mmgisAPI.overwriteLegends`) and return `false` if this
particular layer has nothing to derive after all.

### `time` — what a time change means to this type

| operation | signature | when | core default |
|---|---|---|---|
| `format` | `(date, layerObj) → string` | a time is written into a request | `layerObj.time.format`, else ISO `%Y-%m-%dT%H:%M:%SZ` |
| `applyTimeParams` | `(layerObj, ctx) → void` | the time window moved | nothing is stamped, so the layer reloads |

These are the *other* half of time support: `timeChange` on the render surface
rebuilds or scrubs the layer, while `applyTimeParams` is for a type that takes
the window as request parameters and so never needs rebuilding — Tile stamps
`time`/`starttime`/`endtime` onto the live layer and the next tile request
carries them. Whether the type appears in the time bar at all, and whether it
contributes an availability histogram, are capabilities (below), because core
asks them while partitioning every layer.

---

## Signatures & context

Every operation is `(layerObj, ctx)` — the layer's own mission-config object
(the same mutable object for the layer's whole life, so what you write in `make`
is there in `setStyle`) plus the context for the surface you are on.

### Map — `ctx`, and `mctx` from it

```js
import MapRenderer from '@basics/Map_/MapRenderer'
const mctx = MapRenderer.context(ctx.mapContext)
MapRenderer.addTile(layerObj, { … }, mctx)     // neutral primitives
MapRenderer.addVector(layerObj, { … }, mctx)
```

| `ctx` field | what it is |
|---|---|
| `mapContext` | the frozen map context to resolve into an `mctx`; absent ⇒ the main map |
| `data` | the acquired data for this make, when core acquired it (GeoJSON for vector-ish types) |
| `startTime`, `endTime` | the current time window, on `timeChange` |

| `mctx` field | what it is |
|---|---|
| `engine` | `'leaflet'` — branch on this, never on a global |
| `map` | the `L.Map` for **this** context (the main map or a secondary one) |
| `layerRegistry` | `L_.layers` for this context — where `.layer[name]`, `.opacity[name]`, `.on[name]` live |
| `default` | `true` on the main map; `false` in a secondary map, where core skips some bookkeeping |
| `raw` | `window.L` — the explicit engine escape hatch |

### Globe — `gctx`

`gctx` is built per dispatch by `GlobeRenderer._globeCtx`. Neutral across both
engines:

| `gctx` field | what it is |
|---|---|
| `engine` | `'cesium'` or `'lithosphere'` |
| `renderer` | the raw engine handle (a `Cesium.Viewer`, or the LithoSphere instance) |
| `raw` | the engine *namespace* — `Cesium` on Cesium, `LithoSphere` on LithoSphere — so a module needn't import (and bundle a second copy of) the engine. The globe twin of `mctx.raw`. Symmetric in name only: `Cesium` is the engine's whole API, while the `lithosphere` package exports one thing, the globe class, so on LithoSphere `raw` is a formality and the work happens through `renderer` and `window.THREE` (below) |
| `layers` | `{ [layerName]: { type, kind, … } }` — the shared record of what the engine is holding (below) |
| `addEngineLayer(type, layerConfig)` | add an already-built engine config (async) |
| `hasLayer(name)`, `toggleLayer(name, visible)`, `removeLayer(name)` | the by-name lifecycle both engines implement generically |
| `clampToGround` | `true` when this dispatch is for the `clamped` variant rather than plain `vector` |
| `visible` | on `onToggle`: the toggle's new state |
| `currentTime` | on `timeChange`: the playhead, for in-place scrub |

On LithoSphere, `renderer` is the live globe: `renderer.layers` (its own layer
records, by kind), `renderer.scene`/`scenesLOD`/`sceneFront`/`sceneBack` (the
THREE scene graphs it renders in order), `renderer.projection` (lat/lng ↔ world
coordinates, including `radiusScale`), `renderer.controls` and `renderer.setCenter`.
The THREE it draws with is **not** exposed on `raw`, but MMGIS vendors THREE and
puts it on the window (`src/external/THREE/three118.js`, imported by `src/index.js`),
so a LithoSphere module builds geometry with `window.THREE` — read per call, not at
import time — rather than adding a `three` dependency of its own. MMGIS has none;
that global is the only copy.

Cesium only:

| `gctx` field | what it is |
|---|---|
| `requestRender()` | ask for a frame — **required** after mutating the scene in `requestRenderMode` |
| `loadingLayers`, `vectorLoadToken`, `pendingVectorReload`, `pendingVectorRemoval`, `displayedVectorDataSource` | core's collection-level reload serialization; read, don't reinvent |
| `runPendingVectorReload(name)` | run a reload that was queued behind an in-flight one |
| `utils.calculateImageryIndex(name, ordered)` | where this layer belongs in Cesium's separately-ordered imagery stack |

LithoSphere only:

| `gctx` field | what it is |
|---|---|
| `geojsonHasPolygons(geojson)` | LithoSphere needs polygons declared up front |

`gctx.layers[name]` is the record core dispatches from, and **`make` is expected
to write it**:

| field | meaning |
|---|---|
| `type` | the MMGIS layer type — how core finds its way back to *your* globe module |
| `kind` | what the engine is actually holding: `'imagery'`, `'entities'`, `'tileset'`, `'mvt'`, `'gradient'`. Engine vocabulary on purpose — core's own engine work (imagery ordering, `DataSource` vs primitive) keys off it rather than off a list of layer types |
| anything else | yours; keep the engine handles you need for `destroy`/`setStyle` here |

A `kind` core doesn't know is fine as long as your module implements the ops core
would otherwise handle generically for that kind.

Use neutral `MapRenderer`/`GlobeRenderer` primitives first; drop to the engine
(`mctx.raw`, `gctx.raw` for the namespace and `gctx.renderer` for the live
instance) only for engine-specific behavior — e.g. a custom `L.Layer` (as
`data`/`image`/`video` already do), or a Cesium entity type core has no neutral
primitive for.

**Globe operations are not passed a layer object.** Only `make` gets one; every
other globe op is dispatched by layer *name*, because core is dispatching from
`gctx.layers[name]` — which is also where you should have stashed whatever the
op needs:

| globe operation | signature |
|---|---|
| `make` | `(layerObj, gctx)` |
| `render` | `(layerConfig, gctx)` |
| `destroy`, `setStyle` | `(layerName, gctx)` |
| `setVisibility` | `(layerName, visible, gctx)` |
| `setOpacity` | `(layerName, opacity, gctx)` |
| `timeChange` | `(layerName, gctx)` — the playhead is `gctx.currentTime` |

The new value for `setVisibility`/`setOpacity` is that positional argument, not
a `gctx` field. `L_.layers.data[layerName]` is the layer's live config if you
need it — reach it with `import L_ from '@basics/Layers_/Layers_'`, as core's own
globe modules do, rather than `window.L_`; the alias resolves under webpack and
keeps the module importable by a unit test. (An *attachment* is the exception: it
reads `window.L` per call because Leaflet's global is what it decorates.)

---

## Default interactions (click / hover)

Feature events are **not** layer-type methods — they are a separate, composable
system (Interaction plugins + `InteractionRunner`). To give your type a default
click/hover behavior, declare it in the manifest:

```jsonc
"capabilities": {
  "defaultInteractions": {
    "click": ["info:open"],
    "hover": ["cursor:show"]
  }
}
```

The values are the `interactionId`s of enabled interaction plugins (see
`plugins/core/interactions/*/plugin.json`). Core merges these with the layer's
own configured interactions (`resolveLayerInteractions`), with precedence
lowest → highest: type defaults → the legacy per-layer `kind` pipeline →
the layer's explicit `interactions`. Built-in types ship no `defaultInteractions`
because they already resolve through `kind`; the field exists for new types.

---

## Capabilities — what core reads instead of asking

Capabilities answer the questions core must ask while iterating or partitioning
**all** layers, where calling a per-layer operation would be backwards (draw
order, which layers the time bar covers, which are pickable). They are declared,
not inferred — and they are the one part of this contract that fails *quietly*
if you get it wrong, so validation checks them: a wrong type or value is an
error, an unknown key warns (typo), and omitting one core acts on warns too.

| capability | what core does with it | default if omitted |
|---|---|---|
| `renderers.map` / `renderers.globe` | which surfaces/engines this type renders through; cross-checked against `modules` | renders on neither |
| `structural` | the type organizes the layer tree rather than carrying data (`header`), so it is skipped by ordering, loading and the map entirely | it has data |
| `map.stacking` | which 2D pane it draws in: `"raster"` (under vectors) or `"overlay"` | `false` — left out of 2D draw ordering |
| `map.redrawOnReorder` | it must be re-added to be reordered rather than restacked in place | restacked in place |
| `map.tracksLoad` | core waits on its 2D load before counting the map loaded | it is tracked |
| `map.refreshByRemake` | a refresh interval remakes the layer instead of reloading its data | reloaded |
| `map.stacEndpoint` | which STAC endpoint a `stac:` url of this type resolves through: `"tiles"`, `"terrain"` or `"preview"` | `"preview"` |
| `map.picking` | its features can be clicked/identified, so core wires feature selection | not pickable |
| `map.styling` | its features carry their own style, so core may restyle them (highlight, filter dimming) | not restyled |
| `time` | the type understands time at all (`true`, or the object form below) | no time support |
| `time.histogram` | it can report when data exists over time, so the time bar draws its availability sparkline | no histogram |
| `defaultInteractions` | default click/hover interaction ids for the type (see above) | none |

Every capability in this table is read by core. There is deliberately no
descriptive capability: filterability follows from declaring a `filter` module
and identifiability from `map.picking`, so `capabilities.filtering` /
`capabilities.identify` — which nothing read — are gone, and declaring one now
warns as an unknown key. Documentation about what data a type accepts belongs in
`supportedData`.

---

## Validation

The contract is enforced in two complementary layers:

1. **Manifest** (`API/pluginValidation.js`, runs at startup and in the CLI):
   validates the `capabilities` shape against the table above and cross-checks
   declared engines ↔ the `modules` renderer modules — a type can't claim a
   `map`/`globe.<engine>` renderer it ships no module for, nor ship a module for
   a surface it doesn't declare.
2. **Module** (`npm run plugins -- validate`): statically parses each module's
   `export default {}`, requires `make` on a render surface, and rejects unknown
   operation names and phase names (and `afterCommit` outside `make`) — so a
   typo like `destory` fails loudly instead of silently falling back to the
   core default. Each surface is checked against **its own** vocabulary: a
   `render` in a map module or a `normalize` in a globe module is an error.

---

## Appendix: phases (`before → main → after`)

An operation is normally just a function, and that is the form to reach for.
Where you need to run something around what core would do, the same operation
may instead be an object of phases:

```js
export default {
    // the form you want: a bare function === { main: fn }
    make(layerObj, ctx) { /* build + register the layer */ },

    // only where you need to wrap rather than replace
    setStyle: {
        before(layerObj, ctx) {},
        main(layerObj, ctx)   {},   // providing `main` REPLACES the core default
        after(layerObj, ctx)  {},
    },
}
```

- `before` and `after` always wrap whatever runs in `main` — your `main` **or**
  the core default. That is the point of the form: `{ after }` with no `main`
  lets you add to core's behavior instead of taking it over.
- Providing `main` **is** the override of the core default.
- **`make` has one extra phase, `afterCommit`**, which runs *after* the
  make-lock releases (see `Map_.makeLayer`). Vector is the reason the form
  exists — its filtering has to straddle that lock:

  ```js
  make: {
      main(layerObj, ctx)        { /* build the vector layer */ },
      after(layerObj)            { Filtering.updateGeoJSON(layerObj.name) }, // in-lock
      afterCommit(layerObj)      { Filtering.triggerFilter(layerObj.name) }, // post-lock
  }
  ```

If you are writing a new type and reaching for phases, check first that you
aren't reimplementing something core already does around your `main`.

---

## Checklist for a new type

1. `plugin.json` — `typeId`, `capabilities.renderers`, `modules`, `supportedData`.
2. Implement **`make`** for each surface you support (a bare function is fine).
3. Add only the other operations your engine can't do uniformly for you.
4. Prefer neutral primitives; use the raw escape hatch only when necessary.
5. Declare default interactions in the manifest if your type needs them.
6. Add the non-render surfaces your type needs (`config`, `filter`, `time`).
7. Run `npm run plugins -- validate`, then `npm run plugins -- activate` to
   regenerate `src/pre/layertypes.js` — never hand-edit it.
