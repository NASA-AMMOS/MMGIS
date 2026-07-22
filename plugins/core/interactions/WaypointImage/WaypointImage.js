import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'

const WaypointImage = {
    use(ctx) {
        const imageVar = F_.getIn(
            ctx.layerVar,
            'markerAttachments.image',
            false
        )
        if (
            !imageVar ||
            (imageVar.enabled !== true && imageVar.enabled != null)
        ) {
            return
        }

        const path = F_.getIn(
            ctx.layerVar,
            'markerAttachments.image.path',
            'public/images/rovers/PerseveranceTopDown.png'
        )
        let roverSettings = {
            image: F_.getIn(
                ctx.layer.feature.properties,
                F_.getIn(
                    ctx.layerVar,
                    'markerAttachments.image.pathProp',
                    path
                ),
                path
            ),
            widthMeters: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.widthMeters',
                2.6924
            ),
            widthPixels: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.widthPixels',
                420
            ),
            heightPixels: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.heightPixels',
                600
            ),
            angleProp: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.angleProp',
                'yaw_rad'
            ),
            angleUnit: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.angleUnit',
                'rad'
            ),
            show: F_.getIn(
                ctx.layerVar,
                'markerAttachments.image.show',
                'click'
            ),
        }

        if (
            !F_.isUrlAbsolute(roverSettings.image) &&
            !roverSettings.image.startsWith('public')
        )
            roverSettings.image = L_.missionPath + roverSettings.image

        if (roverSettings.image && roverSettings.show === 'click') {
            let wm = parseFloat(roverSettings.widthMeters)
            let w = parseFloat(roverSettings.widthPixels)
            let h = parseFloat(roverSettings.heightPixels)
            let lngM = F_.metersToDegrees(wm) / 2
            let latM = lngM * (h / w)
            let center = [ctx.layer._latlng.lng, ctx.layer._latlng.lat]
            let angle = -F_.getIn(
                ctx.layer.feature.properties,
                roverSettings.angleProp,
                0
            )
            if (roverSettings.angleUnit === 'deg')
                angle = angle * (Math.PI / 180)

            var topLeft = F_.rotatePoint(
                {
                    y: ctx.layer._latlng.lat + latM,
                    x: ctx.layer._latlng.lng - lngM,
                },
                center,
                angle
            )
            var topRight = F_.rotatePoint(
                {
                    y: ctx.layer._latlng.lat + latM,
                    x: ctx.layer._latlng.lng + lngM,
                },
                center,
                angle
            )
            var bottomRight = F_.rotatePoint(
                {
                    y: ctx.layer._latlng.lat - latM,
                    x: ctx.layer._latlng.lng + lngM,
                },
                center,
                angle
            )
            var bottomLeft = F_.rotatePoint(
                {
                    y: ctx.layer._latlng.lat - latM,
                    x: ctx.layer._latlng.lng - lngM,
                },
                center,
                angle
            )

            var anchors = [
                [topLeft.y, topLeft.x],
                [topRight.y, topRight.x],
                [bottomRight.y, bottomRight.x],
                [bottomLeft.y, bottomLeft.x],
            ]

            try {
                ctx.Map_.tempOverlayImage = L.imageTransform(
                    roverSettings.image,
                    anchors,
                    { opacity: 1, clip: anchors }
                )
                ctx.Map_.tempOverlayImage.addTo(ctx.Map_.map).bringToBack()
            } catch (err) {
                // Image transform can fail for edge-case geometries
            }
        }
    },
}

export default WaypointImage
