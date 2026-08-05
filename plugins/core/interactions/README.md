# Interaction plugins

An interaction is what happens when a user touches a feature: click, hover,
mouseout. A layer's behavior is a **pipeline** of them rather than one hardcoded
"kind", so a plugin adds one small thing — highlight it, sonify it, copy it, open
something — instead of replacing a whole behavior.

This is the authoring reference. For where a plugin lives, the CLI, and the
`plugin.json` fields every family shares, see [`../../README.md`](../../README.md).

```
plugins/<container>/interactions/FeatureGlow/
  plugin.json          # manifest: interactionId, phase, order, config
  featureGlow.js       # export default { use(ctx) }
```

```bash
npm run plugins -- create interaction FeatureGlow --container mine
npm run plugins -- validate
```

---

## `use(ctx)`

One method. It may be `async` and the runner awaits it, so an interaction that
fetches something delays the rest of the pipeline rather than racing it.

```js
const FeatureGlow = {
    async use(ctx) {
        if (!ctx.feature) return
        const { color = '#ff0' } = ctx.config || {}
        ctx.layer.setStyle?.({ color })
        // Anything a later interaction should know goes on ctx.state.
        ctx.state.glowed = ctx.feature.properties?.name
    },
}

export default FeatureGlow
```

### `ctx`

| field | what it is |
|---|---|
| `feature` | the GeoJSON feature. **May be absent** — guard it; the pipeline also runs for events that have no feature |
| `layer` | the Leaflet layer the feature is drawn as (`setStyle`, `getLatLng`, `getBounds`, …) |
| `layerName` | the layer's name, the key into `L_.layers.*` |
| `layerData` | the layer's config object — `L_.layers.data[layerName]` |
| `layerVar` | `layerData.variables`, or `{}` |
| `layerTypeChain` | `[type]`, or `[type, parentType]` for a type that `extends` — how the runner enforces `applicableLayerTypes` |
| `event` | the originating Leaflet event (`event.latlng`, `event.originalEvent`) |
| `eventType` | `'click'`, `'hover'` or `'mouseout'` |
| `additional` | event-specific extra data, or `null` |
| `config` | **this** interaction's settings — see below. `null` when it declares no `configPath`, or when the layer has none |
| `state` | a plain object shared by the whole pipeline: read what ran before you, leave what runs after you |
| `stop` | set `true` to halt the rest of the pipeline |
| `refreshLayer()` | re-acquire the layer's data — see below |
| `acquire(layerName)` | another configured layer's data as GeoJSON, acquired headlessly — see below |
| `Map_` | the `Map_` singleton |

`await ctx.refreshLayer()` when you have changed what the layer's data *would*
be — written a feature to your own backend, say — and want that on the map. It
is the supported way to ask: the layer goes through the same acquisition every
other trigger does (a `source`-backed type sees `ctx.trigger === 'refresh'`), so
you needn't know `Map_.refreshLayer`'s internal parameters, and it works the
same whether the layer's data comes from a url, a geodataset or a plugin.

`await ctx.acquire('Wind Stations')` when what you do needs a *second* layer of the mission — stations to snap to, a network to look up against. It resolves with that layer's GeoJSON, acquired through its own layer type (`null` if it can't be: no such layer, or a type with no features to give). It is acquisition only, deliberately: the layer is not turned on, nothing of it is drawn, and you get a snapshot rather than a handle on another plugin's render — which is the part that would not have held. It is a fetch, so hold the result rather than calling it per feature.

`ctx` is one object reused down the pipeline, so `state` is deliberate sharing —
but `config` is reassigned for every interaction, and is `null` for one with no
settings of its own. Never read another interaction's settings out of `ctx`.

