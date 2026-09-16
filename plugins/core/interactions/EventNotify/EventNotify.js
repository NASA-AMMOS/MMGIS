import L_ from '@basics/Layers_/Layers_'

const EventNotify = {
    use(ctx) {
        let _event = new CustomEvent('newActiveFeature', {
            detail: {
                activeFeature: L_.activeFeature,
            },
        })
        document.dispatchEvent(_event)
    },
}

export default EventNotify
