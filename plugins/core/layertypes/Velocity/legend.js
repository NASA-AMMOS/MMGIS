/**
 * Velocity layer type — legend.
 *
 * A velocity field is always drawn against a magnitude scale, so its legend comes from the render rather than from configuration.
 */
import ToolController_ from '@basics/ToolController_/ToolController_'

// Build the layer's legend from its live render parameters. The scale itself is
// drawn by the LayersTool, which owns the colormap/rescale UI it comes from.
function derive(layerObj) {

    ToolController_.getTool('LayersTool')?.populateCogScale(layerObj.name)
    return true
}

export default { derive }
