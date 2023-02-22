import $ from 'jquery'
import L_ from '../../../Basics/Layers_/Layers_'
import Modal from '../../../Ancillary/Modal'
import showdown from 'showdown'

import './LayerInfoModal.css'

showdown.setFlavor('github')

const LayerInfo = {
    converter: new showdown.Converter(),
    open: function (layerName) {
        const layer = L_.layers.data[layerName]

        if (layer == null) return

        let numberOfFeatures = ''
        if (layer.type === 'vector')
            try {
                numberOfFeatures = ` (${
                    L_.layers.layer[layerName].getLayers().length
                } Features)`
            } catch (e) {}

        let title = 'Layer'
        if (layer.type === 'header') title = 'Layer Group'

        let type = layer.type
        if (type === 'tile') type = 'raster'

        // prettier-ignore
        Modal.set(
            [
                `<div id='LayerInfoModal'>`,
                    `<div id='LayerInfoModalTitle' style='background: var(--color-${layer.type});'>`,
                        `<div><i class='mdi mdi-information-outline mdi-18px'></i><div>Information</div></div>`,
                        `<div id='LayerInfoModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='LayerInfoModalContent'>`,
                        `<div id='LayerInfoModalInnerTitle'>${title}: ${layer.display_name}</div>`,
                        `<div id='LayerInfoModalInnerSubtitle'>${type}<span>${numberOfFeatures}</span></div>`,

                            layer.tags && layer.tags.length > 0 ? 
                                [
                                    `<div id='LayerInfoModalTags'>`,
                                        `<div id='LayerInfoModalTagsContent'>`,
                                            layer.tags.map((tag) => {
                                                let catname, tagname
                                                if( tag.indexOf(':') > -1)
                                                    [catname, ...tagname] = tag.split(":");
                                                else tagname = tag

                                                return [
                                                    `<div class='LayerInfoModalTag'>`,
                                                        catname != null ? `<div class='LayerInfoModalTagCat'>${catname}</div>` : '',
                                                        `<div class='LayerInfoModalTagName'>${tagname}</div>`,
                                                    `</div>`
                                                ].join('\n')
                                            }).join('\n'),
                                        `</div>`,
                                    `</div>`
                                ].join('\n') : '',
                        
                        `<div id='LayerInfoModalDescription'>`,
                            `<div id='LayerInfoModalDescriptionContent'>`,
                                layer.description ? LayerInfo.converter.makeHtml(layer.description) : `<div class='LayerInfoModalNone'>No Description</div>`,
                            `</div>`,
                        `</div>`,
                        `<div id='LayerInfoModalInnerUUID'>${layer.uuid}</div>`,
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
