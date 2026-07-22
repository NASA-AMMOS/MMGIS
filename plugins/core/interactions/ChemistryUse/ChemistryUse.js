import TC_ from '@basics/ToolController_/ToolController_'

const ChemistryUse = {
    use(ctx) {
        TC_.getTool('ChemistryTool').use(ctx.layer)
    },
}

export default ChemistryUse