Everything else comes from the singletons, imported by alias rather than read off
`window`: `import L_ from '@basics/Layers_/Layers_'`,
`import F_ from '@basics/Formulae_/Formulae_'`. That import is also what makes the
module un-importable in a Node test (see [Testing](#testing)), so keep logic worth
testing in a plain module your handler calls.

## Phase and order

| `phase` | when | who |
|---|---|---|
| `preamble` | always, before the layer's behavior | `select` (order 0) |
| `main` | the layer's configured behavior | `info:open`, `waypoint:image`, `viewer:open_panel` |
| `postamble` | always, after it | `info:silent`, `viewer:update`, `search:url`, `event:notify` |

`main` is what an admin chooses per layer; `preamble`/`postamble` are always
applied, so put infrastructure there and behavior in `main`. Within a phase,
`order` sorts (lower first) — leave gaps (100, 200) so something can land
between later. `suppresses` names interactions yours replaces when both are in a
pipeline (`info:open` suppresses `info:silent`).

`applicableLayerTypes` is **enforced**, not advisory: the runner drops your
interaction for a layer whose type (or the type it extends) isn't listed, from
the preamble and postamble too. Declaring it is how you avoid being handed a tile
layer when you expect features. `validate` warns when it names a `typeId` no
enabled plugin provides.

`kindAlias` is an **array** of legacy `kind` strings — `["waypoint"]`, not
`"waypoint"` — and it is how a layer whose config predates explicit pipelines
selects you: every interaction aliasing that kind runs, in `order`. A layer type
can put you in a layer's pipeline instead, without the layer naming you, with
`capabilities.defaultInteractions.<event>: ["<interactionId>"]`.

## Settings an admin can edit

Declare `configPath` and `config.rows`, and Configure renders the form on your
interaction's own card in the layer's Interactions tab — no Configure code:

```json
{
    "interactionId": "feature:glow",
    "configPath": "variables.interactions.featureGlow",
    "config": {
        "rows": [
            { "components": [
                { "type": "colorpicker", "name": "Glow colour", "width": 4,
                  "field": "variables.interactions.featureGlow.color" }
            ] }
        ]
    }
}
```

The runner then hands you the subtree at `configPath` as `ctx.config`. Three
things to know:

- rows without a `configPath` are an error — there would be nowhere to read them
  back from;
- every `field` must sit **inside** `configPath`, or the setting is written where
  the runner never looks;
- a row's `default` is a *form* default. Nothing is written until an admin
  touches the field, so `ctx.config` is null or partial and **your code applies
  the runtime defaults**: `const { color = '#ff0' } = ctx.config || {}`.

There is no `enabled` field to add: an interaction is enabled by being in the
layer's pipeline.

A layer type that ships you can also *configure* you: an event in its
`capabilities.defaultInteractions` may be an object rather than a list of ids,

```json
"defaultInteractions": { "click": { "wind:report": { "speedProp": "windSpeed" } } }
```

and core resolves those settings into your `configPath` before handing you
`ctx.config`, with the layer's own settings on top field by field. Nothing about
your plugin changes: you read `ctx.config` and apply your own defaults, and it
works the same whether a type configured you or an admin did.

## Reaching a tool

`ToolController_` is the seam, and the two calls worth knowing are
`openTool(name)` / `closeTool(name)`, keyed by the tool's **name** as the
mission's toolbar lists it (`'Identifier'`), and `getTool(moduleName)`, keyed by
the tool's **module** (`'IdentifierTool'` — the key in its manifest's `paths`),
which returns the module so you can call whatever it exports:

```js
import TC_ from '@basics/ToolController_/ToolController_'

const MyUse = {
    use(ctx) {
        TC_.getTool('ChemistryTool').use(ctx.layer)
    },
}
```

`getTool` returns a `{ use() {} }` stub rather than throwing when the tool isn't
loaded — a mission whose toolbar omits it, or a plugin that is disabled — so it
also logs a warning: the call is a no-op, not an error. Declare the tool in your
`pluginDependencies` (`"<container>/tools/<Name>"`) so `validate` and `disable`
know about the link; an id that resolves to nothing keeps *your* plugin out of
the registry entirely.

## Testing

The pipeline itself is testable in Node — `runInteractions(ids, ctx, { handlers,
config })` takes explicit handlers, so a unit test can assert order,
suppression, `stop` and what your `use` did to a fake `ctx`
(`tests/unit/interactionRunner.spec.js` is the pattern).

Your *module*, though, usually is not: an interaction that touches `L_`, `$` or
Leaflet needs the app's globals, and importing it in a Node test fails on the
first alias. Either keep the logic your test needs in a pure function the handler
calls, or drive it in a browser test (`tests/e2e/`) where the app is loaded. A
green manifest and a green runner test do not mean the interaction works —
click a feature.
