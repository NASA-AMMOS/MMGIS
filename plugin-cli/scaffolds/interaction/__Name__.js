const __Name__ = {
    use(ctx) {
        // ctx.feature  — the clicked GeoJSON feature
        // ctx.layer    — the Leaflet layer
        // ctx.layerName — name of the layer
        // ctx.state    — shared state between interactions
        // ctx.config   — this interaction's own settings on the layer, if the
        //                manifest declares a `configPath`. Null until an admin
        //                configures the layer, so default here:
        //                  const { hz = 440 } = ctx.config || {}
        //                Adding `config.rows` beside `configPath` in the
        //                manifest gets those settings a form on the
        //                interaction's card in the layer's Interactions tab.
        // ctx.stop     — set to true to halt the pipeline
    },
}

export default __Name__
