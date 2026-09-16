/**
 * Model attachment — a 3D model placed at each of the host layer's point
 * features, oriented by yaw/pitch/roll properties.
 *
 * It has nothing on the 2D map, so its whole visibility story is the globe
 * layer it adds and removes, and it is never restyled with its host.
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

// The globe layer holding the clicked feature's model, of which there is only
// ever one.
const TEMP_MODEL_NAME = 'markerAttachmentTempModel'

const models = (geojson, layerObj, leafletLayerObject, config) => {
    // MODEL
    const modelVar = config

    if (modelVar && (modelVar.enabled === true || modelVar.enabled == null)) {
        const modelShow = F_.getIn(modelVar, 'show', 'click')
        const modelPaths = []
        const modelMtlPaths = []
        const modelPositions = []
        const modelRotations = []
        const modelScales = []

        const modelSettings = {
            model: F_.getIn(modelVar, 'path', null),
            pathProp: F_.getIn(modelVar, 'pathProp', null),
            mtlPath: F_.getIn(modelVar, 'mtlPath', null),
            mtlProp: F_.getIn(modelVar, 'mtlProp', null),
            yawProp: F_.getIn(modelVar, 'yawProp', null),
            yawUnit: F_.getIn(modelVar, 'yawUnit', 'rad'),
            invertYaw: F_.getIn(modelVar, 'invertYaw', false),
            pitchProp: F_.getIn(modelVar, 'pitchProp', null),
            pitchUnit: F_.getIn(modelVar, 'pitchUnit', 'rad'),
            invertPitch: F_.getIn(modelVar, 'invertPitch', false),
            rollProp: F_.getIn(modelVar, 'rollProp', null),
            rollUnit: F_.getIn(modelVar, 'rollUnit', 'rad'),
            invertRoll: F_.getIn(modelVar, 'invertRoll', false),
            elevationProp: F_.getIn(modelVar, 'elevationProp', null),
            scaleProp: F_.getIn(modelVar, 'scaleProp', 1),
            show: F_.getIn(modelVar, 'show', 'click'),
            onlyLastN: F_.getIn(modelVar, 'onlyLastN', false),
        }

        let modelOptions
        if (
            (modelSettings.model || modelSettings.pathProp) &&
            modelSettings.show === 'always'
        ) {
            geojson.features.forEach((f, idx) => {
                if (typeof modelSettings.onlyLastN === 'number') {
                    if (idx < geojson.features.length - modelSettings.onlyLastN)
                        return
                }

                // Figure out model path
                let modelPath = null
                if (!modelSettings.model && modelSettings.pathProp) {
                    modelPath = F_.getIn(
                        f.properties,
                        modelSettings.pathProp,
                        null
                    )
                } else {
                    modelPath = modelSettings.model
                }
                if (
                    modelPath &&
                    !F_.isUrlAbsolute(modelPath) &&
                    !modelPath.startsWith('public')
                )
                    modelPath = L_.missionPath + modelPath
                modelPaths.push(modelPath)

                // Figure out mtl path if any
                let mtlPath = null
                if (!modelSettings.mtlPath && modelSettings.mtlProp) {
                    mtlPath = F_.getIn(
                        f.properties,
                        modelSettings.mtlProp,
                        null
                    )
                } else {
                    mtlPath = modelSettings.mtlPath
                }
                if (
                    mtlPath &&
                    !F_.isUrlAbsolute(mtlPath) &&
                    !mtlPath.startsWith('public')
                )
                    mtlPath = L_.missionPath + mtlPath
                modelMtlPaths.push(mtlPath)

                if (f.geometry.type.toLowerCase() === 'point') {
                    const coords = f.geometry.coordinates
                    const position = {
                        latitude: coords[1],
                        longitude: coords[0],
                        elevation:
                            typeof modelSettings.elevationProp === 'number'
                                ? modelSettings.elevationProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.elevationProp,
                                      coords[2]
                                  ),
                    }

                    const rotation = {
                        y:
                            typeof modelSettings.yawProp === 'number'
                                ? modelSettings.yawProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.yawProp,
                                      0
                                  ),
                        x:
                            typeof modelSettings.pitchProp === 'number'
                                ? modelSettings.pitchProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.pitchProp,
                                      0
                                  ),
                        z:
                            typeof modelSettings.rollProp === 'number'
                                ? modelSettings.rollProp
                                : F_.getIn(
                                      f.properties,
                                      modelSettings.rollProp,
                                      0
                                  ),
                    }
                    if (modelSettings.yawUnit === 'deg')
                        rotation.y *= Math.PI / 180
                    if (modelSettings.invertYaw) rotation.y *= -1
                    if (modelSettings.pitchUnit === 'deg')
                        rotation.x *= Math.PI / 180
                    if (modelSettings.invertPitch) rotation.x *= -1
                    if (modelSettings.rollUnit === 'deg')
                        rotation.z *= Math.PI / 180
                    if (modelSettings.invertRoll) rotation.z *= -1

                    const scale =
                        typeof modelSettings.scaleProp === 'number'
                            ? modelSettings.scaleProp
                            : F_.getIn(f.properties, modelSettings.scaleProp, 1)
                    modelPositions.push(position)
                    modelRotations.push(rotation)
                    modelScales.push(scale)
                }
            })

            modelOptions = {
                name: `markerAttachmentModel_${layerObj.name}`,
                order: 99999,
                on: true,
                path: modelPaths,
                mtlPath: modelMtlPaths,
                opacity: 1,
                isArrayed: true,
                position: modelPositions,
                rotation: modelRotations,
                scale: modelScales,
            }
        }

        return modelShow === 'always' && modelOptions
            ? {
                  on:
                      modelVar.initialVisibility != null
                          ? modelVar.initialVisibility
                          : true,
                  type: 'model',
                  layerId: modelOptions.name,
                  modelOptions: modelOptions,
              }
            : false
    } else return false
}

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) L_.Globe_.litho.addLayer('model', attachment.modelOptions)
    else L_.Globe_.litho.removeLayer(attachment.layerId)
}

/**
 * The `show: 'click'` half of the same attachment: the clicked feature's model
 * alone, for as long as it stays selected. Same settings, same model, so it
 * belongs here rather than in whatever interaction happens to ask for it.
 */
