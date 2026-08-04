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
`time` — not export names, which is why this is not the
`paths` of tools and interactions (there a key is the export identifier a mission
names in `"js"`). Every surface is optional: `Header` declares no modules at all
and `Model` has no `map`.

A type small enough not to want a directory of files may instead declare a single
`"module": "./myType"` exporting the same surface keys (`{ map, globe, config, … }`).

A surface a type does not support is `false` (e.g. `"map": false` for a
globe-only type). **Startup validation cross-checks `capabilities.renderers`
against the module files actually present** — a declared engine with no module
(or a module with no declared engine) is an error.

---

## The operations (identical on map and globe)

A renderer module is `export default { …operations }`. Both surfaces speak the
**same 7-operation vocabulary**, so the interface reads identically on map and
globe — only the core defaults differ.

| operation | when it runs | required? | core default if you omit it |
|---|---|---|---|
| `load` | every time data is (re)acquired: initial make, refresh interval, time requery, dynamic-extent reload | optional | none (types that fetch inside `make` don't need it) |
| `make` | build the engine layer from data + register it | **required** | — |
| `destroy` | teardown | optional | generic engine removal (Leaflet `removeLayer` / native) |
| `setOpacity` | apply opacity | optional | engine-uniform applier (Leaflet/LithoSphere); Cesium needs a per-type applicator |
| `setVisibility` | show / hide | optional | same rule as `setOpacity` |
| `setStyle` | dynamic restyle / render-param change (color maps, rescale, feature styles, COG params) | optional | no-op (styling is type-specific) |
| `timeChange` | the time bar moved | optional | reload the layer |

`load` is **not** a once-per-layer hook — it runs on every (re)acquisition. A
future `init` (once per layer) is intentionally out of scope.

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
go through the rest of parsing normally.

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

## Phases — `before → main → after`

Every operation may be a bare function **or** a nested object of phases:

```js
export default {
    // shorthand: a bare function === { main: fn }  ← the 95% case
    make(layerObj, ctx) { /* build + register the layer */ },

    // full form: opt into phases only where you need them
    setStyle: {
        before(layerObj, ctx) {},
        main(layerObj, ctx)   {},   // providing `main` REPLACES the core default
        after(layerObj, ctx)  {},
    },
}
```

- `before` and `after` always wrap whatever runs in `main` (your `main` **or**
  the core default).
- Providing `main` **is** the override of the core default.
- **`make` has one extra phase, `afterCommit`**, which runs *after* the
  make-lock releases (see `Map_.makeLayer`). Vector uses it to trigger
  filtering, which bails while the lock is held:

  ```js
  make: {
      main(layerObj, ctx)        { /* build the vector layer */ },
      after(layerObj)            { Filtering.updateGeoJSON(layerObj.name) }, // in-lock
      afterCommit(layerObj)      { Filtering.triggerFilter(layerObj.name) }, // post-lock
  }
  ```

---

## Signatures & context

**Map module** — `(layerObj, ctx)`. Reach Leaflet through `MapRenderer`:

```js
import MapRenderer from '@basics/Map_/MapRenderer'
const mctx = MapRenderer.context(ctx.mapContext)
MapRenderer.addTile(layerObj, { … }, mctx)     // neutral primitives
MapRenderer.addVector(layerObj, { … }, mctx)
mctx.raw                                        // explicit Leaflet escape hatch
```

**Globe module** — `(layerObj|name, …, gctx)`. `gctx` is the frozen engine
context: the raw engine handle, the shared `_layers` registry, and
collection-level helpers that stay in core. `timeChange`'s `gctx.currentTime`
carries the playhead for in-place scrub implementations.

Use neutral `MapRenderer`/`GlobeRenderer` primitives first; drop to the raw
handle (`mctx.raw` / `gctx.renderer`) only for engine-specific behavior — e.g. a
custom `L.Layer` (as `data`/`image`/`video` already do).

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
| `filtering`, `identify` | **descriptive only** — no core code reads them; filtering follows from a `filter` module, picking from `map.picking` | — |

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

## Checklist for a new type

1. `plugin.json` — `typeId`, `capabilities.renderers`, `modules`, `supportedData`.
2. Implement **`make`** for each surface you support (a bare function is fine).
3. Add only the other operations your engine can't do uniformly for you.
4. Prefer neutral primitives; use the raw escape hatch only when necessary.
5. Declare default interactions in the manifest if your type needs them.
6. Add the non-render surfaces your type needs (`config`, `filter`, `time`).
7. Run `npm run plugins -- validate`, then `npm run plugins -- activate` to
   regenerate `src/pre/layertypes.js` — never hand-edit it.
