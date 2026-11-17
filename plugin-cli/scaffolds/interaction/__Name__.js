import { decide } from './logic'

const __Name__ = {
    use(ctx) {
        // ctx.feature  — the clicked GeoJSON feature. May be absent — guard it.
        // ctx.layer    — the Leaflet layer
        // ctx.layerName — name of the layer
        // ctx.state    — shared state between interactions
        // ctx.config   — this interaction's own settings on the layer, if the
        //                manifest declares a `configPath`. Null until an admin
        //                configures the layer, so default in `logic.js`.
        //                Adding `config.rows` beside `configPath` in the
        //                manifest gets those settings a form on the
        //                interaction's card in the layer's Interactions tab.
        // ctx.stop     — set to true to halt the pipeline
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        // Do the thing. Singletons come in by alias —
        // `import L_ from '@basics/Layers_/Layers_'` — and importing one is what
        // makes this file un-importable in a Node test, hence `logic.js`.
        ctx.state.__name__ = result
    },
}

export default __Name__
