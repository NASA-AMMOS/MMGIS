import L_ from '@basics/Layers_/Layers_'

const CleanupTemp = {
    use(ctx) {
        ctx.Map_.rmNotNull(ctx.Map_.tempOverlayImage)
        L_.Globe_.litho.removeLayer('markerAttachmentTempModel')
    },
}

export default CleanupTemp
