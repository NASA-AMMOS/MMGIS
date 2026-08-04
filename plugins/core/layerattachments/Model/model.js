/**
 * Model attachment — a 3D model placed at each of the host layer's point
 * features, oriented by yaw/pitch/roll properties.
 *
 * It has nothing on the 2D map, so its whole visibility story is the globe
 * layer it adds and removes, and it is never restyled with its host.
 */

import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

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
                  title: 'Associated 3D models for the Globe View.',
              }
            : false
    } else return false
}

function setVisibility(attachment, ctx = {}) {
    if (ctx.visible) L_.Globe_.litho.addLayer('model', attachment.modelOptions)
    else L_.Globe_.litho.removeLayer(attachment.layerId)
}

export default {
    make: (ctx) =>
        models(ctx.geojson, ctx.layerObj, ctx.leafletLayerObject, ctx.config),
    setVisibility,
}
