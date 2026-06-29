import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

const WaypointModel = {
    use(ctx) {
        const modelVar = F_.getIn(
            ctx.layerVar,
            'markerAttachments.model',
            false
        )
        if (
            !modelVar ||
            (modelVar.enabled !== true && modelVar.enabled != null)
        ) {
            return
        }

        const path = F_.getIn(
            ctx.layerVar,
            'markerAttachments.model.path',
            null
        )
        let modelSettings = {
            model: F_.getIn(
                ctx.layer.feature.properties,
                F_.getIn(
                    ctx.layerVar,
                    'markerAttachments.model.pathProp',
                    path
                ),
                path
            ),
            mtlPath: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.mtlPath',
                null
            ),
            yawProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.yawProp',
                0
            ),
            yawUnit: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.yawUnit',
                'rad'
            ),
            invertYaw: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.invertYaw',
                false
            ),
            pitchProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.pitchProp',
                0
            ),
            pitchUnit: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.pitchUnit',
                'rad'
            ),
            invertPitch: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.invertPitch',
                false
            ),
            rollProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.rollProp',
                0
            ),
            rollUnit: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.rollUnit',
                'rad'
            ),
            invertRoll: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.invertRoll',
                false
            ),
            elevationProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.elevationProp',
                0
            ),
            scaleProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.scaleProp',
                1
            ),
            show: F_.getIn(
                ctx.layerVar,
                'markerAttachments.model.show',
                'click'
            ),
        }

        if (modelSettings.model && modelSettings.show === 'click') {
            if (
                !F_.isUrlAbsolute(modelSettings.image) &&
                !modelSettings.model.startsWith('public')
            )
                modelSettings.model = L_.missionPath + modelSettings.model

            const rotation = {
                y:
                    typeof modelSettings.yawProp === 'number'
                        ? modelSettings.yawProp
                        : F_.getIn(
                              ctx.layer.feature.properties,
                              modelSettings.yawProp,
                              0
                          ),
                x:
                    typeof modelSettings.pitchProp === 'number'
                        ? modelSettings.pitchProp
                        : F_.getIn(
                              ctx.layer.feature.properties,
                              modelSettings.pitchProp,
                              0
                          ),
                z:
                    typeof modelSettings.rollProp === 'number'
                        ? modelSettings.rollProp
                        : F_.getIn(
                              ctx.layer.feature.properties,
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

            L_.Globe_.litho.addLayer('model', {
                name: 'markerAttachmentTempModel',
                order: 99999,
                on: true,
                path: modelSettings.model,
                mtlPath: modelSettings.mtlPath,
                opacity: 1,
                position: {
                    longitude: ctx.layer._latlng.lng || 0,
                    latitude: ctx.layer._latlng.lat || 0,
                    elevation:
                        typeof modelSettings.elevationProp === 'number'
                            ? modelSettings.elevationProp
                            : F_.getIn(
                                  ctx.layer.feature.properties,
                                  modelSettings.elevationProp,
                                  0
                              ),
                },
                scale:
                    typeof modelSettings.scaleProp === 'number'
                        ? modelSettings.scaleProp
                        : F_.getIn(
                              ctx.layer.feature.properties,
                              modelSettings.scaleProp,
                              1
                          ),
                rotation: rotation,
            })
        }
    },
}

export default WaypointModel
