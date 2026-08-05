# Components

A component is the family for UI that isn't a tool: it isn't in the toolbar, it
isn't opened and closed, and it has no panel of its own. It is handed the
mission's settings once, at startup, and puts whatever it likes on the page —
the two core ones are a global search box and an operations clock.

- [The contract](#the-contract)
- [When it runs](#when-it-runs)
- [Where it mounts, and on top of what](#where-it-mounts-and-on-top-of-what)
- [Settings](#settings)
- [Talking to the rest of MMGIS](#talking-to-the-rest-of-mmgis)
- [You're not done until](#youre-not-done-until)

## The contract

One method:

```js
const MyComponent = {
    init(vars) {
        // `vars` is the component's `variables` from the mission config
    },
}

export default MyComponent
```

`plugin.json` names the module so it can be imported into the build:

```json
{
    "name": "MyComponent",
    "type": "component",
    "paths": { "MyComponent": "./MyComponent" }
}
```

The key in `paths` is what a mission config's `"js"` names, which is how a
mission with two copies of a component (or an overriding fork) picks one.

There is **no `destroy`**. A component is initialized once and lives for the
page; nothing tears it down, so anything it starts — an interval, a resize
listener, a WebSocket — it owns for the life of the session. (A tool, which is
opened and closed repeatedly, is the family that has `make`/`destroy`.)

## When it runs

`ComponentController_.initializeComponents()` runs at the end of
`essence.init`, **after** `UserInterface_.fina`, `Viewer_.fina`,
`TimeControl.fina` and `mmgisAPI_.fina` — so by the time your `init` is called
the toolbar, the map, the globe, the viewer and the time bar all exist, and
`L_.layers` is populated. Layers are not necessarily *made* yet; if you need
one that is, subscribe (see below) rather than reading it in `init`.

Only components with `on: true` in the mission config are initialized, in
discovery order — **which is not stable between builds**, so do not depend on
another component having initialized first. An `init` that throws is caught and
logged; the other components still initialize.

## Where it mounts, and on top of what

Core gives a component no slot: it appends to `document.body` itself (this is
what `OperationsClock` does) or into an element it knows exists. There is no
core-owned container to attach to, and none is planned — a component is
page-level by definition.

What core *does* own is the stacking, so a component that picks a z-index out of
the air lands under something. The bands actually in use:

| z-index | What |
|---|---|
| 1500 | `#bottomFloatingBar` |
| 1501 | the time bar's controls |
| 2005 | the main UI chrome (top bar) |
| 2006 | the toolbar and its panel |
| 3003 | Draw tool overlays |
| 9000+ | descriptions, modals, context menus, dropdowns, tooltips |
| 77777 | the expanded time bar |
| 999999 | login |

Page-level furniture belongs just above the bar it must clear (`OperationsClock`
sits at 1600 to clear `#bottomFloatingBar`) and below the toolbar at 2006, so a
tool's panel still covers it. Anything above 9000 is a dialog band; a component
that parks itself there covers modals.

## Settings

A component declares its Configure form the same way every other family does —
a `config.rows` metaconfig, documented in
[`plugins/README.md`](../../README.md#the-config-metaconfig). Its fields write
to `variables.*` and come back as the `vars` argument of `init`.

Defaults belong in the component's own code (`const { size = 12 } = vars || {}`)
— a row's `default` populates the form, so nothing is written until an admin
touches the field.

## Talking to the rest of MMGIS

A component is page-level, so it uses the same singletons everything else does:
`L_` (layers and their state), `Map_`, `Globe_`, `TimeControl`, and the public
`window.mmgisAPI`. The subscriptions worth knowing:

| Want | Use |
|---|---|
| A layer was toggled | `L_.subscribeOnLayerToggle(id, (layerName, isNowOn) => …)` |
| One specific layer was toggled | `L_.subscribeOnSpecificLayerToggle(id, layerName, fn)` |
| The time bar moved | `L_.subscribeTimeChange(id, fn)` |
| A feature was selected | `L_.subscribeOnLayerSelection(id, fn)` |

There is **no core channel from an interaction (or a layer attachment) to a
component** — the families are deliberately independent, and neither can call
the other. When a plugin author has needed one, the working answer has been a
`CustomEvent` on `document` under a namespaced name:

```js
// in the interaction
document.dispatchEvent(
    new CustomEvent('myplugin:selected', { detail: { id } })
)
// in the component
document.addEventListener('myplugin:selected', (e) => …)
```

That is a convention between two plugins you ship together, not a core contract:
core neither defines the name nor guarantees delivery, and a component that
listens for an event no installed plugin dispatches simply never hears anything.

## You're not done until

The component is **in the mission's config with `on: true`** (Configure → the
mission → Components). A component that is built, discovered, activated and
registered but not configured into the mission does nothing at all, with no
error — the same "green validate, nothing happens" trap every family has.

```bash
npm run plugins -- validate      # manifest + module shape
npm run plugins -- activate      # regenerates src/pre/components.js
```
