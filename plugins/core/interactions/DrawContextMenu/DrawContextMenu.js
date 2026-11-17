import TC_ from '@basics/ToolController_/ToolController_'

const DrawContextMenu = {
    use(ctx) {
        TC_.getTool('DrawTool').showContextMenu(
            0,
            0,
            { feature: ctx.feature },
            null,
            'master',
            false,
            true,
            true,
            ctx.layerName
        )
    },
}

export default DrawContextMenu
