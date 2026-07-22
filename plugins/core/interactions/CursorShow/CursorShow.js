import L_ from '@basics/Layers_/Layers_'
import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'

const CursorShow = {
    use(ctx) {
        const pv = L_.getLayersChosenNamePropVal(ctx.feature, ctx.layer)
        CursorInfo.update(pv, null, false)
    },
}

export default CursorShow
