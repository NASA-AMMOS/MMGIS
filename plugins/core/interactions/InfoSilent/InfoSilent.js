import TC_ from '@basics/ToolController_/ToolController_'
import { gatherFeatures } from '../InfoOpen/FeatureGatherer'

const InfoSilent = {
    use(ctx) {
        const { features, featureLayers } = gatherFeatures(ctx)

        let ell = { latlng: null }
        if (ctx.event.latlng != null)
            ell.latlng = JSON.parse(JSON.stringify(ctx.event.latlng))

        TC_.getTool('InfoTool').use(
            ctx.layer,
            ctx.layerName,
            features,
            {
                useKeyAsName: ctx.layer.useKeyAsName,
            },
            null,
            false,
            ell,
            ctx.additional,
            ctx.state.lastFeatureLayers || featureLayers
        )
    },
}

export default InfoSilent
