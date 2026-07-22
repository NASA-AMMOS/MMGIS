import Viewer_ from '@basics/Viewer_/Viewer_'

const ViewerUpdate = {
    use(ctx) {
        Viewer_.changeImages(ctx.feature, ctx.layer)
    },
}

export default ViewerUpdate
