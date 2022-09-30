import $ from 'jquery'
import L_ from '../../../Basics/Layers_/Layers_'
import Modal from '../../../Ancillary/Modal'
import showdown from 'showdown'

import './LayerInfoModal.css'

showdown.setFlavor('github')

const LayerInfo = {
    converter: new showdown.Converter(),
    open: function (layerName) {
        const layer = L_.layersNamed[layerName]
        console.log(layer)
        if (layer == null) return

        // prettier-ignore
        Modal.set(
            [
                `<div id='LayerInfoModal'>`,
                    `<div id='LayerInfoModalTitle'>`,
                        `<div><i class='mdi mdi-information-outline mdi-18px'></i><div>Information</div></div>`,
                        `<div id='LayerInfoModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='LayerInfoModalContent'>`,
                        `<div id='LayerInfoModalDescription'>`,
                            LayerInfo.converter.makeHtml(`## Layer: ${layer.name}\n${layer.description || 'No Description'}`),
                        `</div>`,
                        `<div id='LayerInfoModalTags'>`,
                            `<div id='LayerInfoModalTagsTitle'>Tags</div>`,
                            `<div id='LayerInfoModalTagsContent'>`,
                                layer.tags ? layer.tags.map((tag) => [
                                    `<div>`,
                                        tag,
                                    `</div>`
                                ].join('\n')).join('\n') : '',
                            `</div>`,
                        `</div>`,
                    `</div>`,
                `</div>`
            ].join('\n'),
            function () {
                $('#LayerInfoModalClose').on('click', function () {
                    Modal.remove()
                })
            }       
        )
    },
}

export default LayerInfo
