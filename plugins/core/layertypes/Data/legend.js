/**
 * Data layer type — legend.
 *
 * A data layer shaded by 'colorize' is drawn against the shader's ramp, so its legend is that ramp.
 */
import F_ from '@basics/Formulae_/Formulae_'
import { populateCogScale } from '../Tile/cogLegend'

// Build the layer's legend from its live render parameters. The scale itself is
// drawn by the LayersTool, which owns the colormap/rescale UI it comes from.
function derive(layerObj) {
    if (F_.getIn(layerObj, 'variables.shader.type') !== 'colorize') return false

    populateCogScale(layerObj.name)
    return true
}

export default { derive }
