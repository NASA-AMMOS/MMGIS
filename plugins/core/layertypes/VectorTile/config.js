/**
 * `config.normalize` — the type's own config defaults, applied during mission
 * config parsing before core reads the layer object.
 */
function normalize(layerObj) {
    layerObj.kind = layerObj.kind || 'none'
    return layerObj
}

export default {
    normalize,
}
