/**
 * Tile layer type — legend.
 *
 * A single-band COG rendered through TiTiler is colored by a colormap over a rescale range, so its legend is that scale rather than anything configured.
 * A classified raster in a STAC collection has its classes listed by the collection, so its legend is read from there.
 */
import ToolController_ from '@basics/ToolController_/ToolController_'
import {
    hasConfiguredLegend,
    wantsStacClassLegend,
    loadStacClasses,
    classesToLegend,
} from '@basics/Layers_/legend/stacClassLegend'

// Build the layer's legend from its live render parameters. The scale itself is
// drawn by the LayersTool, which owns the colormap/rescale UI it comes from.
function derive(layerObj) {
    // A configured legend that hasn't loaded yet is still the layer's legend;
    // a color table's own would otherwise be drawn in its place.
    if (hasConfiguredLegend(layerObj) && layerObj.cogTransform !== true)
        return false

    const hasClasses = deriveStacClasses(layerObj)

    // A custom GDAL color table (cogColormapJson) colors raw pixel values
    // without the COG transform, so it yields a legend on its own.
    if (layerObj.cogTransform !== true && layerObj.cogColormapJson == null)
        return hasClasses

    ToolController_.getTool('LayersTool')?.populateCogScale(layerObj.name)
    return true
}

// The collection is asked once per layer, the first time its legend is wanted.
// `_stacClasses` is undefined before that, null while waiting or when the
// collection lists none, and the classes once they are known.
function deriveStacClasses(layerObj) {
    if (!wantsStacClassLegend(layerObj)) return false
    if (layerObj._stacClasses !== undefined)
        return applyStacClasses(layerObj)

    layerObj._stacClasses = null
    loadStacClasses(layerObj).then((classes) => {
        if (classes == null) return
        layerObj._stacClasses = classes
        if (!applyStacClasses(layerObj)) return
        // The legend was drawn without these; draw it again with them.
        const legendTool = ToolController_.getTool('LegendTool')
        if (legendTool?.made === true) legendTool.refreshLegends()
    })
    return false
}

// With a color table the LayersTool builds the legend, and names its entries
// from `_stacClasses`. Without one the classes are the whole legend.
function applyStacClasses(layerObj) {
    if (layerObj._stacClasses == null) return false
    if (layerObj.cogColormapJson != null) return true
    if (layerObj._legend !== undefined) return true
    const legend = classesToLegend(layerObj._stacClasses)
    if (legend == null) return false
    layerObj._legend = legend
    return true
}

export default { derive }
