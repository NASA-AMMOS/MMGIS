import L_ from '@basics/Layers_/Layers_'

const ViewerOpenPanel = {
    use(ctx) {
        var pp = L_.UserInterface_.getPanelPercents()
        if (pp.viewer == 0 && L_.hasViewer) {
            L_.UserInterface_.openViewerPanel()
        }

        const geoJSONFeatures = [
            'multipolygon',
            'polygon',
            'multilinestring',
            'linestring',
            'multipoint',
        ]

        let bounds = null
        let zoom = null
        if (ctx.feature.geometry.type.toLowerCase() === 'point') {
            bounds = [
                ctx.feature.geometry.coordinates[1],
                ctx.feature.geometry.coordinates[0],
            ]
            zoom =
                L_.configData.msv.mapscale || L_.Map_.map.getZoom()
        } else if (
            geoJSONFeatures.includes(
                ctx.feature.geometry.type.toLowerCase()
            )
        ) {
            if ('getBounds' in ctx.layer) {
                bounds = ctx.layer._pxBounds

                let center = L.bounds(
                    [bounds.min.x, bounds.min.y],
                    [bounds.max.x, bounds.max.y]
                ).getCenter()
                let min = ctx.Map_.map.layerPointToLatLng([
                    bounds.min.x,
                    bounds.min.y,
                ])
                let max = ctx.Map_.map.layerPointToLatLng([
                    bounds.max.x,
                    bounds.max.y,
                ])
                bounds = [
                    [min.lat, min.lng],
                    [max.lat, max.lng],
                ]

                const padding = [100, 100]
                zoom = ctx.Map_.map.getBoundsZoom(bounds, false, padding)
                bounds = ctx.Map_.map.layerPointToLatLng([
                    center.x,
                    center.y,
                ])
            } else {
                console.warn('Feature is missing getBounds', ctx.feature)
                return
            }
        } else {
            console.warn('Feature has an unknown type', ctx.feature)
            return
        }

        ctx.Map_.map.setView(bounds, zoom)
    },
}

export default ViewerOpenPanel
