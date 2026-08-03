/**
 * `config.normalize` — the type's own config defaults, applied during mission
 * config parsing before core reads the layer object. Tiles served through
 * MMGIS' own tile server are always WMTS regardless of what the config said.
 */
function normalize(layerObj) {
    if (layerObj.throughTileServer === true) layerObj.tileformat = 'wmts'
    return layerObj
}

export default {
    normalize,
}
