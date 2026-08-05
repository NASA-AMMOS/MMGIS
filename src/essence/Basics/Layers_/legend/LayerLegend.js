/**
 * LayerLegend — a layer's legend, asked of its type rather than switched on it.
 *
 * Most layers' legends are configured (`legend` url or `variables.legend`) and
 * core just reads them. Some derive theirs from how the layer is being rendered:
 * a single-band COG's rescale range and colormap, a data shader's ramp, a
 * velocity field's scale. That is the type's knowledge, so it is a `legend`
 * surface (`derive`) instead of the list of type names core used to carry.
 *
 * @module LayerLegend
 */

import LayerTypeRegistry from '../registry/LayerTypeRegistry'
import LayerInterface from '../interface/LayerInterface'

/**
 * Ask a layer's type to build `_legend` from its current render parameters.
 * A type with nothing to derive (its legend is configured or it has no scale)
 * declares no `legend` surface, and core does nothing.
 *
 * @param {object} layerObj  The layer's config object.
 * @returns {boolean} whether a type took responsibility for the legend.
 */
export function deriveLegend(layerObj) {
    if (layerObj == null) return false
    const legendModule = LayerTypeRegistry.get(layerObj.type)?.legend
    if (!LayerInterface.hasOp(legendModule, 'derive')) return false
    return LayerInterface.runSync(legendModule, 'derive', [layerObj]) !== false
}

/** True if this layer's type derives its own legend. */
export function derivesLegend(layerObj) {
    return LayerInterface.hasOp(
        LayerTypeRegistry.get(layerObj?.type)?.legend,
        'derive'
    )
}

const LayerLegend = { deriveLegend, derivesLegend }
export default LayerLegend
