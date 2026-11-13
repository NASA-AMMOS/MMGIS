# LayersTool2 layer settings

Layer-type plugins may export an optional `settings.jsx` module. LayersTool2
reads its `sections(layer, ctx)` and `actions(layer, ctx)` descriptors and calls
`status(layer, ctx)` both in the layer list and in settings. `ctx` is the same
layer-scoped object at both call sites:

```js
{
  layerName,
  layerType,
  api: {
    setOpacity(value),
    setTileFilter(property, value),
    setBlend(value),
    reload(),
    zoomTo(),
    download(),
    refresh(),
    reset(sectionId),
    resetAll(),
    toggle(target, on),
    setGlobalTimeToExtent()
  }
}
```

The API methods are bound to the current layer. Keep external work in a section
component or action; `status` should return `null` or `{ kind, message }`.

Each section descriptor has an `id`, `label`, optional `order`,
`Component`, `resettable`, and `reset(ctx, layer)`. The component receives
`{ layer, api, state, setState, resetToken }`; state is scoped to the layer and
section. `api` exposes the methods in `ctx.api`. A reset callback should restore
the layer's defaults; Reset all calls every section reset, including sections
that are not currently mounted. Actions have an `id`, `label`, optional `icon`,
and `onClick(ctx)`.

A section with `id: 'display'` extends the core Display section alongside
Opacity; it does not add a second Display section.

When overriding a parent's settings operation through `extends`, use
`(layer, ctx, inherited)` and call `inherited()` to retain the parent's result:

```jsx
import React from 'react'

function ExtraSettings({ layer }) {
    return <div>{layer.display_name || layer.name}</div>
}

export default {
    sections(layer, ctx, inherited) {
        return [
            ...(inherited?.() || []),
            {
                id: 'extra',
                label: 'Extra',
                order: 90,
                Component: ExtraSettings,
                resettable: true,
            },
        ]
    },
}
```

Each section renders inside its own error boundary. A thrown render error is
shown in that section; rejected or throwing action handlers produce an error
toast. Keep failures local to the section or action rather than allowing them
to take down the layer tree.
