# Layer-attachment plugins — the attachment contract

A **layer attachment** is something extra drawn from a host layer's own data:
labels beside its features, a marker at every coordinate, pairing lines to other
layers, uncertainty ellipses, a 3D model at each point, a gradient along a path.
An attachment is not a layer type — it never appears in a mission's layer list.
It hangs off a host layer, is configured inside that host's `variables`, and is
built, shown, restyled and torn down with it.

This document is the contract. Implement `make`, declare where your settings live
and where you sit among your host's other attachments, and core does the rest —
with no core changes.

> Dispatch lives in
> [`src/essence/Basics/Layers_/display/sublayers.js`](../../../src/essence/Basics/Layers_/display/sublayers.js)
> and the registry in
> [`src/essence/Basics/Layers_/registry/LayerAttachmentRegistry.js`](../../../src/essence/Basics/Layers_/registry/LayerAttachmentRegistry.js).
> Start from `node plugin-cli/cli.js create layerattachment <Name> --container <container>`.

---

## Two shapes

|  | what it is | declares | example |
|---|---|---|---|
| **sublayer** | a renderable of its own, listed under the host's Composite Layers and separately toggleable | `capabilities.host.order` | Labels, Pairings, PathGradient |
| **decoration** | a change to how the host draws *its own* features — nothing is added to the map | `capabilities.host.decoratesHost: true` | Bearing (turns the host's markers to a heading) |

A sublayer implements `make`; a decoration has nothing to make and implements
`decorateFeature` / `globeStyle` instead.

---

## Anatomy of a plugin

```
plugins/<container>/layerattachments/<Name>/
  plugin.json        # manifest (identity, configPath, host placement, Configure form)
  <name>.js          # the one module
  tests/<name>.spec.js
```

```jsonc
{
  "name": "UncertaintyEllipses",
  "type": "layerattachment",
  "attachmentId": "uncertainty_ellipses",
  "configPath": "variables.markerAttachments.uncertainty",
  "capabilities": {
    "renderers": {
      "map":   { "engines": ["leaflet"] },
      "globe": { "engines": ["lithosphere"] }
    },
    "host": { "order": 2 }
  },
  "applicableLayerTypes": ["vector", "query"],
  "module": "./uncertaintyEllipses"
}
```

An attachment declares a single **`module`**, not the `modules` of a layer type:
it is *one* renderable that may straddle both engines (an uncertainty ellipse is
a map overlay **and** two globe layers), so there is nothing to split per
surface. It is also not the `paths` of tools and interactions, where a key is the
module's export name.

### Three names, deliberately distinct

| in the manifest | what it names | example |
|---|---|---|
| `attachmentId` | the attachment itself — how core dispatches, and the `type` your `make` returns | `image_overlays` |
| `configPath` | where its settings live in a **host layer's** config | `variables.markerAttachments.image` |
| `capabilities.host.sublayerKey` | the key it is stored under on its host (`L_.layers.attachments[host][key]`), defaulting to `attachmentId` | `models` |

They differ because the config structures are older than the plugin system
(`markerAttachments`, `coordinateAttachments`, `pathAttachments`) and mission
configs can't be renamed freely. Declaring all three is what lets core, the
plugin and the Configure page reach the same answer without a naming convention.

**Never read the host's config directly** — core resolves `configPath` for you
and hands the result to every operation as `ctx.config`. That is also how core
answers "does this host want this attachment at all", so your `make` is only
called for a host that asked: a `configPath` subtree that exists counts as
enabled unless it says `enabled: false`.

A host can also have asked through its **layer type**, which may declare you in
`capabilities.defaultAttachments` along with the settings it wants (see
[`../layertypes/README.md`](../layertypes/README.md)). Nothing changes for you —
`ctx.config` is the type's settings with the layer's own on top, field by field —
but it is worth knowing that a `ctx.config` you were handed does not imply an
admin ever opened your form, and that your `applicableLayerTypes` still decides
whether a type may declare you at all.

### Hosts

`applicableLayerTypes` lists the layer types this attachment applies to; omitting
it means all of them. A type that `extends` one of those types is included, so a
third-party type inheriting `vector` inherits its labels and pairings too.

---

## The operations

The module is `export default { …operations }`. Only `make` is required (and only
for a sublayer). Everything else falls back to a core default, so **write an
operation only where the default is wrong** — most attachments are an ordinary
map layer and need two or three.

| operation | signature | when it runs | core default if you omit it |
|---|---|---|---|
| `make` | `(ctx) → attachment \| false` | the host is built | nothing is added (`false`) |
| `syncData` | `(attachment, ctx)` | the host's data changed | `clearLayers()`, then re-`addData` the host's GeoJSON |
| `onConfigChange` | `(ctx)` | the attachment's settings changed while it was built | rebuild the host layer |
| `setVisibility` | `(attachment, ctx)` | the attachment, or its host, is shown/hidden | add to / remove from the 2D map |
| `setOpacity` | `(attachment, opacity, ctx)` | the host's or the attachment's opacity changed | `setOpacity`, falling back to `setStyle` on the layer |
| `setStyle` | `(attachment, ctx)` | feature highlight/fills were reset | no-op |
| `destroy` | `(attachment, ctx)` | the host layer is removed for good | no-op (the map removal already happened) |
| `onPeerToggle` | `(attachment, ctx)` | *any other* layer was toggled | no-op |
| `peerFeaturesFor` | `(attachment, ctx) → {origin, layerNames, peers} \| false` | core needs a feature's related features in other layers | none (no relations) |
| `decorateFeature` | `(ctx) → Object \| null` | the host is drawing one of its features | no decoration |
| `globeStyle` | `(ctx) → Object \| null` | the host's globe style is being composed | nothing merged in |
| `makeForFeature` | `(ctx)` | a feature was selected and this attachment is configured `show: 'click'` | no-op |
| `clearForFeature` | `(ctx)` | nothing is selected anymore | no-op |

Every operation may also be written in the nested `{ before, main, after }` form,
exactly as for layer types — providing `main` **is** the override of the core
default, while `before`/`after` wrap whatever runs.

### Contexts

`make` gets the host as it is being built:

```js
function make({ geojson, layerObj, leafletLayerObject, hostLayer, config, siblings }) {
    return {
        on: config.initialVisibility !== false,  // initial visibility
        type: 'uncertainty_ellipses',            // your attachmentId
        geojson,
        layer,                                   // what core adds to the map
    }
}
```

The returned object is what core stores on the host
(`L_.layers.attachments[hostName][sublayerKey]`, the host keyed as
`L_.layers.data` keys it and the key your `attachmentId` unless you declared
`capabilities.host.sublayerKey`) and hands back to every
per-instance operation, **verbatim** — so keys beyond the four below survive, and
stashing what a later operation needs on it (`_radius`, an engine handle, a
feature index) is the intended way to keep state. Return `false`, not `{}`, when
there is nothing to add.

| key | meaning |
|---|---|
| `type` | your `attachmentId`. Core and UI read this to find their way back to your plugin |
| `on` | initial visibility. Core adds it to the map only if true |
| `layer` | the Leaflet layer core adds, removes, orders and opacities for you |
| `geojson` | the data you built from, so `syncData` can diff and core can rebuild without re-deriving it. Yours, not the host's — return the subset you actually drew if it differs |

- `config` is your settings subtree — the value at your `configPath` on the host,
  or what the host's layer type declared for you in
  `capabilities.defaultAttachments`, with the host's own fields on top. Core
  never calls `make` with a `null` config: an attachment is built only for a host
  that asked for it, one way or the other, and an `enabled`-less config counts as
  enabled (the key's presence is the request). It can still be *partial*, so
  default your own values — which is why the scaffold and the examples here write
  `config?.x`: it costs nothing and it keeps a `make({})` in your unit test from
  throwing.
- `initialVisibility` is a convention rather than a core-read key: every core
  attachment treats `config.initialVisibility === false` as "built but not shown"
  and nothing else in core looks at it. Follow it, and give it a `config.rows`
  entry if an admin should be able to set it.
- `leafletLayerObject` is the host's own `onEachFeature`/`pointToLayer`/`style`,
  to reuse so your features look like their host's.
- `refreshLayer()` re-acquires the host's data (`await ctx.refreshLayer()`), for
  when you have changed what it *would* be — written to your own backend, say.
  It is the supported way to ask: the host goes through the same acquisition
  every other trigger does (a `source`-backed type sees `ctx.trigger ===
  'refresh'`), rather than you calling `Map_.refreshLayer` and its positional
  internals. Also on `onConfigChange`.
- `siblings` is only present if you declared
  `capabilities.host.buildsAfterSiblings: true` — declare it when you decorate
  the other attachments rather than the host (Labels labels the coordinate
  markers too, so it is built last and is handed what exists).

The per-instance operations get the built attachment plus
`{ hostName, attachmentName, … }`: `setVisibility` adds `visible`, `globeOnly`
and the `applyOrder`/`applyOpacity` callbacks core wants run after you show
something; `setOpacity` adds `source: 'host' | 'attachment'`; `syncData` adds the
new `geojson`, `onlyClear`, and — as `make` got them — `layerObj`, `config` and
`zIndex`, so a redraw needs nothing stashed; `onPeerToggle` adds the `layerName` that toggled
and its new state; `onConfigChange` adds `config`, `prevConfig`, `layerObj` and
the built `attachment` (its signature is `(ctx)` alone — core dispatches it after
writing the new settings, whether or not an instance exists, so read
`ctx.attachment` and treat `null` as "nothing built yet").

`onConfigChange` is what `mmgisAPI.setLayerAttachmentConfig(layerName,
attachmentId, config)` dispatches — core has already written the new settings
into the host's live config at your `configPath`, so implement it to retune in
place (a new ramp, a new label property) instead of paying for core's default,
which rebuilds the whole host layer.

The host-scoped operations (`decorateFeature`, `globeStyle`, `makeForFeature`,
`clearForFeature`) run without an instance — there may not be one — and get
`{ layerObj, feature?, config, … }` instead.

### Time

There is no time operation, and an attachment of a time-enabled layer does not
need one: when the time bar moves, the host reacquires or refilters its features
and core then calls your `syncData` with the new GeoJSON, so drawing from
`ctx.geojson` is already time-correct. An attachment that must follow the
*playhead* itself — fading a trail as time passes, with the host's data
unchanged — subscribes in `make` and unsubscribes in `destroy`:

```js
import TimeControl from '@basics/TimeControl_/TimeControl'

function make(ctx) {
    const attachment = { type: 'trail', on: true, /* … */ }
    const fid = `trail_${ctx.hostName}`
    TimeControl.subscribe(fid, () => redraw(attachment, TimeControl.getTime()))
    attachment._fid = fid
    return attachment
}

function destroy(attachment) {
    TimeControl.unsubscribe(attachment._fid)
}
```

Feature timestamps live in the feature's own properties, under the names the
*layer* configured (`layerObj.time.startProp` / `endProp`) — read them with
`F_.getIn`, never a hardcoded property name.

---

## Capabilities

Capabilities are what core reads while iterating *all* attachments, where calling
an operation would be backwards. They are validated: a wrong type or value is an
error, and an unknown key warns (so a typo is loud rather than silently inert).

| capability | what core does with it | default |
|---|---|---|
| `renderers.map` | whether this attachment draws on the 2D map at all | drawn on the map |
| `renderers.globe` | which globe engines it draws through | none |
| `host.order` | build order, which is also render order (later on top) | last, then alphabetical — **declare it** |
| `host.sublayerKey` | the key it is stored under on its host | the `attachmentId` |
| `host.buildsAfterSiblings` | built after its siblings and handed them as `ctx.siblings` | built in `order` |
| `host.decoratesHost` | it is a decoration, not a sublayer: never built, never listed, never toggled | it is a sublayer |
| `globe.suppressesHost` | on the globe this attachment *is* the host's geometry, so the host must not also be drawn (PathGradient) | host is drawn |

---

## The Configure form

`config` contributes rows to the Layer modal. Unlike a layer type — which owns
whole tabs — an attachment joins a tab, so it says which one and where:

```jsonc
"config": {
  "tab": "Attachment - Markers",   // the tab these rows join (created if new)
  "tabOrder": 12,                  // where that tab sits among the modal's tabs
  "order": 3,                      // where these rows sit within the tab
  "rows": [ { "subname": "Uncertainty Ellipses", "components": [ … ] } ]
}
```

Every `field` must be under the manifest's `configPath` — that is the same
subtree core resolves to `ctx.config`, so a form writing anywhere else produces
settings nothing reads. `<configPath>.enabled` is the switch that turns the
attachment on. (An `objectarray`'s item fields are the one exception: they are
relative to the array's own field — see the component table in
[`../../README.md`](../../README.md).)

`tab` should name a tab that **already exists** — `Attachment - Markers`,
`Attachment - Coordinates`, `Attachment - Layers`, `Attachment - Paths` — which is
why the scaffold defaults to one. A name no other attachment declares is not an
error: Configure quietly gives it a tab of its own holding your rows alone, which
an admin has no reason to open. `plugins -- validate` warns when yours is a tab of
its own, so a typo says so instead of disappearing.

---

## Validation

1. **Manifest** (`API/pluginValidation.js`, at startup and in the CLI): requires
   `attachmentId`, `module` and a `configPath` under `variables.`; checks the
   `capabilities` shape against the table above.
2. **Module** (`npm run plugins -- validate`): statically parses your
   `export default {}`, requires `make` (unless `decoratesHost`), and rejects
   unknown operation and phase names — so `makeForFeatures` fails loudly instead
   of never being called.

---

## Checklist for a new attachment

1. `npm run plugins -- create layerattachment <Name> --container <container>`.
2. Set `configPath`, `applicableLayerTypes` and `capabilities.host.order`, and
   point the `config` rows at that same `configPath`.
3. Implement `make` from `ctx.geojson`, returning `{ on, type, geojson, layer }`.
4. Add other operations **only** where a core default is wrong.
5. `npm run plugins -- validate`, then `npm run plugins -- activate` to
   regenerate `src/pre/layerattachments.js` — never hand-edit it.
6. Enable it on a layer in Configure and check it draws, hides, syncs and
   survives a layer removal.

---

## Worked example: a "radius rings" attachment

A ring of a configurable radius around each of the host's point features. It is
an ordinary map layer, so `make` is the whole plugin.

```jsonc
// plugins/mine/layerattachments/RadiusRings/plugin.json
{
  "name": "RadiusRings",
  "type": "layerattachment",
  "attachmentId": "radius_rings",
  "version": "1.0.0",
  "tier": "community",
  "overridable": true,
  "configPath": "variables.layerAttachments.radiusRings",
  "description": "A ring of a fixed radius around each of the host's point features.",
  "capabilities": {
    "renderers": { "map": { "engines": ["leaflet"] }, "globe": false },
    "host": { "order": 50 }
  },
  "applicableLayerTypes": ["vector", "query"],
  "config": {
    "tab": "Attachment - Markers",
    "tabOrder": 12,
    "order": 9,
    "rows": [
      {
        "subname": "Radius Rings",
        "components": [
          { "field": "variables.layerAttachments.radiusRings.enabled",
            "name": "Enabled", "type": "switch", "width": 3, "defaultChecked": false },
          { "field": "variables.layerAttachments.radiusRings.radiusMeters",
            "name": "Radius (m)", "type": "number", "width": 3 }
        ]
      }
    ]
  },
  "module": "./radiusRings"
}
```

```js
// plugins/mine/layerattachments/RadiusRings/radiusRings.js
// Read the Leaflet global per call, not at import time, so the module can be
// imported outside the browser (`npm run test:plugins:unit` does exactly that).
// Importing an MMGIS singleton — `F_` included — pulls jQuery and makes the
// module un-importable in a unit test, so this one stays dependency-free.
const leaflet = () => window.L
const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

const ringsOf = (geojson, radius) =>
    (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            return leaflet().circle([lat, lng], { radius, fill: false })
        })

function make({ geojson, config }) {
    const radius = num(config?.radiusMeters, 10)

    return {
        on: config?.initialVisibility !== false,
        type: 'radius_rings',
        geojson,
        layer: leaflet().layerGroup(ringsOf(geojson, radius)),
    }
}

/**
 * The host's data changed. The core default re-adds GeoJSON to the attachment's
 * layer, which is right for a `L.geoJson` attachment; these are derived circles
 * in a layerGroup, so they are rebuilt instead.
 */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    ringsOf(geojson, num(config?.radiusMeters, 10)).forEach((ring) =>
        attachment.layer.addLayer(ring)
    )
}

export default { make, syncData }
```

That is the whole plugin: it is added to and removed from the map with its host,
follows its opacity, is listed and toggleable under the host's Composite Layers,
and is offered on every `vector` and `query` layer (and anything extending them)
— none of which it had to implement.