function makeForFeature(ctx = {}) {
    const modelVar = ctx.config
    if (!modelVar) return
    if (F_.getIn(modelVar, 'show', 'click') !== 'click') return

    const properties = ctx.feature?.properties
    const path = F_.getIn(modelVar, 'path', null)
    let model = F_.getIn(properties, F_.getIn(modelVar, 'pathProp', path), path)
    if (!model) return
    if (!F_.isUrlAbsolute(model) && !model.startsWith('public'))
        model = L_.missionPath + model

    // A property name to read off the feature, or the value itself.
    const valueOf = (prop, fallback) =>
        typeof prop === 'number' ? prop : F_.getIn(properties, prop, fallback)

    const angle = (prop, unit, invert, fallback) => {
        let a = valueOf(prop, fallback)
        if (unit === 'deg') a *= Math.PI / 180
        if (invert) a *= -1
        return a
    }

    L_.Globe_.litho.addLayer('model', {
        name: TEMP_MODEL_NAME,
        order: 99999,
        on: true,
        path: model,
        mtlPath: F_.getIn(modelVar, 'mtlPath', null),
        opacity: 1,
        position: {
            longitude: ctx.latlng?.lng || 0,
            latitude: ctx.latlng?.lat || 0,
            elevation: valueOf(F_.getIn(modelVar, 'elevationProp', 0), 0),
        },
        scale: valueOf(F_.getIn(modelVar, 'scaleProp', 1), 1),
        rotation: {
            y: angle(
                F_.getIn(modelVar, 'yawProp', 0),
                F_.getIn(modelVar, 'yawUnit', 'rad'),
                F_.getIn(modelVar, 'invertYaw', false),
                0
            ),
            x: angle(
                F_.getIn(modelVar, 'pitchProp', 0),
                F_.getIn(modelVar, 'pitchUnit', 'rad'),
                F_.getIn(modelVar, 'invertPitch', false),
                0
            ),
            z: angle(
                F_.getIn(modelVar, 'rollProp', 0),
                F_.getIn(modelVar, 'rollUnit', 'rad'),
                F_.getIn(modelVar, 'invertRoll', false),
                0
            ),
        },
    })
}

/** Deselecting takes the clicked feature's model with it. */
function clearForFeature() {
    L_.Globe_.litho.removeLayer(TEMP_MODEL_NAME)
}

export default {
    make: (ctx) =>
        models(ctx.geojson, ctx.layerObj, ctx.leafletLayerObject, ctx.config),
    makeForFeature,
    clearForFeature,
    setVisibility,
}
