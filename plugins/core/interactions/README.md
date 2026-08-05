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
| `Map_` | the `Map_` singleton |

`ctx` is one object reused down the pipeline, so `state` is deliberate sharing —
but `config` is reassigned for every interaction, and is `null` for one with no
settings of its own. Never read another interaction's settings out of `ctx`.

Everything else comes from the singletons, imported by alias so the module still
loads in a unit test: `import L_ from '@basics/Layers_/Layers_'`,
`import F_ from '@basics/Formulae_/Formulae_'`.

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
layer when you expect features.

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
