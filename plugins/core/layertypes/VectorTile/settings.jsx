import VectorSettings from '../Vector/settings'

const vectorTileSettings = {
    sections: (layer, ctx) => VectorSettings.sections(layer, ctx),
    actions: (layer, ctx) => VectorSettings.actions(layer, ctx),
    status: (layer, ctx) => VectorSettings.status(layer, ctx),
}

export default vectorTileSettings
