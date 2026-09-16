import L_ from '@basics/Layers_/Layers_'

const Select = {
    use(ctx) {
        L_.setActiveFeature(ctx.layer)
    },
}

export default Select
