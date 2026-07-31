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
  plugin.json                    # manifest (identity, capabilities, paths, …)
  metaconfig.json                # configure-page metadata
  map/<type>.js                  # map (Leaflet) renderer module      — optional
  globe/cesium/<type>.js         # Cesium globe renderer module        — optional
  globe/lithosphere/<type>.js    # LithoSphere globe renderer module   — optional
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
  "paths": {
    "map": "./map/tile",
    "globe.cesium": "./globe/cesium/tile",
    "globe.lithosphere": "./globe/lithosphere/tile"
  }
}
```

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

## Validation

The contract is enforced in two complementary layers:

1. **Manifest** (`API/pluginValidation.js`, runs at startup and in the CLI):
   validates `capabilities.renderers`/`defaultInteractions` shape and
   cross-checks declared engines ↔ the `paths` renderer modules — a type can't
   claim a `map`/`globe.<engine>` renderer it ships no module for, nor ship a
   module for a surface it doesn't declare.
2. **Module** (`node plugins/plugin-cli.js validate`): statically parses each
   renderer module's `export default {}`, requires `make`, and rejects unknown
   operation names and phase names (and `afterCommit` outside `make`) — so a
   typo like `destory` fails loudly instead of silently falling back to the
   core default.

---

## Checklist for a new type

1. `plugin.json` — `typeId`, `capabilities.renderers`, `paths`, `supportedData`.
2. Implement **`make`** for each surface you support (a bare function is fine).
3. Add only the other operations your engine can't do uniformly for you.
4. Prefer neutral primitives; use the raw escape hatch only when necessary.
5. Declare default interactions in the manifest if your type needs them.
6. Run the plugin CLI validator, then the app; regenerate the registry
   (`node -e "require('./API/updateTools').updateLayerTypes()"`) — never
   hand-edit `src/pre/layertypes.js`.
