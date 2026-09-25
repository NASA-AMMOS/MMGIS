/**
 * Image layer type — legend.
 *
 * A single-band image transformed client-side is colored by a colormap over a rescale range, so its legend is that scale.
 */
import ToolController_ from '@basics/ToolController_/ToolController_'

// Build the layer's legend from its live render parameters. The scale itself is
// drawn by the LayersTool, which owns the colormap/rescale UI it comes from.
function derive(layerObj) {
    // A custom GDAL color table (cogColormapJson) colors raw pixel values
    // without the COG transform, so it yields a legend on its own.
    if (layerObj.cogTransform !== true && layerObj.cogColormapJson == null)
        return false

    ToolController_.getTool('LayersTool')?.populateCogScale(layerObj.name)
    return true
}

export default { derive }
