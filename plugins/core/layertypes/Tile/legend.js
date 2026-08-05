/**
 * Tile layer type — legend.
 *
 * A single-band COG rendered through TiTiler is colored by a colormap over a rescale range, so its legend is that scale rather than anything configured.
 */
import ToolController_ from '@basics/ToolController_/ToolController_'

// Build the layer's legend from its live render parameters. The scale itself is
// drawn by the LayersTool, which owns the colormap/rescale UI it comes from.
function derive(layerObj) {
    if (layerObj.cogTransform !== true) return false

    ToolController_.getTool('LayersTool')?.populateCogScale(layerObj.name)
    return true
}

export default { derive }
